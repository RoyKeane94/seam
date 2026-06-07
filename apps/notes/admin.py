from django.contrib import admin

from .models import Chunk, Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'source', 'status', 'created_at')
    list_filter = ('source', 'status')
    search_fields = ('cleaned_text', 'raw_transcript')


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ('id', 'note', 'chunk_index', 'embedding_model', 'created_at')
