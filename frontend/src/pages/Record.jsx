import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import { api, getToken } from '../api';
import { useAuth } from '../context/AuthContext';
import useMediaQuery from '../hooks/useMediaQuery';
import { createVoiceRecorder, getVoiceInputStream } from '../lib/audio';

const MAX_RECORDING_SECS = 300;
const MSG_NOTHING_SAVED = 'Nothing worth saving.';
const MSG_MAX_RECORDING = 'Recordings are limited to 5 minutes.';
const SUCCESS_TOASTS = new Set(['Saved', 'Indexed', 'Deleted']);

function formatProcessingFailure(note) {
  if (note?.error_message) {
    return `Failed to process note: ${note.error_message}`;
  }
  return 'Failed to process note. Try again.';
}

function IconExternalOpen() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function TagPills({ tags, noteId, onTagClick, onTagRemove, editable = false }) {
  if (!tags?.length) return null;
  return (
    <div className="entry-tags" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {tags.map((tag) => (
        <span key={tag} className="entry-tag-pill">
          <button type="button" className="entry-tag-label" onClick={() => onTagClick(tag)}>
            {tag}
          </button>
          {editable && (
            <button
              type="button"
              className="entry-tag-remove"
              aria-label={`Remove ${tag}`}
              onClick={() => onTagRemove(noteId, tag)}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function formatTime(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function ordinalDay(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatNoteDateTime(iso) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${ordinalDay(d.getDate())} ${month} · ${time}`;
}

function formatNoteTime(iso) {
  return formatNoteDateTime(iso);
}

function groupLabel(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computeStreak(notes) {
  if (!notes.length) return 0;
  const days = new Set(notes.map((n) => dayKey(n.created_at)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; ; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(dayKey(d))) streak += 1;
    else if (i > 0) break;
    else break;
  }
  return streak;
}

function groupNotes(notes) {
  const groups = [];
  let currentLabel = null;
  for (const note of notes) {
    const label = groupLabel(note.created_at);
    if (label !== currentLabel) {
      groups.push({ label, notes: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].notes.push(note);
  }
  return groups;
}

function highlightText(text, query) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i}>{part}</mark>
    ) : (
      part
    ),
  );
}

function formatResultMeta(iso) {
  return formatNoteDateTime(iso);
}

function formatReaderDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatReaderTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const PROCESSING_POLL_MS = 4000;
const TRACKING_KEY = 'seam_processing_ids';
const CLIENT_TRACK_MS = 5 * 60 * 1000;
const NOTES_PAGE_SIZE = 10;

function isInFlight(note) {
  return note.status === 'pending' || note.status === 'processing';
}

function readTrackedIds() {
  try {
    const raw = sessionStorage.getItem(TRACKING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTrackedIds(ids) {
  sessionStorage.setItem(TRACKING_KEY, JSON.stringify(ids));
}

function isRecentInFlight(note) {
  const age = Date.now() - new Date(note.created_at).getTime();
  return age >= 0 && age < CLIENT_TRACK_MS;
}

function isTrackedProcessing(note, trackedIds) {
  return (
    trackedIds.includes(note.id) && isInFlight(note) && isRecentInFlight(note)
  );
}

function entryPreview(note, trackedIds) {
  if (isTrackedProcessing(note, trackedIds)) return 'Processing…';
  return note.preview || note.cleaned_text || note.raw_transcript || '…';
}

function noteBodyText(note) {
  return note.cleaned_text || note.raw_transcript || note.preview || '…';
}

export default function Record() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [tab, setTab] = useState(location.pathname === '/search' ? 'retrieve' : 'record');
  const [searchOpen, setSearchOpen] = useState(location.pathname === '/search');

  useEffect(() => {
    const onSearch = location.pathname === '/search';
    setTab(onSearch ? 'retrieve' : 'record');
    if (isMobile) setSearchOpen(onSearch);
    if (!isMobile && onSearch) setSidebarView('retrieve');
  }, [location.pathname, isMobile]);

  const [text, setText] = useState('');
  const [notes, setNotes] = useState([]);
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [toast, setToast] = useState('');
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [userTags, setUserTags] = useState([]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sidebarView, setSidebarView] = useState('today');
  const [expandedAllNoteId, setExpandedAllNoteId] = useState(null);
  const [expandedTodayNoteId, setExpandedTodayNoteId] = useState(null);
  const [todayTextOpen, setTodayTextOpen] = useState(false);
  const [loadingNoteId, setLoadingNoteId] = useState(null);
  const loadedNoteIdsRef = useRef(new Set());
  const [allNotesPage, setAllNotesPage] = useState(1);
  const [todayPage, setTodayPage] = useState(1);
  const [mobileEntriesPage, setMobileEntriesPage] = useState(1);

  const mediaRecorderRef = useRef(null);
  const recordingFormatRef = useRef({ mimeType: 'audio/webm', extension: 'webm' });
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secsRef = useRef(0);
  const retrieveInputRef = useRef(null);
  const todayRetrieveInputRef = useRef(null);
  const todayComposeInputRef = useRef(null);
  const composeInputRef = useRef(null);
  const debounceRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [trackedIds, setTrackedIds] = useState(readTrackedIds);

  const addTrackedId = useCallback((id) => {
    setTrackedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeTrackedIds(next);
      return next;
    });
  }, []);

  const removeTrackedId = useCallback((id) => {
    setTrackedIds((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((x) => x !== id);
      writeTrackedIds(next);
      return next;
    });
  }, []);

  function resizeCompose(el) {
    if (!el) return;
    el.style.height = 'auto';
    const max = isMobile ? 120 : 140;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }

  const loadNotes = useCallback(async () => {
    try {
      const data = await api.listNotes();
      const incoming = data.results || [];
      setNotes((prev) =>
        incoming.map((note) => {
          if (!loadedNoteIdsRef.current.has(note.id)) return note;
          const cached = prev.find((n) => n.id === note.id);
          if (!cached?.cleaned_text && !cached?.raw_transcript) return note;
          return { ...note, cleaned_text: cached.cleaned_text, raw_transcript: cached.raw_transcript };
        }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const data = await api.listTags();
      setUserTags(data.tags || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (sidebarView !== 'all') {
      setExpandedAllNoteId(null);
    }
    if (sidebarView === 'all') {
      setAllNotesPage(1);
    }
    if (sidebarView === 'today') {
      setTodayPage(1);
      setExpandedTodayNoteId(null);
      setTodayTextOpen(false);
    }
  }, [sidebarView]);

  useEffect(() => {
    loadNotes();
    loadTags();
  }, [loadNotes, loadTags]);

  useEffect(() => {
    setSelectedNote((current) => {
      if (!current) return null;
      return notes.find((n) => n.id === current.id) || null;
    });
  }, [notes]);

  useEffect(() => {
    setTrackedIds((prev) => {
      const next = prev.filter((id) => {
        const note = notes.find((n) => n.id === id);
        return note && isInFlight(note) && isRecentInFlight(note);
      });
      if (next.length !== prev.length) writeTrackedIds(next);
      return next;
    });
  }, [notes]);

  const activeProcessingIds = useMemo(
    () => notes.filter((n) => isTrackedProcessing(n, trackedIds)).map((n) => n.id),
    [notes, trackedIds],
  );
  const hasVoiceInFlight = activeProcessingIds.length > 0;

  useEffect(() => {
    if (!activeProcessingIds.length) return undefined;

    let cancelled = false;

    async function pollProcessingNotes() {
      try {
        const updates = await Promise.all(
          activeProcessingIds.map(async (id) => {
            try {
              return { id, note: await api.getNote(id) };
            } catch (err) {
              if (err.status === 404) {
                return { id, discarded: true };
              }
              return { id };
            }
          }),
        );
        if (cancelled) return;

        const discardedIds = updates.filter((u) => u.discarded).map((u) => u.id);
        if (discardedIds.length) {
          for (const id of discardedIds) {
            removeTrackedId(id);
          }
          setNotes((prev) => prev.filter((n) => !discardedIds.includes(n.id)));
          showToast(MSG_NOTHING_SAVED);
        }

        const resolved = updates.filter((u) => u.note);
        setNotes((prev) =>
          prev.map((n) => {
            const updated = resolved.find((u) => u.note.id === n.id)?.note;
            if (!updated) return n;
            if (updated.cleaned_text || updated.raw_transcript) {
              loadedNoteIdsRef.current.add(updated.id);
            }
            return { ...n, ...updated };
          }),
        );

        for (const { note } of resolved) {
          if (note.status === 'ready') {
            removeTrackedId(note.id);
            loadTags();
            showToast('Indexed');
          } else if (note.status === 'failed') {
            removeTrackedId(note.id);
            setUploadError(formatProcessingFailure(note));
          }
        }
      } catch {
        if (!cancelled) setUploadError('Something went wrong.');
      }
    }

    pollProcessingNotes();
    const interval = setInterval(pollProcessingNotes, PROCESSING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeProcessingIds.join(','), loadTags, removeTrackedId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setSearchLoading(false);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.search(trimmed);
        setResults(data.results || []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function showToast(msg) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(''), 1600);
  }

  function selectSidebarView(view) {
    setSidebarView(view);
    setSelectedNote(null);
    if (view === 'retrieve') {
      setTab('retrieve');
      navigate('/search', { replace: true });
      setTimeout(() => retrieveInputRef.current?.focus(), 50);
    } else {
      setTab('record');
      if (location.pathname === '/search') {
        navigate('/record', { replace: true });
      }
      if (view === 'record') {
        setTimeout(() => composeInputRef.current?.focus(), 50);
      }
    }
  }

  function closeNote() {
    setSelectedNote(null);
  }

  async function openTodayNote(note) {
    if (isTrackedProcessing(note, trackedIds)) return;
    setExpandedTodayNoteId(null);
    setSelectedNote(note);
    if (!loadedNoteIdsRef.current.has(note.id)) {
      try {
        await fetchNoteDetail(note.id);
      } catch {
        showToast('Failed to load note');
      }
    }
  }

  function collapseTodayNote() {
    setExpandedTodayNoteId(null);
  }

  function openNote(note) {
    if (isTrackedProcessing(note, trackedIds)) return;
    setSelectedNote(note);
    if (isMobile) setSearchOpen(false);
    if (!loadedNoteIdsRef.current.has(note.id)) {
      fetchNoteDetail(note.id).catch(() => showToast('Failed to load note'));
    }
  }

  function switchTab(name) {
    setSelectedNote(null);
    setTab(name);
    if (isMobile) setSearchOpen(name === 'retrieve');
    navigate(name === 'retrieve' ? '/search' : '/record', { replace: true });
    if (name === 'retrieve') {
      setTimeout(() => retrieveInputRef.current?.focus(), isMobile ? 320 : 50);
    }
  }

  function openSearch() {
    switchTab('retrieve');
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
    setTab('record');
    navigate('/record', { replace: true });
  }

  function searchByTag(tag) {
    setSelectedNote(null);
    setQuery(tag);
    if (isMobile) {
      setTab('retrieve');
      setSearchOpen(true);
      navigate('/search', { replace: true });
      setTimeout(() => retrieveInputRef.current?.focus(), 320);
      return;
    }
    if (sidebarView === 'today') {
      setTimeout(() => todayRetrieveInputRef.current?.focus(), 50);
      return;
    }
    setSidebarView('retrieve');
    setTab('retrieve');
    navigate('/search', { replace: true });
    setTimeout(() => retrieveInputRef.current?.focus(), 50);
  }

  function openTodayTextCompose() {
    setTodayTextOpen(true);
    requestAnimationFrame(() => {
      todayComposeInputRef.current?.focus();
      resizeCompose(todayComposeInputRef.current);
    });
  }

  const fetchNoteDetail = useCallback(async (noteId) => {
    if (loadedNoteIdsRef.current.has(noteId)) {
      return null;
    }
    const full = await api.getNote(noteId);
    loadedNoteIdsRef.current.add(noteId);
    setNotes((prev) => prev.map((n) => (n.id === full.id ? { ...n, ...full } : n)));
    setSelectedNote((current) => (current?.id === full.id ? { ...current, ...full } : current));
    return full;
  }, []);

  async function toggleTodayNoteExpand(note) {
    if (isTrackedProcessing(note, trackedIds)) return;
    if (expandedTodayNoteId === note.id) {
      setExpandedTodayNoteId(null);
      return;
    }
    setExpandedTodayNoteId(note.id);
    if (loadedNoteIdsRef.current.has(note.id)) return;
    setLoadingNoteId(note.id);
    try {
      await fetchNoteDetail(note.id);
    } catch {
      setExpandedTodayNoteId(null);
      showToast('Failed to load note');
    } finally {
      setLoadingNoteId(null);
    }
  }

  async function toggleAllNoteExpand(note) {
    if (isTrackedProcessing(note, trackedIds)) return;
    if (expandedAllNoteId === note.id) {
      setExpandedAllNoteId(null);
      return;
    }
    setExpandedAllNoteId(note.id);
    if (loadedNoteIdsRef.current.has(note.id)) return;
    setLoadingNoteId(note.id);
    try {
      await fetchNoteDetail(note.id);
    } catch {
      setExpandedAllNoteId(null);
      showToast('Failed to load note');
    } finally {
      setLoadingNoteId(null);
    }
  }

  async function handleRemoveTag(noteId, tag) {
    try {
      const updated = await api.removeNoteTag(noteId, tag);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setSelectedNote((current) => (current?.id === noteId ? updated : current));
      loadTags();
    } catch {
      showToast('Failed');
    }
  }

  async function handleDeleteNote(noteId) {
    try {
      await api.deleteNote(noteId);
      setSelectedNote(null);
      loadNotes();
      loadTags();
      showToast('Deleted');
    } catch {
      showToast('Failed');
    }
  }

  async function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed || textSubmitting) return;

    setTextSubmitting(true);
    setPendingText(trimmed);
    setText('');
    if (composeInputRef.current) {
      composeInputRef.current.style.height = 'auto';
    }
    if (todayComposeInputRef.current) {
      todayComposeInputRef.current.style.height = 'auto';
    }

    try {
      await api.createTextNote(trimmed);
      loadNotes();
      setTodayTextOpen(false);
      showToast('Saved');
      window.setTimeout(() => {
        loadNotes();
        loadTags();
      }, 4000);
    } catch (err) {
      setText(trimmed);
      resizeCompose(composeInputRef.current);
      resizeCompose(todayComposeInputRef.current);
      showToast(err.message || MSG_NOTHING_SAVED);
    } finally {
      setTextSubmitting(false);
      setPendingText('');
    }
  }

  async function startRecording() {
    if (hasVoiceInFlight) return;
    setUploadError('');
    try {
      const stream = await getVoiceInputStream();
      const { recorder, mimeType, extension } = createVoiceRecorder(stream);
      recordingFormatRef.current = { mimeType, extension };
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const { mimeType: recordedType, extension: recordedExt } = recordingFormatRef.current;
        const blob = new Blob(chunksRef.current, { type: recordedType });
        if (!getToken()) {
          setUploadError('Session expired. Sign in again to save recordings.');
          return;
        }
        try {
          const note = await api.createVoiceNote(
            blob,
            secsRef.current,
            `recording.${recordedExt}`,
          );
          addTrackedId(note.id);
          await loadNotes();
        } catch (err) {
          setUploadError(
            err.message === 'Unauthorized'
              ? 'Session expired. Sign in again to save recordings.'
              : err.message || 'Upload failed. Try again.',
          );
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      setSecs(0);
      secsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          const next = s + 1;
          secsRef.current = next;
          if (next >= MAX_RECORDING_SECS) {
            showToast(MSG_MAX_RECORDING);
            stopRecording();
            return MAX_RECORDING_SECS;
          }
          return next;
        });
      }, 1000);
    } catch {
      setUploadError('Microphone access denied.');
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  function toggleRecord() {
    if (recording) stopRecording();
    else startRecording();
  }

  const feedNotes = notes.filter((n) => {
    if (n.status === 'failed') return false;
    if (isInFlight(n)) return isTrackedProcessing(n, trackedIds);
    return true;
  });
  const notesTotalPages = Math.max(1, Math.ceil(feedNotes.length / NOTES_PAGE_SIZE));
  const grouped = groupNotes(feedNotes);
  const paginatedTodayNotes = useMemo(() => {
    const start = (todayPage - 1) * NOTES_PAGE_SIZE;
    return feedNotes.slice(start, start + NOTES_PAGE_SIZE);
  }, [feedNotes, todayPage]);
  const paginatedAllNotes = useMemo(() => {
    const start = (allNotesPage - 1) * NOTES_PAGE_SIZE;
    return feedNotes.slice(start, start + NOTES_PAGE_SIZE);
  }, [feedNotes, allNotesPage]);
  const paginatedMobileNotes = useMemo(() => {
    const start = (mobileEntriesPage - 1) * NOTES_PAGE_SIZE;
    return feedNotes.slice(start, start + NOTES_PAGE_SIZE);
  }, [feedNotes, mobileEntriesPage]);
  const mobileGrouped = groupNotes(paginatedMobileNotes);
  const allNotesRangeStart =
    feedNotes.length === 0 ? 0 : (allNotesPage - 1) * NOTES_PAGE_SIZE + 1;
  const allNotesRangeEnd = Math.min(allNotesPage * NOTES_PAGE_SIZE, feedNotes.length);

  useEffect(() => {
    if (todayPage > notesTotalPages) {
      setTodayPage(notesTotalPages);
    }
  }, [todayPage, notesTotalPages]);

  useEffect(() => {
    if (allNotesPage > notesTotalPages) {
      setAllNotesPage(notesTotalPages);
    }
  }, [allNotesPage, notesTotalPages]);

  useEffect(() => {
    if (mobileEntriesPage > notesTotalPages) {
      setMobileEntriesPage(notesTotalPages);
    }
  }, [mobileEntriesPage, notesTotalPages]);
  const streak = computeStreak(notes);
  const userInitial = user?.email?.[0]?.toUpperCase() || '?';
  const composePlaceholder = userTags.length
    ? `What's on your mind about ${userTags[0]}…`
    : "What's on your mind…";
  const mobileComposePlaceholder = 'Or type a note';

  let retrieveEmpty = null;
  if (!query.trim()) {
    retrieveEmpty = { head: 'Ask anything', sub: "Seam pulls from everything you've said" };
  } else if (searched && !searchLoading && results.length === 0) {
    retrieveEmpty = { head: 'Nothing yet', sub: "You haven't said anything about this" };
  }

  const recordControls = (
    <>
      <div className={`record-glow${recording ? ' active' : ''}`}>
        <button
          type="button"
          className={`record-btn${recording ? ' recording' : ''}`}
          onClick={toggleRecord}
          disabled={hasVoiceInFlight}
        >
          {recording ? (
            <svg viewBox="0 0 24 24">
              <rect x="7" y="7" width="10" height="10" rx="2" fill="white" stroke="white" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
            </svg>
          )}
        </button>
      </div>
      <div className={`record-timer${recording ? ' visible' : ''}`}>{formatTime(secs)}</div>
    </>
  );

  const composeArea = (
    <div className={`compose-row${textSubmitting ? ' submitting' : ''}`}>
      <textarea
        ref={composeInputRef}
        className="compose-input"
        placeholder={isMobile ? mobileComposePlaceholder : composePlaceholder}
        rows={1}
        value={text}
        disabled={textSubmitting}
        onChange={(e) => {
          setText(e.target.value);
          resizeCompose(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendText();
          }
        }}
      />
      {textSubmitting ? (
        <div className="compose-spinner" aria-label="Saving">
          <span className="compose-spinner-ring" />
        </div>
      ) : (
        <button
          type="button"
          className={`compose-send${text.trim() ? ' visible' : ''}`}
          onClick={handleSendText}
        >
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );

  const todayRetrieveBar = (
    <div className="today-retrieve-bar">
      <svg className="today-retrieve-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        ref={todayRetrieveInputRef}
        className="today-retrieve-input"
        type="text"
        placeholder={composePlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );

  const retrieveResults = (
    <>
      {searchLoading && <div className="search-loading">Searching…</div>}
      {retrieveEmpty && !searchLoading ? (
        <div className="retrieve-empty">
          <div className="retrieve-empty-head">{retrieveEmpty.head}</div>
          <div className="retrieve-empty-sub">{retrieveEmpty.sub}</div>
        </div>
      ) : (
        !searchLoading &&
        results.map((result, i) => (
          <div key={`${result.note_id}-${i}`} className="result-item">
            <div className="result-text">{highlightText(result.text, query)}</div>
            <div className="result-meta">{formatResultMeta(result.created_at)}</div>
          </div>
        ))
      )}
    </>
  );

  const entryReader = selectedNote && (
    <div className="entry-reader">
      <div className="entry-reader-toolbar">
        <button type="button" className="entry-reader-back" onClick={closeNote}>
          ←{' '}
          {sidebarView === 'all' ? 'All notes' : sidebarView === 'today' ? 'Today' : 'Record'}
        </button>
        <button
          type="button"
          className={`entry-reader-delete${sidebarView === 'today' ? ' today-icon-btn today-icon-btn--delete' : ''}`}
          onClick={() => handleDeleteNote(selectedNote.id)}
          aria-label="Delete note"
        >
          {sidebarView === 'today' ? <IconTrash /> : 'Delete'}
        </button>
      </div>
      <div className="entry-reader-scroll">
        <div className="entry-reader-meta">
          <span className="entry-reader-date">{formatReaderDate(selectedNote.created_at)}</span>
          <span className="entry-reader-time">{formatReaderTime(selectedNote.created_at)}</span>
          <span className="entry-reader-tags">
            <span className={`entry-reader-tag${selectedNote.source === 'voice' ? ' voice' : ''}`}>
              {selectedNote.source === 'voice' ? 'Voice' : 'Text'}
            </span>
            {selectedNote.source === 'voice' && selectedNote.duration_secs != null && (
              <span className="entry-reader-tag">{formatTime(selectedNote.duration_secs)}</span>
            )}
          </span>
        </div>
        <TagPills
          tags={selectedNote.tags}
          noteId={selectedNote.id}
          onTagClick={searchByTag}
          onTagRemove={handleRemoveTag}
          editable
        />
        <div className="entry-reader-body">
          {noteBodyText(selectedNote)}
        </div>
      </div>
    </div>
  );

  const optimisticTextEntry = textSubmitting && (
    <div className={isMobile ? 'entry entry-mobile' : 'entry'}>
      {isMobile ? (
        <>
          <div className="entry-dot pending" />
          <div className="entry-body">
            <div className="entry-text pending">{pendingText}</div>
            <div className="entry-meta">
              <span>processing</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="entry-text pending">{pendingText}</div>
          <div className="entry-meta">
            <div className="entry-dot pending" />
            <span>processing</span>
          </div>
        </>
      )}
    </div>
  );

  const feedEmpty = (
    <div className="feed-empty">
      <p className="feed-empty-head">No entries yet</p>
      <p className="feed-empty-sub">Your recordings will appear here</p>
    </div>
  );

  function renderAllNotesEntry(note) {
    const expanded = expandedAllNoteId === note.id;
    const previewText = entryPreview(note, trackedIds);
    const fullText = noteBodyText(note);
    const processing = isTrackedProcessing(note, trackedIds);
    const isLoading = loadingNoteId === note.id;

    return (
      <div
        key={note.id}
        className={`all-notes-entry${expanded ? ' expanded' : ''}${processing ? ' in-flight' : ''}`}
      >
        <div className="all-notes-entry-row">
          <button
            type="button"
            className="all-notes-entry-toggle"
            onClick={() => toggleAllNoteExpand(note)}
            aria-expanded={expanded}
          >
            {!expanded && (
              <div className={`all-notes-entry-preview${processing ? ' pending' : ''}`}>
                {processing ? 'Processing…' : previewText}
              </div>
            )}
            {!processing && note.tags?.length > 0 && (
              <TagPills
                tags={note.tags}
                noteId={note.id}
                onTagClick={searchByTag}
                onTagRemove={handleRemoveTag}
                editable
              />
            )}
            <div className="all-notes-entry-meta">
              <div
                className={`entry-dot${processing ? ' pending' : ''}${note.source === 'voice' && !processing ? ' voice' : ''}`}
              />
              <span>{processing ? 'processing' : formatNoteTime(note.created_at)}</span>
            </div>
          </button>
          <div className="all-notes-entry-actions">
            <button
              type="button"
              className="all-notes-entry-expand"
              onClick={() => toggleAllNoteExpand(note)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse note' : 'Expand note'}
            >
              {expanded ? '−' : '+'}
            </button>
            {!processing && (
              <button
                type="button"
                className="all-notes-entry-delete"
                aria-label="Delete note"
                onClick={(e) => {
                  e.stopPropagation();
                  if (expandedAllNoteId === note.id) setExpandedAllNoteId(null);
                  handleDeleteNote(note.id);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className={`all-notes-entry-body-wrap${expanded ? ' open' : ''}`}>
          <div className="all-notes-entry-body-inner">
            {!processing && (
              <div className="all-notes-entry-body">
                {isLoading ? 'Loading…' : fullText}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderAllNotesList() {
    return paginatedAllNotes.map((note) => renderAllNotesEntry(note));
  }

  function renderTodayEntry(note) {
    const expanded = expandedTodayNoteId === note.id;
    const previewText = entryPreview(note, trackedIds);
    const fullText = noteBodyText(note);
    const processing = isTrackedProcessing(note, trackedIds);
    const isLoading = loadingNoteId === note.id;

    return (
      <div
        key={note.id}
        className={`today-note-entry${expanded ? ' expanded' : ''}${processing ? ' in-flight' : ''}`}
      >
        <div className={`today-note-entry-header${expanded ? ' expanded' : ''}`}>
          <button
            type="button"
            className="today-note-entry-row"
            onClick={() => toggleTodayNoteExpand(note)}
            aria-expanded={expanded}
          >
            {!expanded && (
              <div className={`entry-text${processing ? ' pending' : ''}`}>
                {processing ? 'Processing…' : previewText}
              </div>
            )}
            {!processing && note.tags?.length > 0 && (
              <TagPills
                tags={note.tags}
                noteId={note.id}
                onTagClick={searchByTag}
                onTagRemove={handleRemoveTag}
                editable
              />
            )}
            <div className="entry-meta">
              <div
                className={`entry-dot${processing ? ' pending' : ''}${note.source === 'voice' && !processing ? ' voice' : ''}`}
              />
              <span>{processing ? 'processing' : formatNoteTime(note.created_at)}</span>
            </div>
          </button>
          {expanded && !processing && (
            <div className="today-note-entry-actions">
              <button
                type="button"
                className="today-icon-btn today-icon-btn--open"
                onClick={() => openTodayNote(note)}
                aria-label="Open note"
              >
                <IconExternalOpen />
              </button>
              <button
                type="button"
                className="today-icon-btn today-icon-btn--delete"
                aria-label="Delete note"
                onClick={() => {
                  setExpandedTodayNoteId(null);
                  handleDeleteNote(note.id);
                }}
              >
                <IconTrash />
              </button>
            </div>
          )}
        </div>
        <div className={`today-note-entry-body-wrap${expanded ? ' open' : ''}`}>
          <div className="today-note-entry-body-inner">
            {!processing && (
              <div
                className="today-note-entry-body"
                onClick={collapseTodayNote}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    collapseTodayNote();
                  }
                }}
                role="button"
                tabIndex={expanded ? 0 : -1}
                aria-label="Collapse note"
              >
                {isLoading ? 'Loading…' : fullText}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderFeedEntry(note) {
    return (
      <button
        key={note.id}
        type="button"
        className={`entry${selectedNote?.id === note.id ? ' active' : ''}${isTrackedProcessing(note, trackedIds) ? ' in-flight' : ''}`}
        onClick={() => openNote(note)}
      >
        <div className={`entry-text${isTrackedProcessing(note, trackedIds) ? ' pending' : ''}`}>
          {entryPreview(note, trackedIds)}
        </div>
        {!isTrackedProcessing(note, trackedIds) && (
          <TagPills
            tags={note.tags}
            noteId={note.id}
            onTagClick={searchByTag}
            onTagRemove={handleRemoveTag}
            editable
          />
        )}
        <div className="entry-meta">
          <div
            className={`entry-dot${isTrackedProcessing(note, trackedIds) ? ' pending' : ''}${note.source === 'voice' && !isTrackedProcessing(note, trackedIds) ? ' voice' : ''}`}
          />
          <span>{isTrackedProcessing(note, trackedIds) ? 'processing' : formatNoteTime(note.created_at)}</span>
        </div>
      </button>
    );
  }

  function renderEntryList(notesList, { grouped: byGroup = false } = {}) {
    if (textSubmitting && sidebarView === 'today') {
      return (
        <>
          {optimisticTextEntry}
          {notesList.map((note) => renderFeedEntry(note))}
        </>
      );
    }
    if (byGroup) {
      return grouped.map((group) => (
        <div key={group.label}>
          <div className="group-label">{group.label}</div>
          {group.notes.map((note) => renderFeedEntry(note))}
        </div>
      ));
    }
    return notesList.map((note) => renderFeedEntry(note));
  }

  const sidebarRetrievePanel = (
    <>
      <div className="retrieve-search-bar">
        <svg viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={retrieveInputRef}
          className="retrieve-input"
          type="text"
          placeholder="What did I say about…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {userTags.length > 0 && (
        <div className="retrieve-chips">
          {userTags.map((chip) => (
            <button key={chip} type="button" className="chip" onClick={() => setQuery(chip)}>
              {chip}
            </button>
          ))}
        </div>
      )}
      <div className="retrieve-results">
        {searchLoading && <div className="search-loading">Searching…</div>}
        {retrieveEmpty && !searchLoading ? (
          <div className="retrieve-empty">
            <div className="retrieve-empty-head">{retrieveEmpty.head}</div>
            <div className="retrieve-empty-sub">{retrieveEmpty.sub}</div>
          </div>
        ) : (
          !searchLoading &&
          results.map((result, i) => (
            <div key={`${result.note_id}-${i}`} className="result-item">
              <div className="result-text">{highlightText(result.text, query)}</div>
              <div className="result-meta">{formatResultMeta(result.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </>
  );

  function renderPagination(page, setPage, totalPages, onPageChange) {
    if (feedNotes.length <= NOTES_PAGE_SIZE) return null;
    return (
      <div className="entries-pagination">
        <button
          type="button"
          className="all-notes-page-btn"
          disabled={page <= 1}
          onClick={() => {
            onPageChange?.();
            setPage((p) => p - 1);
          }}
        >
          Previous
        </button>
        <span className="all-notes-page-label">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="all-notes-page-btn"
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange?.();
            setPage((p) => p + 1);
          }}
        >
          Next
        </button>
      </div>
    );
  }

  const allNotesPanel = (
    <div className="all-notes-main">
      <div className="all-notes-header">
        <h1 className="all-notes-title">All notes</h1>
        <p className="all-notes-sub">
          {feedNotes.length === 0
            ? '0 entries'
            : `${allNotesRangeStart}–${allNotesRangeEnd} of ${feedNotes.length} entries`}
        </p>
      </div>
      <div className="all-notes-list">
        {feedNotes.length === 0 && !textSubmitting ? (
          feedEmpty
        ) : (
          <>
            {textSubmitting && allNotesPage === 1 && optimisticTextEntry}
            {renderAllNotesList()}
          </>
        )}
      </div>
      {renderPagination(allNotesPage, setAllNotesPage, notesTotalPages, () =>
        setExpandedAllNoteId(null),
      )}
    </div>
  );

  const todayNotesPanel = (
    <div className="today-notes-panel">
      {!query.trim() && <div className="today-section-label">Today&apos;s notes</div>}
      <div className="today-notes-list">
        {query.trim() ? (
          <div className="today-retrieve-results">{retrieveResults}</div>
        ) : feedNotes.length === 0 && !textSubmitting ? (
          feedEmpty
        ) : (
          <>
            {textSubmitting && todayPage === 1 && optimisticTextEntry}
            {paginatedTodayNotes.map((note) => renderTodayEntry(note))}
          </>
        )}
      </div>
      {!query.trim() && renderPagination(todayPage, setTodayPage, notesTotalPages, () =>
        setExpandedTodayNoteId(null),
      )}
    </div>
  );

  const recordComposeBlock = (
    <div className="compose-top">
      <div className="record-header">{recordControls}</div>
      {composeArea}
      {userTags.length > 0 && (
        <div className="compose-prompts">
          {userTags.slice(0, 8).map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip"
              onClick={() => {
                if (!text.trim()) {
                  setText(`Thinking about ${tag}…`);
                  resizeCompose(composeInputRef.current);
                  composeInputRef.current?.focus();
                }
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const todayTopBlock = (
    <div className="today-top">
      <div
        className={`today-capture-pill${todayTextOpen ? ' typing' : ''}${recording ? ' recording' : ''}${textSubmitting ? ' submitting' : ''}`}
      >
        <button
          type="button"
          className="today-pill-record"
          onClick={toggleRecord}
          disabled={hasVoiceInFlight}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          <span className={`today-pill-mic${recording ? ' recording' : ''}`}>
            {recording ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="2" fill="white" stroke="white" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
              </svg>
            )}
          </span>
          <span className="today-pill-record-label">
            {recording ? formatTime(secs) : 'Record'}
          </span>
        </button>
        <div className="today-pill-divider" aria-hidden="true" />
        <div className="today-pill-type">
          {todayTextOpen ? (
            <>
              <svg className="today-pill-pencil" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <textarea
                ref={todayComposeInputRef}
                className="today-capture-input"
                placeholder={composePlaceholder}
                rows={1}
                value={text}
                disabled={textSubmitting}
                onChange={(e) => {
                  setText(e.target.value);
                  resizeCompose(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
              />
              {textSubmitting ? (
                <div className="compose-spinner" aria-label="Saving">
                  <span className="compose-spinner-ring" />
                </div>
              ) : (
                <button
                  type="button"
                  className={`compose-send${text.trim() ? ' visible' : ''}`}
                  onClick={handleSendText}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="today-pill-type-trigger"
              onClick={openTodayTextCompose}
            >
              <svg className="today-pill-pencil" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span>or type a note…</span>
            </button>
          )}
        </div>
      </div>
      {todayRetrieveBar}
    </div>
  );

  const bannerMessage = uploadError || toast;
  const isErrorBanner =
    Boolean(uploadError) || (toast && !SUCCESS_TOASTS.has(toast));

  return (
    <div className={`app-layout${isMobile ? ' mobile' : ''}`}>
      <header className="topbar">
        <a href="/" className="brand">
          <LogoMark size={isMobile ? 24 : 22} />
          seam
        </a>
        <div className="topbar-spacer" />
        <div className="topbar-right">
          {streak > 0 && (
            <div className="nav-streak">
              <div className="streak-pip" />
              {streak} {streak === 1 ? 'day' : 'days'}
            </div>
          )}
          <Link
            to="/settings"
            className="nav-avatar"
            title="Settings"
            aria-label="Settings"
          >
            {userInitial}
          </Link>
        </div>
      </header>

      <div
        className={`app-banner${bannerMessage ? ' show' : ''}${isErrorBanner ? ' error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {bannerMessage}
      </div>

      {isMobile ? (
        <main className="mobile-main">
          {selectedNote ? (
            entryReader
          ) : (
            <>
              <div className="mobile-record-section">
                <div className="record-header">{recordControls}</div>
                {composeArea}
              </div>
              <div className="mobile-bottom-area">
                <div className="mobile-entries">
                  {feedNotes.length === 0 && !textSubmitting ? (
                    feedEmpty
                  ) : (
                    <>
                      {textSubmitting && mobileEntriesPage === 1 && (
                        <>
                          <div className="entry-group-label">Today</div>
                          {optimisticTextEntry}
                        </>
                      )}
                      {mobileGrouped.map((group) => (
                        <div key={group.label}>
                          <div className="entry-group-label">{group.label}</div>
                          {group.notes.map((note) => (
                            <button
                              key={note.id}
                              type="button"
                              className={`entry entry-mobile${selectedNote?.id === note.id ? ' active' : ''}${isTrackedProcessing(note, trackedIds) ? ' in-flight' : ''}`}
                              onClick={() => openNote(note)}
                            >
                              <div
                                className={`entry-dot${isTrackedProcessing(note, trackedIds) ? ' pending' : ''}${note.source === 'voice' && !isTrackedProcessing(note, trackedIds) ? ' voice' : ''}`}
                              />
                              <div className="entry-body">
                                <div className={`entry-text${isTrackedProcessing(note, trackedIds) ? ' pending' : ''}`}>
                                  {entryPreview(note, trackedIds)}
                                </div>
                                <div className="entry-meta">
                                  <span>{isTrackedProcessing(note, trackedIds) ? 'processing' : formatNoteTime(note.created_at)}</span>
                                  {!isTrackedProcessing(note, trackedIds) && note.tags?.[0] && (
                                    <span className="entry-tag">{note.tags[0]}</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {renderPagination(mobileEntriesPage, setMobileEntriesPage, notesTotalPages)}
                <div className="mobile-bottom-bar">
                  <button type="button" className="mobile-retrieve-row" onClick={openSearch}>
                    <div className="retrieve-icon">
                      <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <span className="retrieve-label">Retrieve</span>
                    <span className="retrieve-hint">Ask anything</span>
                  </button>
                  <div className="safe-area" />
                </div>
              </div>
            </>
          )}
          <div className={`search-overlay${searchOpen ? ' open' : ''}`}>
            <div className="search-bar">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={retrieveInputRef}
                className="search-field"
                type="text"
                placeholder="What did I say about…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="button" className="search-cancel" onClick={closeSearch}>
                Cancel
              </button>
            </div>
            {userTags.length > 0 && (
              <div className="search-chips">
                {userTags.map((chip) => (
                  <button key={chip} type="button" className="chip" onClick={() => setQuery(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <div className="search-results">{retrieveResults}</div>
          </div>
        </main>
      ) : (
      <div className="app-body desktop-only">
        <aside className={`col-feed${sidebarView === 'retrieve' ? ' with-feed' : ' nav-only'}`}>
          <nav className="sidebar-nav" aria-label="Sidebar">
            <div className="sidebar-section-label">Core</div>
            <button
              type="button"
              className={`sidebar-nav-item${sidebarView === 'today' ? ' active' : ''}`}
              onClick={() => selectSidebarView('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`sidebar-nav-item${sidebarView === 'record' ? ' active' : ''}`}
              onClick={() => selectSidebarView('record')}
            >
              Record
            </button>
            <button
              type="button"
              className={`sidebar-nav-item${sidebarView === 'retrieve' ? ' active' : ''}`}
              onClick={() => selectSidebarView('retrieve')}
            >
              Retrieve
            </button>
            <div className="sidebar-section-label">Library</div>
            <button
              type="button"
              className={`sidebar-nav-item${sidebarView === 'all' ? ' active' : ''}`}
              onClick={() => selectSidebarView('all')}
            >
              All notes
            </button>
          </nav>

          {sidebarView === 'retrieve' && (
          <div className="feed feed-retrieve">
            {sidebarRetrievePanel}
          </div>
          )}
        </aside>

        <div className="col-main">
          {selectedNote ? (
            entryReader
          ) : sidebarView === 'all' ? (
            allNotesPanel
          ) : sidebarView === 'today' ? (
            <>
              {todayTopBlock}
              {todayNotesPanel}
            </>
          ) : (
            recordComposeBlock
          )}
        </div>
      </div>
      )}
    </div>
  );
}
