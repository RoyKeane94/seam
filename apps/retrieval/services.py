from pgvector.django import CosineDistance

from apps.notes.models import Chunk
from apps.notes.services import embed_texts

MIN_SCORE = 0.3
RESULT_LIMIT = 10


def search_notes(user_id, query: str) -> list[dict]:
    query_embedding = embed_texts([query])[0]

    chunks = (
        Chunk.objects.filter(user_id=user_id)
        .select_related('note')
        .annotate(distance=CosineDistance('embedding', query_embedding))
        .order_by('distance')[:RESULT_LIMIT]
    )

    results = []
    for chunk in chunks:
        score = 1 - chunk.distance
        if score <= MIN_SCORE:
            continue
        results.append({
            'text': chunk.text,
            'note_id': str(chunk.note_id),
            'created_at': chunk.note.created_at.isoformat(),
            'score': float(score),
        })

    return results
