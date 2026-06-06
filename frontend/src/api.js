const BASE = '/api';
const TOKEN_KEY = 'seam_token';

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getToken() {
  return token();
}

export function setToken(value) {
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function logout() {
  const t = token();
  clearToken();
  if (t) {
    fetch(BASE + '/auth/logout/', {
      method: 'POST',
      headers: { Authorization: `Token ${t}` },
    }).catch(() => {});
  }
  window.location.href = '/login';
}

async function parseResponse(response) {
  if (response.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data.detail ||
      (typeof data === 'object' ? Object.values(data).flat().join(' ') : null) ||
      'Something went wrong. Try again.';
    throw new Error(message);
  }

  return data;
}

export async function authedFetch(path, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token() ? { Authorization: `Token ${token()}` } : {}),
    ...(opts.headers || {}),
  };

  const response = await fetch(BASE + path, { ...opts, headers });
  return parseResponse(response);
}

export async function publicFetch(path, opts = {}) {
  const response = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return parseResponse(response);
}

export const api = {
  register: (payload) =>
    publicFetch('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (email, password) =>
    publicFetch('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  createTextNote: (text) =>
    authedFetch('/notes/text/', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  createVoiceNote: (audioBlob, durationSecs) => {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    if (durationSecs != null) {
      form.append('duration_secs', String(durationSecs));
    }
    return authedFetch('/notes/voice/', { method: 'POST', body: form });
  },

  me: () => authedFetch('/auth/me/'),

  listNotes: () => authedFetch('/notes/'),

  getNote: (id) => authedFetch(`/notes/${id}/`),

  listTags: () => authedFetch('/tags/'),

  removeNoteTag: (id, tag) =>
    authedFetch(`/notes/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ remove_tag: tag }),
    }),

  deleteNote: (id) => authedFetch(`/notes/${id}/`, { method: 'DELETE' }),

  search: (query) =>
    authedFetch('/retrieve/search/', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
};
