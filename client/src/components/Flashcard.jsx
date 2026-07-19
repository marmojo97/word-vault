import { useEffect, useState } from 'react';

export default function Flashcard({ word }) {
  const [flipped, setFlipped] = useState(false);

  // Reset flip state whenever a new card is shown.
  useEffect(() => setFlipped(false), [word.id]);

  return (
    <div className="flashcard-wrap">
      <div
        className={'flashcard ' + (flipped ? 'flipped' : '')}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
      >
        <div className="face front">
          <div className="word-front">{word.word}</div>
          {word.part_of_speech && (
            <div className="pos-badge" style={{ marginTop: 14 }}>{word.part_of_speech}</div>
          )}
          <div className="tap-hint">tap to flip</div>
        </div>
        <div className="face back">
          <div className="word">{word.word}</div>
          {word.part_of_speech && <span className="pos-badge">{word.part_of_speech}</span>}
          <div className="definition">{word.definition}</div>
          {word.example_sentence && (
            <div className="example">&ldquo;{word.example_sentence}&rdquo;</div>
          )}
        </div>
      </div>
    </div>
  );
}
