import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'new',       label: 'New' },
  { id: 'learning',  label: 'Learning' },
  { id: 'mastered',  label: 'Mastered' }
];

const SORTS = [
  { id: 'date',    label: 'Date added' },
  { id: 'alpha',   label: 'Alphabetical' },
  { id: 'mastery', label: 'Mastery' }
];

const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb',
  'pronoun', 'preposition', 'conjunction', 'interjection'
];

function pips(score) {
  return Array.from({ length: 5 }).map((_, i) => (
    <span key={i} className={'mastery-pip' + (i < score ? ' filled' : '')} />
  ));
}

export default function VaultScreen({ streak, showToast }) {
  const [words, setWords] = useState([]);
  const [allWords, setAllWords] = useState([]); // for top-stat counts
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('date');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail / edit modal
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  async function reload() {
    setLoading(true);
    try {
      const [filtered, all] = await Promise.all([
        api.listWords(sort, filter),
        api.listWords('date', 'all')
      ]);
      setWords(filtered);
      setAllWords(all);
    } catch (err) {
      showToast('Could not load: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, sort]);

  // Top stat cards always reflect the full collection.
  const total = allWords.length;
  const mastered = allWords.filter((w) => w.mastery_score === 5).length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const addedThisMonth = allWords.filter((w) => {
    const d = new Date(w.date_added.replace(' ', 'T') + 'Z');
    return d >= monthStart;
  }).length;

  function openDetail(w) {
    setSelected(w);
    setEditing(false);
    setEditForm(null);
  }
  function closeDetail() {
    setSelected(null);
    setEditing(false);
    setEditForm(null);
  }
  function startEdit() {
    if (!selected) return;
    setEditForm({ ...selected });
    setEditing(true);
  }

  async function saveEdit() {
    if (!editForm) return;
    if (!editForm.word.trim() || !editForm.definition.trim()) {
      showToast('Word and definition required');
      return;
    }
    try {
      const updated = await api.updateWord(editForm.id, {
        word: editForm.word,
        part_of_speech: editForm.part_of_speech,
        definition: editForm.definition,
        example_sentence: editForm.example_sentence,
        source: editForm.source
      });
      showToast('Word updated');
      setSelected(updated);
      setEditing(false);
      setEditForm(null);
      reload();
    } catch (err) {
      showToast('Save failed: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this word? This cannot be undone.')) return;
    try {
      await api.deleteWord(id);
      showToast('Word deleted');
      closeDetail();
      reload();
    } catch (err) {
      showToast('Delete failed: ' + err.message);
    }
  }

  return (
    <div>
      <div className="screen-title">Vault</div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total words</div>
          <div className="value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Mastered</div>
          <div className="value">{mastered}</div>
        </div>
        <div className="stat-card">
          <div className="label">Streak</div>
          <div className="value">{streak}</div>
        </div>
        <div className="stat-card">
          <div className="label">Added this month</div>
          <div className="value">{addedThisMonth}</div>
        </div>
      </div>

      <input
        type="search"
        className="search-input"
        placeholder="Search words, definitions, sources…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search vault"
      />

      <div className="controls">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={'chip' + (filter === f.id ? ' active' : '')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <select
          className="sort-toggle"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort by"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {(() => {
        const q = search.trim().toLowerCase();
        const displayed = q
          ? words.filter((w) =>
              w.word.toLowerCase().includes(q) ||
              w.definition.toLowerCase().includes(q) ||
              (w.source && w.source.toLowerCase().includes(q)) ||
              (w.example_sentence && w.example_sentence.toLowerCase().includes(q))
            )
          : words;

        return (
          <>
            {!loading && (
              <div className="result-count">
                Showing {displayed.length} of {allWords.length} word{allWords.length === 1 ? '' : 's'}
                {q && ` matching "${search.trim()}"`}
              </div>
            )}
            {loading && <div className="loading-block"><div className="spinner" /></div>}
            {!loading && displayed.length === 0 && (
              <div className="empty">
                {q ? `No words matching "${search.trim()}".` : 'No words match this filter.'}
              </div>
            )}
            <div className="vault-list">
              {displayed.map((w) => (
          <div
            key={w.id}
            className={'vault-row' + (w.mastery_score === 5 ? ' mastered' : '')}
            onClick={() => openDetail(w)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDetail(w);
              }
            }}
          >
            <div>
              <div>
                <span className="word">{w.word}</span>
                {w.part_of_speech && <span className="pos">· {w.part_of_speech}</span>}
              </div>
              <div className="mastery-pips">{pips(w.mastery_score)}</div>
            </div>
            {w.source && <span className="source-badge">{w.source}</span>}
          </div>
        ))}
            </div>
          </>
        );
      })()}

      {selected && !editing && (
        <Modal title={selected.word} onClose={closeDetail}>
          {selected.part_of_speech && (
            <span className="pos-badge">{selected.part_of_speech}</span>
          )}
          <div className="definition">{selected.definition}</div>
          {selected.example_sentence && (
            <div className="example">&ldquo;{selected.example_sentence}&rdquo;</div>
          )}
          <div className="detail-meta">
            {selected.source && <>Source: <strong>{selected.source}</strong> · </>}
            Mastery: <strong>{selected.mastery_score}/5</strong> ·{' '}
            Seen {selected.times_seen} time{selected.times_seen === 1 ? '' : 's'}
          </div>
          <div className="detail-row">
            <button className="btn" style={{ flex: 1 }} onClick={startEdit}>Edit</button>
            <button
              className="btn danger"
              style={{ flex: 1 }}
              onClick={() => handleDelete(selected.id)}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {selected && editing && editForm && (
        <Modal title={`Edit: ${selected.word}`} onClose={() => setEditing(false)}>
          <div className="form">
            <div className="field">
              <label>Word</label>
              <input
                value={editForm.word}
                onChange={(e) => setEditForm((f) => ({ ...f, word: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Part of speech</label>
              <select
                value={editForm.part_of_speech || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, part_of_speech: e.target.value }))}
              >
                <option value="">—</option>
                {PARTS_OF_SPEECH.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Definition</label>
              <textarea
                value={editForm.definition}
                onChange={(e) => setEditForm((f) => ({ ...f, definition: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Example sentence</label>
              <textarea
                value={editForm.example_sentence || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, example_sentence: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Source</label>
              <input
                value={editForm.source || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
              />
            </div>
            <button className="btn primary full" onClick={saveEdit}>Save changes</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
