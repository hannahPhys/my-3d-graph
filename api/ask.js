const fs = require('fs');
const path = require('path');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const TOP_K = 8;
const MAX_NOTE_CHARS = 3000;
const MAX_QUESTION_CHARS = 300;
const RATE_LIMIT = 10; // requests per IP per hour (best effort: resets when the instance recycles)
const WINDOW_MS = 60 * 60 * 1000;
const STOPWORDS = new Set('a an and are as at be but by can do does for from how i in is it of on or so that the this to was what when where which who why with you your me my about tell explain'.split(' '));

let notes;
function loadNotes() {
  if (!notes) notes = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'notes.json'), 'utf-8'));
  return notes;
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+/g)?.filter(t => t.length > 1 && !STOPWORDS.has(t)) || [];
}

// keyword retrieval: title matches count far more than body matches
function topNotes(question) {
  const tokens = [...new Set(tokenize(question))];
  const q = question.toLowerCase();
  return loadNotes()
    .map(note => {
      const title = note.title.toLowerCase();
      const body = note.content.toLowerCase();
      let score = q.includes(title) ? 20 : 0;
      tokens.forEach(t => {
        if (title.includes(t)) score += 8;
        score += Math.min(body.split(t).length - 1, 5);
      });
      return { note, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map(s => s.note);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });

  const input_text = String(req.body?.input_text || '').trim().slice(0, MAX_QUESTION_CHARS);
  if (!input_text) return res.status(400).json({ error: 'input_text is required' });

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many questions, try again later' });

  const start = Date.now();
  const matches = topNotes(input_text);
  if (!matches.length) {
    return res.json({ file_name: '', input_text, response: "I couldn't find any notes related to that.", diagnostics: { processing_time_sec: 0, llm_version: MODEL, temperature: 0.3 } });
  }

  const context = matches.map(n => `### ${n.title}\n${n.content.slice(0, MAX_NOTE_CHARS)}`).join('\n\n');
  const prompt = `Answer the question using only these personal notes. Be concise. If the notes don't cover it, say so.\n\n${context}\n\nQuestion: ${input_text}\n\nRespond with JSON only: {"answer": "...", "best_note": "<exact title of the single most relevant note above>"}`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, temperature: 0.3, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!upstream.ok) return res.status(502).json({ error: `Upstream error ${upstream.status}` });

    const text = (await upstream.json()).content?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]); } catch { parsed = { answer: text, best_note: matches[0].title }; }

    res.json({
      file_name: parsed.best_note || matches[0].title,
      input_text,
      response: parsed.answer || text,
      diagnostics: { processing_time_sec: (Date.now() - start) / 1000, llm_version: MODEL, temperature: 0.3 },
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach the model' });
  }
};
