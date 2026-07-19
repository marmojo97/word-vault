import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Flashcard from '../components/Flashcard.jsx';

export default function PracticeScreen({ streak, showToast }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]); // 'known' | 'review' per card
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cs = await api.flashcards();
        if (!cancelled) setCards(cs);
      } catch (err) {
        if (!cancelled) showToast('Could not load: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  async function rate(result) {
    const card = cards[index];
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await api.rateMastery(card.id, result);
    } catch (err) {
      showToast('Save failed: ' + err.message);
      setSubmitting(false);
      return;
    }
    setResults((r) => [...r, result]);
    setIndex((i) => i + 1);
    setSubmitting(false);
  }

  function restart() {
    setIndex(0);
    setResults([]);
    setLoading(true);
    api.flashcards()
      .then((cs) => { setCards(cs); })
      .catch((err) => showToast('Could not load: ' + err.message))
      .finally(() => setLoading(false));
  }

  if (loading) {
    return (
      <div>
        <div className="screen-title">Practice</div>
        <div className="loading-block"><div className="spinner" /></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div>
        <div className="screen-title">Practice</div>
        <div className="empty">Nothing due for review. Come back later!</div>
      </div>
    );
  }

  // Session complete
  if (index >= cards.length) {
    const known = results.filter((r) => r === 'known').length;
    const review = results.length - known;
    return (
      <div>
        <div className="screen-title">Session complete</div>
        <div className="card center">
          <div className="section-label">Known</div>
          <div className="summary-stat" style={{ color: 'var(--green)' }}>{known}</div>
          <div className="section-label" style={{ marginTop: 12 }}>To review</div>
          <div className="summary-stat" style={{ color: 'var(--text-muted)' }}>{review}</div>
          <div className="muted" style={{ marginTop: 18 }}>
            {streak} day{streak === 1 ? '' : 's'} streak 🔥
          </div>
        </div>
        <button className="btn full primary" style={{ marginTop: 16 }} onClick={restart}>
          Practice more
        </button>
      </div>
    );
  }

  const card = cards[index];
  return (
    <div>
      <div className="screen-title">Practice</div>
      <div className="muted">Card {index + 1} of {cards.length}</div>

      <Flashcard word={card} />

      <div className="row">
        <button
          className="btn full"
          style={{ flex: 1 }}
          onClick={() => rate('review')}
          disabled={submitting}
        >
          review again
        </button>
        <button
          className="btn success full"
          style={{ flex: 1 }}
          onClick={() => rate('known')}
          disabled={submitting}
        >
          got it
        </button>
      </div>

      <div className="progress-dots" aria-label="Session progress">
        {cards.map((_, i) => {
          let cls = 'progress-dot';
          if (i < results.length) {
            cls += results[i] === 'known' ? ' known' : ' review';
          } else if (i === index) {
            cls += ' current';
          }
          return <span key={i} className={cls} />;
        })}
      </div>
    </div>
  );
}
