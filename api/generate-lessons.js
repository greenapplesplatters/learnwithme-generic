function extractJson(text) {
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

const PROMPT = (subject, topics) => `\
You are a master educator who writes with the punchy, high-stakes energy of a viral news headline writer.

Generate one lesson card per topic listed below for the subject: "${subject}"

Topics: ${topics.map(t => `"${t}"`).join(', ')}

Rules for EVERY lesson card:
- headline: A shocking, dramatic, emotionally-charged statement. Use real consequences, failure stories, or surprising facts. Make the reader NEED to flip the card. ("The Bug That Took Down GitHub for 24 Hours — And How to Never Write It")
- subheadline: One sentence that deepens the intrigue without giving away the lesson.
- lesson_pages: 2-3 pages. EACH page must:
  - Open with stakes or a consequence — NOT a definition
  - Use "you" and "your" constantly — make it personal
  - Use short, punchy sentences. No passive voice.
  - Include real consequences of getting this wrong
  - End with the insight that saves them

Return ONLY a valid JSON array, no markdown fences:
[
  {
    "id": "topic-slug",
    "topic": "Topic Name",
    "headline": "Shocking headline that creates emotional urgency",
    "subheadline": "One sentence that deepens the hook",
    "lesson_pages": [
      {
        "title": "Stakes-first title (not 'What X Is')",
        "body": "Stakes-first content. Short punchy sentences. Second person. Real consequences."
      }
    ]
  }
]`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subject, topics } = req.body || {};
  if (!subject?.trim() || !Array.isArray(topics) || !topics.length)
    return res.status(400).json({ error: 'subject and topics array are required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const raw = await callGemini(apiKey, PROMPT(subject.trim(), topics));
    const lessons = JSON.parse(extractJson(raw));

    // Ensure stable IDs
    const processed = lessons.map((l, i) => ({
      ...l,
      id: l.id || topics[i]?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `lesson-${i}`,
    }));

    return res.status(200).json({ lessons: processed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    }),
  });
  const json = await res.json();

  if (json.error) {
    throw new Error(`Gemini API error ${json.error.code}: ${json.error.message}`);
  }

  if (!json.candidates?.length) {
    const reason = json.promptFeedback?.blockReason || 'unknown';
    throw new Error(`Gemini returned no candidates (blockReason: ${reason})`);
  }

  const text = json.candidates[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini candidate had no text content');
  return text;
}
