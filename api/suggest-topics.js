const PROMPT = (subject) =>
  `You are an expert curriculum designer.
List the 8-10 most important topics to study for: "${subject}"
Return ONLY a valid JSON array of topic name strings, no markdown fences:
["Topic 1", "Topic 2", ...]`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subject } = req.body || {};
  if (!subject?.trim()) return res.status(400).json({ error: 'subject is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const data = await callGemini(apiKey, PROMPT(subject.trim()), 512, 0.3);
    const topics = JSON.parse(stripFences(data));
    return res.status(200).json({ topics });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function callGemini(apiKey, prompt, maxTokens, temperature) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

function stripFences(text) {
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}
