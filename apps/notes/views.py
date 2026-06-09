import logging
import os
import tempfile

from django.conf import settings
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Note
from .serializers import NoteListSerializer, NoteSerializer, TextNoteSerializer
from .services import (
    EmptyNoteError,
    fail_stale_processing_notes,
    format_processing_failure,
    get_user_tags_by_frequency,
    mark_note_failed,
    process_note,
)
from .tasks import dispatch_task, process_voice_note, tag_note

logger = logging.getLogger(__name__)


class NotePagination(PageNumberPagination):
    page_size = 50


class TextNoteView(APIView):
    def post(self, request):
        serializer = TextNoteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        note = Note.objects.create(
            user=request.user,
            source=Note.Source.TEXT,
            raw_transcript=serializer.validated_data['text'],
            status=Note.Status.PROCESSING,
        )

        try:
            process_note(note)
        except EmptyNoteError:
            note.delete()
            return Response(
                {'detail': 'Nothing worth saving.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.exception('Text note %s failed during processing', note.id)
            reason = mark_note_failed(note, exc)
            return Response(
                {'detail': format_processing_failure(reason)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        dispatch_task(tag_note, str(note.id))
        note.refresh_from_db()
        return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class VoiceNoteView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        audio = request.FILES.get('audio')
        if not audio:
            return Response(
                {'detail': 'Audio file is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duration_secs = request.data.get('duration_secs')
        if duration_secs is not None:
            try:
                duration_secs = int(duration_secs)
            except (TypeError, ValueError):
                duration_secs = None

        if duration_secs is not None and duration_secs > settings.MAX_VOICE_DURATION_SECS:
            return Response(
                {'detail': 'Recordings are limited to 5 minutes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        suffix = os.path.splitext(audio.name)[1] or '.webm'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in audio.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        note = Note.objects.create(
            user=request.user,
            source=Note.Source.VOICE,
            duration_secs=duration_secs,
            status=Note.Status.PENDING,
        )

        dispatch_task(process_voice_note, str(note.id), tmp_path)
        return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class NoteListView(APIView):
    def get(self, request):
        fail_stale_processing_notes(request.user)
        queryset = (
            Note.objects.filter(user=request.user)
            .only(
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
        )
        paginator = NotePagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = NoteListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class TagListView(APIView):
    def get(self, request):
        tags = get_user_tags_by_frequency(request.user.id, limit=20)
        return Response({'tags': tags})


class NoteDetailView(APIView):
    def get(self, request, note_id):
        fail_stale_processing_notes(request.user)
        note = (
            Note.objects.filter(id=note_id, user=request.user)
            .only(
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
            .first()
        )
        if note is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(NoteSerializer(note).data)

    def patch(self, request, note_id):
        remove_tag = request.data.get('remove_tag')
        if not remove_tag or not isinstance(remove_tag, str):
            return Response(
                {'detail': 'remove_tag is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        remove_tag = remove_tag.strip().lower()
        if remove_tag in note.tags:
            note.tags = [t for t in note.tags if t != remove_tag]
            note.save(update_fields=['tags'])

        return Response(NoteSerializer(note).data)

    def delete(self, request, note_id):
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
