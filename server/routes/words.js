import express from 'express';
import db from '../db.js';
import {
  parseScreenshot,
  generateMoreExamples,
  generateSynonyms
} from '../lib/anthropic.js';

const router = express.Router();

// Spaced-repetition intervals (days) keyed by mastery score AFTER the answer.
const INTERVALS = { 0: 1, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

/**
 * GET /api/words?sort=date|mastery|alpha&filter=all|new|learning|mastered
 */
router.get('/', (req, res) => {
  const sort = req.query.sort ?? 'date';
  const filter = req.query.filter ?? 'all';

  let where = '';
  if (filter === 'new') where = 'WHERE mastery_score = 0';
  else if (filter === 'learning') where = 'WHERE mastery_score BETWEEN 1 AND 4';
  else if (filter === 'mastered') where = 'WHERE mastery_score = 5';

  let order = 'date_added DESC, id DESC';
  if (sort === 'alpha') order = 'word COLLATE NOCASE ASC';
  else if (sort === 'mastery') order = 'mastery_score DESC, word COLLATE NOCASE ASC';

  const rows = db.prepare(`SELECT * FROM words ${where} ORDER BY ${order}`).all();
  res.json(rows);
});

/**
 * GET /api/words/today
 * Returns { today, tomorrow }. The "today" word is chosen by oldest review date,
 * weighted toward lower mastery. "tomorrow" is the next-best preview card.
 */
router.get('/today', (_req, res) => {
  const ordered = db.prepare(`
    SELECT * FROM words
    ORDER BY next_review_date ASC, mastery_score ASC, RANDOM()
    LIMIT 5
  `).all();
  const today = ordered[0] ?? null;
  const tomorrow = ordered.find((w) => today ? w.id !== today.id : true) ?? null;
  res.json({ today, tomorrow });
});

/**
 * GET /api/words/flashcards — up to 12 cards due today.
 */
router.get('/flashcards', (_req, res) => {
  const rows = db.prepare(`
    SELECT * FROM words
    WHERE next_review_date <= date('now')
    ORDER BY next_review_date ASC, mastery_score ASC
    LIMIT 12
  `).all();
  res.json(rows);
});

/**
 * GET /api/words/:id — must come AFTER static routes above.
 */
router.get('/:id(\\d+)', (req, res) => {
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

/**
 * POST /api/words — manual add.
 */
router.post('/', (req, res) => {
  const { word, part_of_speech, definition, example_sentence, source } = req.body ?? {};
  if (!word || !definition) {
    return res.status(400).json({ error: 'word and definition are required' });
  }
  const info = db.prepare(`
    INSERT INTO words (word, part_of_speech, definition, example_sentence, source, next_review_date)
    VALUES (?, ?, ?, ?, ?, date('now'))
  `).run(
    String(word).trim(),
    part_of_speech ? String(part_of_speech).trim() : null,
    String(definition).trim(),
    example_sentence ? String(example_sentence).trim() : null,
    source ? String(source).trim() : null
  );
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

/**
 * POST /api/words/parse-screenshot — does NOT save; user confirms first.
 */
router.post('/parse-screenshot', async (req, res) => {
  const { image, media_type } = req.body ?? {};
  if (!image) return res.status(400).json({ error: 'image (base64 or data URL) is required' });
  try {
    const parsed = await parseScreenshot(image, media_type ?? 'image/png');
    res.json(parsed);
  } catch (err) {
    console.error('[parse-screenshot]', err);
    res.status(500).json({ error: err.message ?? 'Failed to parse screenshot' });
  }
});

/**
 * PATCH /api/words/:id/mastery — body: { result: "known" | "review" }
 */
router.patch('/:id(\\d+)/mastery', (req, res) => {
  const { result } = req.body ?? {};
  if (!['known', 'review'].includes(result)) {
    return res.status(400).json({ error: 'result must be "known" or "review"' });
  }
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!word) return res.status(404).json({ error: 'not found' });

  let newMastery = word.mastery_score;
  let intervalDays;
  if (result === 'known') {
    newMastery = Math.min(5, word.mastery_score + 1);
    intervalDays = INTERVALS[newMastery] ?? 1;
  } else {
    intervalDays = 1; // try again tomorrow
  }

  db.prepare(`
    UPDATE words
       SET mastery_score = ?,
           next_review_date = date('now', '+' || ? || ' days'),
           times_seen = times_seen + 1
     WHERE id = ?
  `).run(newMastery, intervalDays, req.params.id);

  res.json(db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id));
});

/**
 * PUT /api/words/:id — edit a word.
 */
router.put('/:id(\\d+)', (req, res) => {
  const { word, part_of_speech, definition, example_sentence, source } = req.body ?? {};
  const existing = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`
    UPDATE words
       SET word = ?,
           part_of_speech = ?,
           definition = ?,
           example_sentence = ?,
           source = ?
     WHERE id = ?
  `).run(
    word ?? existing.word,
    part_of_speech ?? existing.part_of_speech,
    definition ?? existing.definition,
    example_sentence ?? existing.example_sentence,
    source ?? existing.source,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id));
});

/**
 * DELETE /api/words/:id
 */
router.delete('/:id(\\d+)', (req, res) => {
  const info = db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/**
 * POST /api/words/:id/examples — Claude-generated examples on demand.
 */
router.post('/:id(\\d+)/examples', async (req, res) => {
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!word) return res.status(404).json({ error: 'not found' });
  try {
    const examples = await generateMoreExamples(word.word, word.definition);
    res.json({ examples });
  } catch (err) {
    console.error('[examples]', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate examples' });
  }
});

/**
 * POST /api/words/:id/synonyms — Claude-generated synonyms on demand.
 */
router.post('/:id(\\d+)/synonyms', async (req, res) => {
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!word) return res.status(404).json({ error: 'not found' });
  try {
    const synonyms = await generateSynonyms(word.word, word.definition);
    res.json({ synonyms });
  } catch (err) {
    console.error('[synonyms]', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate synonyms' });
  }
});

export default router;
