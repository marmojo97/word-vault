import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'wordvault.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    part_of_speech TEXT,
    definition TEXT NOT NULL,
    example_sentence TEXT,
    source TEXT,
    mastery_score INTEGER NOT NULL DEFAULT 0,
    next_review_date TEXT NOT NULL DEFAULT (date('now')),
    date_added TEXT NOT NULL DEFAULT (datetime('now')),
    times_seen INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_words_review ON words(next_review_date);
  CREATE INDEX IF NOT EXISTS idx_words_mastery ON words(mastery_score);
`);

// First-run seed
const { n } = db.prepare('SELECT COUNT(*) AS n FROM words').get();
if (n === 0) {
  const seed = [
    {
      word: 'ephemeral',
      part_of_speech: 'adjective',
      definition: 'lasting for a very short time',
      example_sentence: 'The beauty of cherry blossoms is ephemeral, lasting only a week each spring.',
      source: 'NYT'
    },
    {
      word: 'sonder',
      part_of_speech: 'noun',
      definition: 'the realization that each random passerby is living a life as vivid and complex as your own',
      example_sentence: 'Walking through the crowded train station, she was struck by a sudden wave of sonder.',
      source: 'Dictionary of Obscure Sorrows'
    },
    {
      word: 'petrichor',
      part_of_speech: 'noun',
      definition: 'the pleasant earthy smell that accompanies the first rain after a long dry spell',
      example_sentence: 'After weeks of drought, the petrichor filled the garden with quiet hope.',
      source: 'screenshot'
    },
    {
      word: 'lugubrious',
      part_of_speech: 'adjective',
      definition: 'looking or sounding sad and dismal',
      example_sentence: 'He played a lugubrious melody on the cello as the rain tapped against the window.',
      source: 'Pachinko'
    },
    {
      word: 'sanguine',
      part_of_speech: 'adjective',
      definition: 'optimistic or positive, especially in an apparently bad or difficult situation',
      example_sentence: "She remained sanguine about the team's chances despite the loss.",
      source: 'The Economist'
    }
  ];
  const insert = db.prepare(`
    INSERT INTO words (word, part_of_speech, definition, example_sentence, source, next_review_date)
    VALUES (?, ?, ?, ?, ?, date('now'))
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(r.word, r.part_of_speech, r.definition, r.example_sentence, r.source);
    }
  });
  tx(seed);
  console.log(`[db] seeded ${seed.length} example words`);
}

export default db;
