import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import { api, getToken } from '../api';
import { useAuth } from '../context/AuthContext';

const MAX_RECORDING_SECS = 300;

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

function formatNoteTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
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

export default function Record() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(location.pathname === '/search' ? 'retrieve' : 'record');

  useEffect(() => {
    setTab(location.pathname === '/search' ? 'retrieve' : 'record');
  }, [location.pathname]);

  const [text, setText] = useState('');
  const [notes, setNotes] = useState([]);
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [pendingNote, setPendingNote] = useState(null);
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

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secsRef = useRef(0);
  const retrieveInputRef = useRef(null);
  const composeInputRef = useRef(null);
  const debounceRef = useRef(null);
  const toastTimerRef = useRef(null);

  function resizeCompose(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  const loadNotes = useCallback(async () => {
    try {
      const data = await api.listNotes();
      setNotes(data.results || []);
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
    if (!pendingNote) return undefined;
    const interval = setInterval(async () => {
      try {
        const note = await api.getNote(pendingNote.id);
        if (note.status === 'ready') {
          setPendingNote(null);
          loadNotes();
          loadTags();
          showToast('Indexed');
        } else if (note.status === 'failed') {
          setPendingNote(null);
          setUploadError('Upload failed. Try again.');
        }
      } catch {
        setPendingNote(null);
        setUploadError('Something went wrong.');
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pendingNote, loadNotes, loadTags]);

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

  function closeNote() {
    setSelectedNote(null);
  }

  function openNote(note) {
    setSelectedNote(note);
  }

  function switchTab(name) {
    setSelectedNote(null);
    setTab(name);
    navigate(name === 'retrieve' ? '/search' : '/record', { replace: true });
    if (name === 'retrieve') {
      setTimeout(() => retrieveInputRef.current?.focus(), 50);
    }
  }

  function searchByTag(tag) {
    setSelectedNote(null);
    setTab('retrieve');
    setQuery(tag);
    navigate('/search', { replace: true });
    setTimeout(() => retrieveInputRef.current?.focus(), 50);
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

    try {
      await api.createTextNote(trimmed);
      loadNotes();
      showToast('Saved');
      window.setTimeout(() => {
        loadNotes();
        loadTags();
      }, 4000);
    } catch {
      setText(trimmed);
      resizeCompose(composeInputRef.current);
      showToast('Failed');
    } finally {
      setTextSubmitting(false);
      setPendingText('');
    }
  }

  async function startRecording() {
    if (pendingNote) return;
    setUploadError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!getToken()) {
          setUploadError('Session expired. Sign in again to save recordings.');
          return;
        }
        try {
          const note = await api.createVoiceNote(blob, secsRef.current);
          setPendingNote(note);
        } catch (err) {
          setUploadError(
            err.message === 'Unauthorized'
              ? 'Session expired. Sign in again to save recordings.'
              : 'Upload failed. Try again.',
          );
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSecs(0);
      secsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          const next = s + 1;
          secsRef.current = next;
          if (next >= MAX_RECORDING_SECS) {
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

  const readyNotes = notes.filter((n) => n.status === 'ready');
  const grouped = groupNotes(readyNotes);
  const streak = computeStreak(notes);
  const userInitial = user?.email?.[0]?.toUpperCase() || '?';
  const composePlaceholder = userTags.length
    ? `What's on your mind about ${userTags[0]}…`
    : "What's on your mind…";

  let retrieveEmpty = null;
  if (!query.trim()) {
    retrieveEmpty = { head: 'Ask anything', sub: "Seam pulls from everything you've said" };
  } else if (searched && !searchLoading && results.length === 0) {
    retrieveEmpty = { head: 'Nothing yet', sub: "You haven't said anything about this" };
  }

  return (
    <div className="app-layout">
      <header className="topbar">
        <a href="/" className="brand">
          <LogoMark size={22} />
          seam
        </a>
        <div className="topbar-spacer" />
        <div className="topbar-right">
          <button
            type="button"
            className={`topbar-retrieve${tab === 'retrieve' ? ' active' : ''}`}
            onClick={() => switchTab('retrieve')}
          >
            Retrieve
          </button>
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

      <div className="app-body">
        <aside className="col-feed">
          {tab === 'record' ? (
            <>
              <div className="feed-header">
                <span className="feed-title">Entries</span>
              </div>
              <div className="feed">
                {(pendingNote || textSubmitting) && (
                  <>
                    <div className="group-label">Today</div>
                    {textSubmitting && (
                      <div className="entry">
                        <div className="entry-text pending">{pendingText}</div>
                        <div className="entry-meta">
                          <div className="entry-dot pending" />
                          <span>processing</span>
                        </div>
                      </div>
                    )}
                    {pendingNote && (
                      <div className="entry">
                        <div className="entry-text pending">Processing…</div>
                        <div className="entry-meta">
                          <div className="entry-dot voice" />
                          <span>now</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {grouped.length === 0 && !pendingNote && !textSubmitting ? (
                  <div className="feed-empty">
                    <p className="feed-empty-head">No entries yet</p>
                    <p className="feed-empty-sub">Your recordings will appear here</p>
                  </div>
                ) : (
                  grouped.map((group) => (
                    <div key={group.label}>
                      <div className="group-label">{group.label}</div>
                      {group.notes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          className={`entry${selectedNote?.id === note.id ? ' active' : ''}`}
                          onClick={() => openNote(note)}
                        >
                          <div className="entry-text">
                            {note.cleaned_text || note.raw_transcript || '…'}
                          </div>
                          <TagPills
                            tags={note.tags}
                            noteId={note.id}
                            onTagClick={searchByTag}
                            onTagRemove={handleRemoveTag}
                            editable
                          />
                          <div className="entry-meta">
                            <div className={`entry-dot${note.source === 'voice' ? ' voice' : ''}`} />
                            <span>{formatNoteTime(note.created_at)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="col-retrieve">
              <div className="feed-header">
                <span className="feed-title">Retrieve</span>
              </div>
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
                      <div className="result-text">
                        {highlightText(result.text, query)}
                      </div>
                      <div className="result-meta">
                        {formatResultMeta(result.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>

        <div className="col-main">
          {selectedNote ? (
            <div className="entry-reader">
              <div className="entry-reader-toolbar">
                <button type="button" className="entry-reader-back" onClick={closeNote}>
                  ← Record
                </button>
                <button
                  type="button"
                  className="entry-reader-delete"
                  onClick={() => handleDeleteNote(selectedNote.id)}
                >
                  Delete
                </button>
              </div>
              <div className="entry-reader-scroll">
                <div className="entry-reader-meta">
                  <span className="entry-reader-date">
                    {formatReaderDate(selectedNote.created_at)}
                  </span>
                  <span className="entry-reader-time">
                    {formatReaderTime(selectedNote.created_at)}
                  </span>
                  <span className="entry-reader-tags">
                    <span
                      className={`entry-reader-tag${selectedNote.source === 'voice' ? ' voice' : ''}`}
                    >
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
                  {selectedNote.cleaned_text || selectedNote.raw_transcript || '…'}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="compose-top">
                <div className="record-header">
                  <div className={`record-glow${recording ? ' active' : ''}`}>
                    <button
                      type="button"
                      className={`record-btn${recording ? ' recording' : ''}`}
                      onClick={toggleRecord}
                      disabled={!!pendingNote}
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
                  <div className={`record-timer${recording ? ' visible' : ''}`}>
                    {formatTime(secs)}
                  </div>
                </div>
                <div className={`compose-row${textSubmitting ? ' submitting' : ''}`}>
                  <textarea
                    ref={composeInputRef}
                    className="compose-input"
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
                </div>
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
              {uploadError && <p className="upload-error">{uploadError}</p>}
            </>
          )}
        </div>
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
