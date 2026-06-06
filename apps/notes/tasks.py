import logging
import os
import threading
import time

import openai
from celery import shared_task
from django.conf import settings
from django.db import close_old_connections

from .models import Note
from .services import (
    EmptyNoteError,
    apply_tags_to_note,
    is_meaningful_voice_transcript,
    mark_note_failed,
    process_note,
    processing_error_reason,
)

logger = logging.getLogger(__name__)


def _run_in_thread(task, args, kwargs) -> None:
    def runner() -> None:
        close_old_connections()
        try:
            task.run(*args, **kwargs)
        except Exception:
            logger.exception('Background task %s failed', task.name)
        finally:
            close_old_connections()

    threading.Thread(target=runner, daemon=True).start()


def dispatch_task(task, *args, **kwargs) -> None:
    """Queue via Celery in production; run in a background thread locally."""
    if not settings.USE_CELERY:
        _run_in_thread(task, args, kwargs)
        return

    try:
        task.delay(*args, **kwargs)
    except Exception:
        logger.warning(
            'Celery unavailable for %s — running in background thread',
            task.name,
        )
        _run_in_thread(task, args, kwargs)


@shared_task
def process_voice_note(note_id: str, audio_path: str) -> None:
    logger.info('Processing voice note %s', note_id)
    try:
        note = Note.objects.get(id=note_id)
        note.status = Note.Status.PROCESSING
        note.save(update_fields=['status'])

        t0 = time.monotonic()
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        with open(audio_path, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                model='whisper-1',
                file=audio_file,
                response_format='verbose_json',
            )
        logger.info(
            'Voice note %s: whisper done in %.1fs',
            note_id,
            time.monotonic() - t0,
        )

        note.raw_transcript = transcript.text
        note.save(update_fields=['raw_transcript'])

        if not is_meaningful_voice_transcript(transcript.text):
            logger.info(
                'Discarding voice note %s: fewer than %d words',
                note_id,
                settings.VOICE_MIN_WORDS,
            )
            note.delete()
            return

        try:
            process_note(note, whisper_response=transcript)
        except EmptyNoteError:
            logger.info('Discarding voice note %s: no meaningful content', note_id)
            note.delete()
            return

        dispatch_task(tag_note, str(note.id))
    except Exception as exc:
        logger.exception('Voice note %s failed during processing', note_id)
        try:
            note = Note.objects.get(id=note_id)
            mark_note_failed(note, exc)
        except Note.DoesNotExist:
            Note.objects.filter(id=note_id).update(
                status=Note.Status.FAILED,
                error_message=processing_error_reason(exc),
            )
        raise
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)


@shared_task
def tag_note(note_id: str) -> None:
    try:
        note = Note.objects.get(id=note_id)
        apply_tags_to_note(note)
    except Note.DoesNotExist:
        return
    except Exception:
        logger.exception('Tagging failed for note %s', note_id)
