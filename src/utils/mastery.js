const STORAGE_KEY = 'lwm_mastery_v1';

const defaultRecord = () => ({
  score: 0, attempts: 0, correct: 0,
  lastSeen: null, nextReview: null,
  // Variant system
  variantIndex: 0,   // which reword version to show (0 = original, 1 = context-shift, 2 = edge-case)
  everWrong: false,  // true once the user has missed this card at least once
  lastCorrect: null, // timestamp of the last correct answer
});

export function loadMastery() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveMastery(mastery) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mastery));
}

export function getMastery(conceptId) {
  const mastery = loadMastery();
  return mastery[conceptId] || defaultRecord();
}

// Call when user answers a quiz or scenario question
export function recordAnswer(conceptId, isCorrect, format) {
  const mastery = loadMastery();
  const cm = mastery[conceptId] || defaultRecord();

  // Capture before update — used for variant advancement below
  const prevLastCorrect = cm.lastCorrect;

  cm.attempts += 1;
  cm.lastSeen = Date.now();
  if (isCorrect) cm.correct = (cm.correct || 0) + 1;

  // Score delta by format: scenario is harder so rewards/penalizes more
  const delta = format === 'scenario'
    ? (isCorrect ? 15 : -10)
    : (isCorrect ? 10 : -5);
  cm.score = Math.max(0, Math.min(100, cm.score + delta));

  // Spaced repetition interval: well-known = review less often
  const dayMs = 86400000;
  const interval = cm.score >= 80 ? 7 * dayMs : cm.score >= 50 ? 3 * dayMs : dayMs;
  cm.nextReview = Date.now() + interval;

  // ── Variant advancement ────────────────────────────────────────────────────
  // v0 → v1: first correct answer after the user has previously gotten it wrong
  // v0 → v2: always been correct but not seen for 7+ days (long-term retention)
  // v1 → v2: was on context-shift version and 7+ days have passed since last correct
  if (!isCorrect) {
    cm.everWrong = true;
  } else {
    const vi = cm.variantIndex || 0;
    const daysSince = prevLastCorrect ? (Date.now() - prevLastCorrect) / dayMs : null;

    if (vi === 0) {
      if (cm.everWrong) {
        cm.variantIndex = 1; // context-shift reword after recovering from a miss
      } else if (daysSince !== null && daysSince >= 7) {
        cm.variantIndex = 2; // never missed, but unseen for a week → harder reword
      }
    } else if (vi === 1 && daysSince !== null && daysSince >= 7) {
      cm.variantIndex = 2; // mastered v1, now long-term retention version
    }

    cm.lastCorrect = Date.now();
  }

  mastery[conceptId] = cm;
  saveMastery(mastery);
  return cm;
}

// Call when a rule card is viewed (passive reinforcement)
export function recordView(conceptId) {
  const mastery = loadMastery();
  const cm = mastery[conceptId] || { score: 0, attempts: 0, correct: 0, lastSeen: null, nextReview: null };
  cm.score = Math.min(100, cm.score + 2);
  cm.lastSeen = Date.now();
  if (!cm.nextReview) cm.nextReview = Date.now() + 86400000;
  mastery[conceptId] = cm;
  saveMastery(mastery);
}

export function clearMastery() {
  localStorage.removeItem(STORAGE_KEY);
}
