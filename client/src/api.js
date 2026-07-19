// Tiny fetch wrapper for the Word Vault API. All routes are proxied through
// /api by Vite in dev. In production (Express serves the built client) this
// works the same.
const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let msg;
    try {
      const data = await res.json();
      msg = data.error ?? res.statusText;
    } catch {
      msg = res.statusText;
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listWords: (sort = 'date', filter = 'all') =>
    req(`/words?sort=${encodeURIComponent(sort)}&filter=${encodeURIComponent(filter)}`),
  today: () => req('/words/today'),
  flashcards: () => req('/words/flashcards'),
  getWord: (id) => req(`/words/${id}`),
  addWord: (data) => req('/words', { method: 'POST', body: JSON.stringify(data) }),
  parseScreenshot: (image, media_type) =>
    req('/words/parse-screenshot', {
      method: 'POST',
      body: JSON.stringify({ image, media_type })
    }),
  rateMastery: (id, result) =>
    req(`/words/${id}/mastery`, {
      method: 'PATCH',
      body: JSON.stringify({ result })
    }),
  updateWord: (id, data) =>
    req(`/words/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWord: (id) => req(`/words/${id}`, { method: 'DELETE' }),
  moreExamples: (id) => req(`/words/${id}/examples`, { method: 'POST' }),
  synonyms: (id) => req(`/words/${id}/synonyms`, { method: 'POST' })
};
