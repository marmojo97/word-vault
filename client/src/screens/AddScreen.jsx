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

export default function AddScreen({ showToast }) {
  const [parsedForm, setParsedForm] = useState(null);
  const [manualForm, setManualForm] = useState({ ...EMPTY_FORM });
  const [parsing, setParsing] = useState(false);
  const [savingParsed, setSavingParsed] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast('Please drop an image');
      return;
    }
    setParsing(true);
    setParsedForm(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await api.parseScreenshot(dataUrl, file.type);
      setParsedForm({
        word: result.word ?? '',
        part_of_speech: result.part_of_speech ?? '',
        definition: result.definition ?? '',
        example_sentence: result.example_sentence ?? '',
        source: 'screenshot'
      });
    } catch (err) {
      showToast('Could not parse: ' + err.message);
    } finally {
      setParsing(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // allow picking the same file again
  }

  async function saveParsed() {
    if (!parsedForm.word.trim() || !parsedForm.definition.trim()) {
      showToast('Word and definition required');
      return;
    }
    setSavingParsed(true);
    try {
      await api.addWord(parsedForm);
      showToast('Word saved to your vault');
      setParsedForm(null);
    } catch (err) {
      showToast('Save failed: ' + err.message);
    } finally {
      setSavingParsed(false);
    }
  }

  async function saveManual() {
    if (!manualForm.word.trim() || !manualForm.definition.trim()) {
      showToast('Word and definition required');
      return;
    }
    setSavingManual(true);
    try {
      await api.addWord(manualForm);
      showToast('Word saved to your vault');
      setManualForm({ ...EMPTY_FORM });
    } catch (err) {
      showToast('Save failed: ' + err.message);
    } finally {
      setSavingManual(false);
    }
  }

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
        <div className="label">Upload a screenshot</div>
        <div className="hint">Claude reads it automatically</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickFile}
        />
      </div>

      {parsing && (
        <div className="loading-block">
          <div className="spinner" />
          <div className="muted" style={{ marginTop: 10 }}>Reading your screenshot…</div>
        </div>
      )}

      {parsedForm && !parsing && (
        <div className="form" style={{ marginTop: 18 }}>
          <div className="section-label">Confirm and save</div>
          <WordFields form={parsedForm} setForm={setParsedForm} />
          <button
            className="btn primary full"
            disabled={savingParsed}
            onClick={saveParsed}
          >
            {savingParsed ? 'Saving…' : 'Save word'}
          </button>
        </div>
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

function WordFields({ form, setForm }) {
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
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
