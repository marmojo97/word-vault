import { useRef, useState } from 'react';
import { api } from '../api.js';

const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb',
  'pronoun', 'preposition', 'conjunction', 'interjection'
];

const EMPTY_FORM = {
  word: '',
  part_of_speech: '',
  definition: '',
  example_sentence: '',
  source: ''
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function AddScreen({ showToast }) {
  // Each item: { id, file, fileName, status, form, error }
  // status: 'parsing' | 'ready' | 'saving' | 'saved' | 'error'
  const [items, setItems] = useState([]);
  const [manualForm, setManualForm] = useState({ ...EMPTY_FORM });
  const [savingManual, setSavingManual] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  function updateItem(id, patch) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function parseOne(item) {
    try {
      const dataUrl = await fileToDataUrl(item.file);
      const result = await api.parseScreenshot(dataUrl, item.file.type);
      updateItem(item.id, {
        status: 'ready',
        error: null,
        form: {
          word: result.word ?? '',
          part_of_speech: result.part_of_speech ?? '',
          definition: result.definition ?? '',
          example_sentence: result.example_sentence ?? '',
          source: 'screenshot'
        }
      });
    } catch (err) {
      updateItem(item.id, { status: 'error', error: err.message });
    }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter(
      (f) => f.type && f.type.startsWith('image/')
    );
    if (files.length === 0) {
      showToast('Please drop image files');
      return;
    }
    const newItems = files.map((file) => ({
      id: newId(),
      file,
      fileName: file.name,
      status: 'parsing',
      form: null,
      error: null
    }));
    // Newest on top so long batches don't push the drop zone offscreen forever
    setItems((prev) => [...newItems, ...prev]);
    newItems.forEach(parseOne);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }
  function onPickFile(e) {
    handleFiles(e.target.files);
    e.target.value = '';
  }

  async function saveItem(id) {
    // Read the latest state via a functional update to avoid stale closures.
    let current;
    setItems((prev) => {
      current = prev.find((i) => i.id === id);
      return prev;
    });
    if (!current || !current.form) return false;
    if (!current.form.word.trim() || !current.form.definition.trim()) {
      showToast('Word and definition required');
      return false;
    }
    updateItem(id, { status: 'saving' });
    try {
      await api.addWord(current.form);
      updateItem(id, { status: 'saved' });
      showToast(`Saved "${current.form.word}"`);
      // Auto-clear saved cards after a beat
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 1400);
      return true;
    } catch (err) {
      updateItem(id, { status: 'ready' });
      showToast('Save failed: ' + err.message);
      return false;
    }
  }

  async function saveAll() {
    const ready = items.filter((i) => i.status === 'ready');
    // Serialize saves so the toast messages don't all overwrite each other
    for (const item of ready) {
      // eslint-disable-next-line no-await-in-loop
      await saveItem(item.id);
    }
  }

  function retryItem(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateItem(id, { status: 'parsing', error: null });
    parseOne(item);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function saveManual() {
    if (!manualForm.word.trim() || !manualForm.definition.trim()) {
      showToast('Word and definition required');
      return;
    }
    setSavingManual(true);
    try {
      await api.addWord(manualForm);
      showToast('Word saved');
      setManualForm({ ...EMPTY_FORM });
    } catch (err) {
      showToast('Save failed: ' + err.message);
    } finally {
      setSavingManual(false);
    }
  }

  const readyCount = items.filter((i) => i.status === 'ready').length;
  const parsingCount = items.filter((i) => i.status === 'parsing').length;

  return (
    <div>
      <div className="screen-title">Add</div>

      <div
        className={'dropzone' + (dragging ? ' dragging' : '')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        <div className="icon" aria-hidden="true">📸</div>
        <div className="label">Upload screenshots</div>
        <div className="hint">Drop one or many — Claude reads them all</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onPickFile}
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="batch-header">
            <div className="muted" style={{ fontSize: 13 }}>
              {parsingCount > 0 && `Parsing ${parsingCount}… `}
              {readyCount > 0 && `${readyCount} ready to save`}
              {parsingCount === 0 && readyCount === 0 && `${items.length} item${items.length === 1 ? '' : 's'}`}
            </div>
            {readyCount > 1 && (
              <button className="btn primary" onClick={saveAll}>
                Save all ({readyCount})
              </button>
            )}
          </div>
          {items.map((item) => (
            <ParseCard
              key={item.id}
              item={item}
              onFormChange={(newForm) => updateItem(item.id, { form: newForm })}
              onSave={() => saveItem(item.id)}
              onRemove={() => removeItem(item.id)}
              onRetry={() => retryItem(item.id)}
            />
          ))}
        </>
      )}

      <div className="divider">or add manually</div>

      <div className="form">
        <WordFields form={manualForm} setForm={setManualForm} />
        <button
          className="btn primary full"
          disabled={savingManual}
          onClick={saveManual}
        >
          {savingManual ? 'Saving…' : 'Save word'}
        </button>
      </div>
    </div>
  );
}

function ParseCard({ item, onFormChange, onSave, onRemove, onRetry }) {
  const { status, form, error, fileName } = item;
  return (
    <div className={'parse-card status-' + status}>
      <div className="parse-card-header">
        <div className="parse-card-title">
          {status === 'saved' && <span style={{ color: 'var(--green)' }}>✓ </span>}
          {form?.word || fileName || 'Screenshot'}
        </div>
        <button
          className="parse-card-remove"
          onClick={onRemove}
          aria-label="Remove"
        >
          ×
        </button>
      </div>

      {status === 'parsing' && (
        <div className="parse-card-status">
          <span
            className="spinner"
            style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', verticalAlign: 'middle', margin: 0 }}
          />
          <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>Reading screenshot…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="parse-card-status" style={{ color: 'var(--danger)' }}>
          Failed: {error}{' '}
          <button
            className="btn"
            style={{ marginLeft: 8, padding: '4px 10px', fontSize: 12 }}
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}

      {(status === 'ready' || status === 'saving') && form && (
        <div className="form" style={{ marginTop: 10 }}>
          <WordFields form={form} setForm={onFormChange} />
          <button
            className="btn primary full"
            onClick={onSave}
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving…' : 'Save word'}
          </button>
        </div>
      )}

      {status === 'saved' && (
        <div className="parse-card-status" style={{ color: 'var(--green)' }}>
          Saved to your vault
        </div>
      )}
    </div>
  );
}

function WordFields({ form, setForm }) {
  const set = (key, val) => setForm({ ...form, [key]: val });
  return (
    <>
      <div className="field">
        <label>Word</label>
        <input
          value={form.word}
          onChange={(e) => set('word', e.target.value)}
          placeholder="e.g. ephemeral"
        />
      </div>
      <div className="field">
        <label>Part of speech</label>
        <select
          value={form.part_of_speech || ''}
          onChange={(e) => set('part_of_speech', e.target.value)}
        >
          <option value="">—</option>
          {PARTS_OF_SPEECH.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Definition</label>
        <textarea
          value={form.definition}
          onChange={(e) => set('definition', e.target.value)}
          placeholder="What does it mean?"
        />
      </div>
      <div className="field">
        <label>Example sentence</label>
        <textarea
          value={form.example_sentence || ''}
          onChange={(e) => set('example_sentence', e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="field">
        <label>Source</label>
        <input
          value={form.source || ''}
          onChange={(e) => set('source', e.target.value)}
          placeholder="e.g. Pachinko, NYT, screenshot"
        />
      </div>
    </>
  );
}
