const PROMPT = (subject, topic, n) => `\
You are an expert teacher and exam writer for: ${subject}

Generate exactly ${n} quiz cards for the topic: "${topic}"

Rules:
- Each card tests a DISTINCT concept within the topic
- Exactly one option must be correct per question
- The scenario version must require deeper reasoning than the quiz version
- The rule statement must be punchy and memorable (use **bold** for key terms)

Return ONLY a valid JSON array, no markdown fences:
[
  {
    "question_text": "One-line description of what this card tests",
    "quiz_format": {
      "question": "Direct question testing a specific concept?",
      "options": [
        {"text": "...", "correct": true},
        {"text": "...", "correct": false},
        {"text": "...", "correct": false},
        {"text": "...", "correct": false}
      ],
      "explanation": "Why the correct answer is right and why the others are wrong."
    },
    "scenario_format": {
      "question": "Realistic scenario with tradeoffs that requires applying the concept...",
      "options": [
        {"text": "...", "correct": true},
        {"text": "...", "correct": false},
        {"text": "...", "correct": false},
        {"text": "...", "correct": false}
      ],
      "explanation": "Detailed reasoning for the correct choice in this scenario."
    },
    "rule_format": {
      "statement": "Punchy rule: **key term** → what it means in practice."
    }
  }
]`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subject, topic, cardsPerTopic = 3 } = req.body || {};
  if (!subject?.trim() || !topic?.trim())
    return res.status(400).json({ error: 'subject and topic are required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const raw = await callGemini(apiKey, PROMPT(subject.trim(), topic.trim(), cardsPerTopic));
    const cards = JSON.parse(stripFences(raw));

    const slug = topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const processed = cards.map((card, i) => ({
      ...card,
      concept_id: `${slug}-${i + 1}`,
      topic: topic.trim(),
    }));

    return res.status(200).json({ cards: processed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function callGemini(apiKey, prompt) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });
  const json = await res.json();

  // Surface Gemini API errors (bad key, quota, etc.)
  if (json.error) {
    throw new Error(`Gemini API error ${json.error.code}: ${json.error.message}`);
  }

  // Safety filter or empty candidates
  if (!json.candidates?.length) {
    const reason = json.promptFeedback?.blockReason || 'unknown';
    throw new Error(`Gemini returned no candidates (blockReason: ${reason})`);
  }

  const text = json.candidates[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini candidate had no text content');
  return text;
}

function stripFences(text) {
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}
