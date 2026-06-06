from rest_framework import serializers

from .models import Note
from .services import word_count


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = (
            'id',
            'created_at',
            'source',
            'raw_transcript',
            'cleaned_text',
            'duration_secs',
            'status',
            'error_message',
            'tags',
        )
        read_only_fields = fields


class TextNoteSerializer(serializers.Serializer):
    text = serializers.CharField()

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Text cannot be empty.')
        if word_count(value) < 1:
            raise serializers.ValidationError('Add a few words to save a note.')
        return value
