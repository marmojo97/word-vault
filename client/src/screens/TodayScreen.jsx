import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function TodayScreen({ streak, showToast }) {
  const [data, setData] = useState({ today: null, tomorrow: null });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal state for "more examples" / "synonyms"
  const [modalKind, setModalKind] = useState(null); // 'examples' | 'synonyms' | null
  const [modalContent, setModalContent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [todayData, all] = await Promise.all([api.today(), api.listWords()]);
        if (cancelled) return;
        setData(todayData);
        setTotal(all.length);
      } catch (err) {
        if (!cancelled) showToast('Could not load: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  async function openModal(kind) {
    if (!data.today) return;
    setModalKind(kind);
    setModalContent(null);
    setModalLoading(true);
    try {
      const fn = kind === 'examples' ? api.moreExamples : api.synonyms;
      const result = await fn(data.today.id);
      setModalContent(kind === 'examples' ? result.examples : result.synonyms);
    } catch (err) {
      showToast('Could not load: ' + err.message);
      setModalKind(null);
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setModalKind(null);
    setModalContent(null);
  }

  if (loading) {
    return (
      <div className="loading-block">
        <div className="spinner" />
      </div>
    );
  }

  const { today, tomorrow } = data;

  return (
    <div>
      <div className="screen-title">Today</div>

      {!today && (
        <div className="empty">
          No words yet. Head over to the Add tab to start your vault.
        </div>
      )}

      {today && (
        <>
          <div className="card word-hero">
            <div className="word">{today.word}</div>
            {today.part_of_speech && (
              <span className="pos-badge">{today.part_of_speech}</span>
            )}
            <div className="definition">{today.definition}</div>
            {today.example_sentence && (
              <div className="example">&ldquo;{today.example_sentence}&rdquo;</div>
            )}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => openModal('examples')}
            >
              more examples
            </button>
            <button
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => openModal('synonyms')}
            >
              synonyms
            </button>
          </div>

          <div className="mini-stats">
            <div>
              <strong>{streak}</strong> day{streak === 1 ? '' : 's'} streak
            </div>
            <div>
              <strong>{total}</strong> word{total === 1 ? '' : 's'} collected
            </div>
          </div>

          {tomorrow && (
            <div className="card locked-card">
              <div className="section-label">Coming tomorrow</div>
              <div className="blur-cover" style={{ marginTop: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{tomorrow.word}</div>
                <div className="example" style={{ marginTop: 4 }}>
                  {tomorrow.definition}
                </div>
              </div>
              <div className="lock-overlay">🔒 Locked until tomorrow</div>
            </div>
          )}
        </>
      )}

      {modalKind && today && (
        <Modal
          title={modalKind === 'examples'
            ? `More examples: ${today.word}`
            : `Synonyms for ${today.word}`}
          onClose={closeModal}
        >
          {modalLoading && (
            <div className="loading-block">
              <div className="spinner" />
            </div>
          )}
          {!modalLoading && modalContent && modalKind === 'examples' && (
            <ul className="modal-list">
              {modalContent.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          {!modalLoading && modalContent && modalKind === 'synonyms' && (
            <div style={{ marginTop: 4 }}>
              {modalContent.map((s, i) => (
                <span key={i} className="synonym-chip">{s}</span>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
