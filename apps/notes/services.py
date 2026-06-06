import json
import logging
import math
import re
import time
from collections import Counter
from datetime import timedelta

import anthropic
import openai
from django.conf import settings
from django.utils import timezone

from .models import Chunk, Note

logger = logging.getLogger(__name__)

CLEANING_PROMPT = """Fix grammar, remove filler words (um, uh, like, you know, look, right, kind of, I mean, basically), remove false starts and repeated words, split run-ons at natural clause boundaries. Do not add, interpret, or change vocabulary. Return only the cleaned text. If a sentence cannot be repaired without guessing at meaning, remove it entirely.

Text to clean:
{raw_text}"""

DEFAULT_MAX_CHUNK_TOKENS = 150
DEFAULT_CHUNK_OVERLAP = 1


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def clean_text(raw_text: str) -> str:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4096,
        messages=[
            {
                'role': 'user',
                'content': CLEANING_PROMPT.format(raw_text=raw_text),
            }
        ],
    )
    return message.content[0].text.strip()


def chunk_text(
    text: str,
    max_tokens: int = DEFAULT_MAX_CHUNK_TOKENS,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    stripped = text.strip()
    if not stripped:
        return []

    sentences = [
        s.strip()
        for s in re.split(r'(?<=[.!?])\s+', stripped)
        if s.strip()
    ]
    if not sentences:
        return [stripped]

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in sentences:
        token_est = _estimate_tokens(sentence)
        if current_len + token_est > max_tokens and current:
            chunks.append(' '.join(current))
            current = current[-overlap:] if overlap else []
            current_len = sum(_estimate_tokens(s) for s in current)
        current.append(sentence)
        current_len += token_est

    if current:
        chunks.append(' '.join(current))

    return chunks


def _segment_field(segment, field: str):
    if isinstance(segment, dict):
        return segment[field]
    return getattr(segment, field)


def _whisper_segments(whisper_response) -> list:
    if isinstance(whisper_response, dict):
        return whisper_response.get('segments') or []
    return getattr(whisper_response, 'segments', None) or []


def chunk_by_whisper_segments(
    whisper_response,
    pause_threshold: float | None = None,
) -> list[str]:
    if pause_threshold is None:
        pause_threshold = settings.WHISPER_PAUSE_THRESHOLD

    segments = _whisper_segments(whisper_response)
    if not segments:
        return []

    chunks: list[str] = []
    current: list[str] = []

    for i, segment in enumerate(segments):
        if i > 0:
            gap = _segment_field(segment, 'start') - _segment_field(segments[i - 1], 'end')
            if gap > pause_threshold and current:
                chunk = ' '.join(current).strip()
                if chunk:
                    chunks.append(chunk)
                current = []

        text = _segment_field(segment, 'text').strip()
        if text:
            current.append(text)

    if current:
        chunk = ' '.join(current).strip()
        if chunk:
            chunks.append(chunk)

    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.embeddings.create(
        model='text-embedding-3-small',
        input=texts,
    )
    return [item.embedding for item in response.data]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _avg_embedding(a: list[float], b: list[float]) -> list[float]:
    return [(x + y) / 2 for x, y in zip(a, b)]


def merge_semantic_chunks(
    chunks: list[str],
    threshold: float | None = None,
) -> tuple[list[str], list[list[float]]]:
    """Merge adjacent chunks by embedding similarity. Returns texts and embeddings."""
    if threshold is None:
        threshold = settings.SEMANTIC_CHUNK_THRESHOLD

    merged = [c.strip() for c in chunks if c and c.strip()]
    if not merged:
        return [], []

    embeddings = embed_texts(merged)
    if len(merged) <= 1:
        return merged, embeddings

    merges_happened = False
    i = 0
    while i < len(merged) - 1:
        if _cosine_similarity(embeddings[i], embeddings[i + 1]) > threshold:
            merged[i] = f'{merged[i]} {merged[i + 1]}'.strip()
            embeddings[i] = _avg_embedding(embeddings[i], embeddings[i + 1])
            del merged[i + 1]
            del embeddings[i + 1]
            merges_happened = True
        else:
            i += 1

    if merges_happened:
        embeddings = embed_texts(merged)

    return merged, embeddings


def process_note(note: Note, *, whisper_response=None) -> None:
    started = time.monotonic()
    raw = note.raw_transcript or ''

    t0 = time.monotonic()
    skip_clean = (
        note.source == Note.Source.VOICE
        and len(raw) <= settings.VOICE_SKIP_CLEAN_MAX_CHARS
    )
    if skip_clean:
        cleaned = ' '.join(raw.split())
        logger.info('Note %s: skipped clean for short voice note (%d chars)', note.id, len(raw))
    else:
        cleaned = clean_text(raw)
        logger.info(
            'Note %s: cleaned text in %.1fs (%d chars)',
            note.id,
            time.monotonic() - t0,
            len(raw),
        )
    note.cleaned_text = cleaned

    if note.source == Note.Source.VOICE and whisper_response is not None:
        texts = chunk_by_whisper_segments(whisper_response)
        if not texts:
            texts = chunk_text(cleaned)
    else:
        texts = chunk_text(cleaned)

    pre_merge = len(texts)
    # Voice notes are already split on pauses — skip merge for short recordings.
    if note.source == Note.Source.VOICE and pre_merge <= 2:
        embeddings = embed_texts(texts)
        logger.info('Note %s: %d chunk(s), skipped semantic merge', note.id, len(texts))
    else:
        t0 = time.monotonic()
        texts, embeddings = merge_semantic_chunks(texts)
        logger.info(
            'Note %s: semantic merge %d → %d chunk(s) in %.1fs',
            note.id,
            pre_merge,
            len(texts),
            time.monotonic() - t0,
        )

    if texts and len(embeddings) != len(texts):
        raise ValueError(f'Note {note.id}: expected {len(texts)} embeddings, got {len(embeddings)}')

    logger.info('Note %s: saving %d chunk(s) with embeddings', note.id, len(texts))
    note.chunks.all().delete()
    Chunk.objects.bulk_create([
        Chunk(
            note=note,
            user=note.user,
            chunk_index=i,
            text=text,
            embedding=embedding,
        )
        for i, (text, embedding) in enumerate(zip(texts, embeddings))
    ])

    note.status = Note.Status.READY
    note.save(update_fields=['cleaned_text', 'status'])
    logger.info('Note %s: ready in %.1fs', note.id, time.monotonic() - started)


TAGGING_SYSTEM_PROMPT = """You are a tagging assistant. Extract 0–2 topic tags from a transcript.

Rules:
- Tags must be single lowercase nouns or short lowercase phrases (max 3 words)
- Only tag clear, recurring topics — if nothing obvious emerges, return []
- Never tag meta-topics like "thought", "idea", "note", "voice note"
- Return only a raw JSON array of strings, nothing else. No explanation, no markdown.

Examples:
"thinking about whether to bring someone in for sales" → ["hiring"]
"the annual plan is hurting conversion" → ["pricing"]
"not sure about the timing on this" → []
"seam should surface things before you ask for them" → ["seam", "product"]"""


def extract_tags(transcript: str) -> list[str]:
    try:
        if not transcript or not transcript.strip():
            return []

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=settings.ANTHROPIC_TAGGING_MODEL,
            max_tokens=256,
            system=TAGGING_SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': transcript.strip()}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith('```'):
            raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=re.MULTILINE).strip()

        tags = json.loads(raw)
        if not isinstance(tags, list):
            return []

        result = []
        for tag in tags[:2]:
            value = str(tag).strip().lower()
            if value and len(value.split()) <= 3:
                result.append(value)
        return result
    except Exception:
        logger.exception('Tag extraction failed')
        return []


def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        return _levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, char_a in enumerate(a):
        curr = [i + 1]
        for j, char_b in enumerate(b):
            curr.append(min(
                prev[j + 1] + 1,
                curr[j] + 1,
                prev[j] + (char_a != char_b),
            ))
        prev = curr
    return prev[-1]


def _tags_similar(a: str, b: str) -> bool:
    if a == b:
        return True
    if a in b or b in a:
        return True
    return _levenshtein(a, b) <= 2


def _find_similar_tag(tag: str, corpus: list[str]) -> str | None:
    for existing in corpus:
        if _tags_similar(tag, existing):
            return existing
    return None


def normalize_tags(new_tags: list[str], existing_corpus: list[str]) -> list[str]:
    corpus = list(existing_corpus)
    result: list[str] = []

    for tag in new_tags:
        tag = tag.strip().lower()
        if not tag or len(tag.split()) > 3:
            continue

        match = _find_similar_tag(tag, corpus)
        canonical = match if match else tag

        if canonical not in result:
            result.append(canonical)
        if canonical not in corpus:
            corpus.append(canonical)
        if len(result) >= 2:
            break

    return result[:2]


def fail_stale_processing_notes(user) -> int:
    """Mark abandoned pending/processing notes as failed."""
    cutoff = timezone.now() - timedelta(minutes=settings.STALE_PROCESSING_MINUTES)
    updated = Note.objects.filter(
        user=user,
        status__in=[Note.Status.PENDING, Note.Status.PROCESSING],
        created_at__lt=cutoff,
    ).update(status=Note.Status.FAILED)
    if updated:
        logger.info('Marked %d stale note(s) as failed for user %s', updated, user.id)
    return updated


def get_user_tag_corpus(user_id) -> list[str]:
    corpus: set[str] = set()
    for tags in Note.objects.filter(user_id=user_id).values_list('tags', flat=True):
        for tag in tags or []:
            if tag:
                corpus.add(tag)
    return sorted(corpus)


def get_user_tags_by_frequency(user_id, limit: int = 20) -> list[str]:
    counts: Counter[str] = Counter()
    for tags in Note.objects.filter(user_id=user_id).values_list('tags', flat=True):
        for tag in tags or []:
            if tag:
                counts[tag] += 1
    return [tag for tag, _ in counts.most_common(limit)]


def apply_tags_to_note(note: Note) -> None:
    transcript = note.raw_transcript or note.cleaned_text or ''
    if not transcript.strip():
        return

    raw_tags = extract_tags(transcript)
    if not raw_tags:
        note.tags = []
        note.save(update_fields=['tags'])
        return

    corpus = get_user_tag_corpus(note.user_id)
    note.tags = normalize_tags(raw_tags, corpus)
    note.save(update_fields=['tags'])
    logger.info('Note %s: tagged %s', note.id, note.tags)
