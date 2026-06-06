import logging
import os
import threading

import openai
from celery import shared_task
from django.conf import settings

from .models import Note
from .services import apply_tags_to_note, process_note

logger = logging.getLogger(__name__)


def dispatch_task(task, *args, **kwargs) -> None:
    """Queue via Celery when available; otherwise run in a background thread."""
    try:
        task.delay(*args, **kwargs)
    except Exception:
        logger.warning(
            'Celery unavailable for %s — running in background thread',
            task.name,
            exc_info=True,
        )
        threading.Thread(
            target=task,
            args=args,
            kwargs=kwargs,
            daemon=True,
        ).start()


@shared_task
def process_voice_note(note_id: str, audio_path: str) -> None:
    try:
        note = Note.objects.get(id=note_id)
        note.status = Note.Status.PROCESSING
        note.save(update_fields=['status'])

        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        with open(audio_path, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                model='whisper-1',
                file=audio_file,
            )

        note.raw_transcript = transcript.text
        note.save(update_fields=['raw_transcript'])

        process_note(note)
        dispatch_task(tag_note, str(note.id))
    except Exception:
        logger.exception('Voice note %s failed during processing', note_id)
        Note.objects.filter(id=note_id).update(status=Note.Status.FAILED)
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
