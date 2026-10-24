import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Flashcard from '../components/Flashcard.jsx';

export default function PracticeScreen({ streak, showToast }) {
  const [mode, setMode] = useState('flashcard'); // 'flashcard' | 'context'
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

  const modeToggle = (
    <div className="row" style={{ gap: 6, marginBottom: 14 }}>
      <button
        className={'chip' + (mode === 'flashcard' ? ' active' : '')}
        onClick={() => setMode('flashcard')}
      >
        Flashcard
      </button>
      <button
        className={'chip' + (mode === 'context' ? ' active' : '')}
        onClick={() => setMode('context')}
      >
        Context
      </button>
    </div>
  );

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
        {modeToggle}
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
      {modeToggle}
      <div className="muted">Card {index + 1} of {cards.length}</div>

      {mode === 'flashcard' ? (
        <>
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
        </>
      ) : (
        <ContextMode
          key={card.id}
          card={card}
          onRate={rate}
          submitting={submitting}
          showToast={showToast}
        />
      )}

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

function ContextMode({ card, onRate, submitting, showToast }) {
  const [sentences, setSentences] = useState(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [userDef, setUserDef] = useState('');
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSentences(null);
    setUserDef('');
    setFeedback(null);
    setLoadingCtx(true);
    (async () => {
      try {
        const data = await api.getContext(card.id);
        if (!cancelled) setSentences(data.sentences);
      } catch (err) {
        if (!cancelled) showToast('Could not load context: ' + err.message);
      } finally {
        if (!cancelled) setLoadingCtx(false);
      }
    })();
    return () => { cancelled = true; };
  }, [card.id, showToast]);

  async function submit() {
    const trimmed = userDef.trim();
    if (!trimmed || grading) return;
    setGrading(true);
    try {
      const result = await api.gradeDefinition(card.id, trimmed);
      setFeedback(result);
    } catch (err) {
      showToast('Grading failed: ' + err.message);
    } finally {
      setGrading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      {loadingCtx && (
        <div className="loading-block">
          <div className="spinner" />
          <div className="muted" style={{ marginTop: 8 }}>Generating context…</div>
        </div>
      )}

      {!loadingCtx && sentences && !feedback && (
        <>
          <div className="section-label">In context</div>
          {sentences.map((s, i) => (
            <div key={i} className="context-sentence">&ldquo;{s}&rdquo;</div>
          ))}
          <div className="muted" style={{ marginTop: 16, marginBottom: 6, fontSize: 13 }}>
            What do you think the word means?
          </div>
          <textarea
            className="definition-input"
            value={userDef}
            onChange={(e) => setUserDef(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Your best guess — exact wording doesn't matter"
            rows={3}
            autoFocus
          />
          <button
            className="btn primary full"
            disabled={!userDef.trim() || grading}
            style={{ marginTop: 12 }}
            onClick={submit}
          >
            {grading ? 'Grading…' : 'Submit'}
          </button>
          <div className="muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'center' }}>
            Tip: ⌘ + Enter to submit
          </div>
        </>
      )}

      {feedback && (
        <>
          <div
            className="feedback-badge"
            style={{ color: feedback.correct ? 'var(--green)' : 'var(--danger)' }}
          >
            {feedback.correct ? '✓ Correct' : '✗ Not quite'}
          </div>
          <div className="feedback-text">{feedback.feedback}</div>

          <div className="section-label" style={{ marginTop: 16 }}>Your answer</div>
          <div className="example" style={{ marginTop: 4 }}>&ldquo;{userDef}&rdquo;</div>

          <div className="section-label" style={{ marginTop: 14 }}>Dictionary definition</div>
          <div className="definition" style={{ margin: '4px 0 16px' }}>{card.definition}</div>

          <div className="row">
            <button
              className="btn full"
              style={{ flex: 1 }}
              onClick={() => onRate('review')}
              disabled={submitting}
            >
              review again
            </button>
            <button
              className="btn success full"
              style={{ flex: 1 }}
              onClick={() => onRate('known')}
              disabled={submitting}
            >
              got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
