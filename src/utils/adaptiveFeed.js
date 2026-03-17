import { loadMastery } from './mastery';

// Pick the correct reword variant and spread its formats onto the concept.
// Falls back gracefully for legacy concepts that have no variants array.
export function resolveVariant(concept, mastery) {
  const variants = concept.variants;
  if (!variants || variants.length === 0) return concept;

  const vi = Math.min(mastery?.variantIndex || 0, variants.length - 1);
  const v = variants[vi];
  return {
    ...concept,
    quiz_format: v.quiz_format,
    scenario_format: v.scenario_format,
    rule_format: v.rule_format,
  };
}

// Determine which card format to show based on mastery score
export function selectFormat(score, attempts) {
  if (attempts === 0) return 'quiz';   // Always start new concepts with quiz
  if (score >= 70) return 'rule';      // Mastered: passive reinforcement
  if (score >= 35) return 'scenario';  // Learning: push deeper
  return 'quiz';                       // Weak: build fundamentals
}

function getCardPriority(mastery, now) {
  const { score = 0, attempts = 0, nextReview = null } = mastery;

  if (attempts === 0) {
    return 500; // New concept: medium-high priority
  }

  const isOverdue = nextReview && nextReview < now;
  if (isOverdue) {
    return 1000 - score; // Overdue: highest priority, weakest first (range 900-1000)
  }

  return 400 - score; // Seen: priority inversely proportional to mastery (range 300-400)
}

// Build a sorted feed from all concepts based on current mastery
// Returns concepts with `format` and `mastery` fields injected
export function buildAdaptiveFeed(allConcepts) {
  const masteryData = loadMastery();
  const now = Date.now();

  const withPriority = allConcepts.map(concept => {
    const m = masteryData[concept.concept_id] || { score: 0, attempts: 0, correct: 0 };
    const format = selectFormat(m.score, m.attempts);
    const priority = getCardPriority(m, now) + (Math.random() * 8 - 4); // ±4 jitter within bucket

    return { ...resolveVariant(concept, m), format, mastery: m, priority };
  });

  // Sort descending: highest priority concept shown first
  return withPriority.sort((a, b) => b.priority - a.priority);
}

// Compute weak topics for the end-of-session summary
export function getWeakTopics(allConcepts) {
  const masteryData = loadMastery();
  const topicScores = {};

  allConcepts.forEach(concept => {
    const topic = concept.topic;
    const m = masteryData[concept.concept_id];
    if (!topicScores[topic]) topicScores[topic] = { total: 0, count: 0 };
    topicScores[topic].total += m ? m.score : 0;
    topicScores[topic].count += 1;
  });

  return Object.entries(topicScores)
    .map(([topic, { total, count }]) => ({ topic, avg: Math.round(total / count) }))
    .sort((a, b) => a.avg - b.avg);
}
