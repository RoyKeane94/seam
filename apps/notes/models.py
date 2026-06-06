import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from pgvector.django import VectorField


class Note(models.Model):
    class Source(models.TextChoices):
        VOICE = 'voice', 'Voice'
        TEXT = 'text', 'Text'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        READY = 'ready', 'Ready'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=10, choices=Source.choices)
    raw_transcript = models.TextField(blank=True, null=True)
    cleaned_text = models.TextField(blank=True, null=True)
    duration_secs = models.IntegerField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    tags = ArrayField(
        models.CharField(max_length=64),
        default=list,
        blank=True,
    )

    class Meta:
        db_table = 'notes_note'
        ordering = ['-created_at']
        indexes = [
            GinIndex(fields=['tags'], name='idx_notes_note_tags'),
        ]


class Chunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='chunks')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chunks',
    )
    chunk_index = models.IntegerField()
    text = models.TextField()
    embedding = VectorField(dimensions=1536)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notes_chunk'
        ordering = ['chunk_index']
