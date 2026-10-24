import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn('[anthropic] ANTHROPIC_API_KEY is not set — Claude-powered features will fail until you add one to .env');
}

const client = new Anthropic({ apiKey });
const MODEL = 'claude-sonnet-5';

const PARSE_SYSTEM_PROMPT = `You are a dictionary parser. The user will send you a screenshot of a word lookup — from a dictionary app, browser, book app, or any similar source. Extract the word, its part of speech, its primary definition, and one example sentence if present. Respond ONLY with a JSON object with keys: word, part_of_speech, definition, example_sentence. If a field is not present in the image, set it to null. Never include markdown, backticks, or any other text.`;

function extractText(message) {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Model did not return valid JSON. Got: ' + text.slice(0, 200));
  }
}

/**
 * Extract { word, part_of_speech, definition, example_sentence } from a screenshot.
 * Accepts either a raw base64 string or a `data:` URL.
 */
export async function parseScreenshot(imageInput, mediaTypeHint = 'image/png') {
  let mediaType = mediaTypeHint;
  let data = imageInput;

  // Strip data URL prefix if present, and pull the actual media type from it.
  const m = typeof data === 'string' && data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (m) {
    mediaType = m[1];
    data = m[2];
  }

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: PARSE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data }
          },
          { type: 'text', text: 'Parse this dictionary screenshot.' }
        ]
      }
    ]
  });

  const text = extractText(message);
  const parsed = parseJsonLoose(text);

  // Normalize keys & nullable fields
  return {
    word: parsed.word ?? null,
    part_of_speech: parsed.part_of_speech ?? null,
    definition: parsed.definition ?? null,
    example_sentence: parsed.example_sentence ?? null
  };
}

export async function generateMoreExamples(word, definition) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `Give me 5 natural example sentences using the word "${word}" (meaning: ${definition}). Vary the contexts. Return ONLY a JSON array of strings — no markdown, no backticks, no commentary.`
      }
    ]
  });
  const arr = parseJsonLoose(extractText(message));
  if (!Array.isArray(arr)) throw new Error('Expected an array of sentences');
  return arr.map(String);
}

export async function generateSynonyms(word, definition) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Give me 6 synonyms for the word "${word}" (meaning: ${definition}). Return ONLY a JSON array of single-word strings — no markdown, no backticks, no commentary.`
      }
    ]
  });
  const arr = parseJsonLoose(extractText(message));
  if (!Array.isArray(arr)) throw new Error('Expected an array of synonyms');
  return arr.map(String);
}

/**
 * Generate 2 natural context sentences for context-mode practice.
 * Sentences SHOULD contain the word (so the student sees it in use),
 * but should hint at the meaning through context rather than defining it directly.
 */
export async function generateContextSentences(word, definition) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Write exactly 2 natural sentences using the word "${word}" (meaning: ${definition}). Each sentence should feel like a real excerpt from a book, article, or conversation. The sentences should give enough context clues that an attentive reader could infer the meaning, but should NOT define the word directly. Vary the context across the two sentences. Return ONLY a JSON array of exactly 2 strings — no markdown, no backticks, no commentary.`
      }
    ]
  });
  const arr = parseJsonLoose(extractText(message));
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Expected an array of sentences');
  }
  return arr.map(String);
}

/**
 * Grade a user's definition against the correct one. Lenient grading —
 * if the user captured the essential meaning, mark it correct even if
 * the wording is loose.
 */
export async function gradeUserDefinition(word, correctDefinition, userDefinition) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `A student is studying vocabulary. The word is "${word}". The dictionary definition is: "${correctDefinition}". The student wrote: "${userDefinition}".

Judge whether the student's answer captures the essential meaning. They do NOT need to use the dictionary's exact wording. Be lenient — if they got the core concept right, mark it correct. Only mark incorrect if they clearly missed or mangled the meaning.

Return ONLY a JSON object with keys:
- "correct": boolean
- "feedback": a brief 1-sentence explanation, warm and encouraging

No markdown, no backticks, no commentary.`
      }
    ]
  });
  const parsed = parseJsonLoose(extractText(message));
  return {
    correct: !!parsed.correct,
    feedback: String(parsed.feedback ?? '')
  };
}
