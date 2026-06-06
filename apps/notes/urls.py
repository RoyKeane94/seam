from django.urls import path

from .views import NoteDetailView, NoteListView, TextNoteView, VoiceNoteView

urlpatterns = [
    path('text/', TextNoteView.as_view(), name='notes-text'),
    path('voice/', VoiceNoteView.as_view(), name='notes-voice'),
    path('', NoteListView.as_view(), name='notes-list'),
    path('<uuid:note_id>/', NoteDetailView.as_view(), name='notes-detail'),
]
