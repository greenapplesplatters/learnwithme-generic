import React, { useState, useEffect } from 'react';
import { Heart, Bookmark } from 'lucide-react';
import './StudyCard.css';

const formatText = (text) => {
  if (!text) return null;
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="highlight">{part.slice(2, -2)}</strong>
      : part
  );
};

const FORMAT_META = {
  quiz:     { label: 'CONCEPT CHECK', icon: '⚠️', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' },
  scenario: { label: 'EXAM SCENARIO', icon: '🧨', color: '#ef4444', borderColor: 'rgba(239,68,68,0.35)'  },
  rule:     { label: 'MENTAL MODEL',  icon: '⚡', color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.35)' },
};

const HOOK_LINES = {
  quiz:     ['This trips up 60% of test-takers.', 'Classic SAA exam trap.', 'Most candidates miss this.', "Don't fail on this one."],
  scenario: ['Architects lose jobs over this.', 'Two options look identical. Pick right.', 'Exam-realistic. Think hard.', 'This one stings if you skip it.'],
  rule:     ['Commit this to memory.', "You'll thank yourself on exam day.", 'Print this on your brain.', 'One rule to rule them all.'],
};

function getHookLine(format, conceptId) {
  const arr = HOOK_LINES[format] || HOOK_LINES.rule;
  return arr[(conceptId || '').charCodeAt(0) % arr.length];
}

// ─── Quiz / Scenario card ────────────────────────────────────────────────────
// Three faces:
//   'question'    — unanswered, tap to answer
//   'revealed'    — correct/wrong shown on options, no explanation yet
//   'explanation' — full explanation on the card back

const QuizCard = ({ data, format, onAnswer }) => {
  const [selected, setSelected] = useState(null);
  const [face, setFace] = useState('question'); // 'question' | 'revealed' | 'explanation'

  const formatData = data[`${format}_format`] || data.quiz_format;
  if (!formatData) return <div className="card-error">No content available.</div>;

  const { question, options = [], explanation } = formatData;
  const meta = FORMAT_META[format];

  const handleSelect = (opt, i) => {
    if (face !== 'question') return;
    setSelected(i);
    setFace('revealed');
    onAnswer(opt.correct, format);
  };

  // ── Explanation face ────────────────────────────────────────────────────────
  if (face === 'explanation') {
    const picked = options[selected];
    const correctIdx = options.findIndex(o => o.correct);
    return (
      <div className="card-content exp-face">
        <button className="exp-back-btn" onClick={() => setFace('revealed')}>← Back</button>

        <div className={`exp-verdict ${picked?.correct ? 'verdict-correct' : 'verdict-wrong'}`}>
          <span className="verdict-label">
            {picked?.correct ? '✓ Correct' : '✗ Wrong'}
          </span>
          <span className="verdict-option">
            You picked {String.fromCharCode(65 + selected)}: {picked?.text}
          </span>
          {!picked?.correct && (
            <span className="verdict-right">
              ✓ Correct was {String.fromCharCode(65 + correctIdx)}: {options[correctIdx]?.text}
            </span>
          )}
        </div>

        {explanation && (
          <div className="exp-body">
            <p className="exp-label">WHY:</p>
            <p className="exp-text">{formatText(explanation)}</p>
          </div>
        )}

        <p className="exp-scroll-hint">↓ scroll to continue</p>
      </div>
    );
  }

  // ── Question / Revealed face ────────────────────────────────────────────────
  return (
    <div className="card-content quiz-content">
      <div className="format-badge" style={{ color: meta.color, borderColor: meta.borderColor }}>
        {meta.icon} {meta.label}
      </div>
      <p className="hook-line">{getHookLine(format, data.concept_id)}</p>
      <p className="question-text">{question}</p>

      <div className="options-list">
        {options.map((opt, i) => {
          let cls = 'option-btn';
          if (face === 'revealed') {
            if (opt.correct) cls += ' correct';
            else if (selected === i) cls += ' wrong';
            else cls += ' dimmed';
          }
          const label = face === 'revealed'
            ? opt.correct ? '✓' : selected === i ? '✗' : String.fromCharCode(65 + i)
            : String.fromCharCode(65 + i);
          return (
            <button key={i} className={cls} onClick={() => handleSelect(opt, i)}>
              <span className="opt-letter">{label}</span>
              <span className="opt-text">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {face === 'revealed' && (
        <div className="flip-bar">
          <button className="flip-btn" onClick={() => setFace('explanation')}>
            ↻ Why? →
          </button>
          <span className="skip-hint">↓ scroll to skip</span>
        </div>
      )}
    </div>
  );
};

// ─── Rule card ───────────────────────────────────────────────────────────────

const RuleCard = ({ data, onView }) => {
  useEffect(() => { onView(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ruleData = data.rule_format;
  if (!ruleData) return <div className="card-error">No rule content.</div>;

  const meta = FORMAT_META.rule;
  const score = data.mastery?.score || 0;

  return (
    <div className="card-content rule-content">
      <div className="format-badge" style={{ color: meta.color, borderColor: meta.borderColor }}>
        {meta.icon} {meta.label}
      </div>
      <p className="hook-line">{getHookLine('rule', data.concept_id)}</p>
      {score >= 70 && <div className="mastery-badge">🏆 {score}% Mastered</div>}
      <div className="rule-statement">
        <p>{formatText(ruleData.statement)}</p>
      </div>
      <p className="rule-source">Based on: {data.question_text}</p>
    </div>
  );
};

// ─── Root card wrapper ────────────────────────────────────────────────────────

const StudyCard = ({ data, isActive, onAnswer, onView }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const format = data.format || 'quiz';
  const score = data.mastery?.score ?? 0;
  const scoreColor = score >= 70 ? '#4ade80' : score >= 35 ? '#f59e0b' : '#f87171';

  return (
    <div className={`study-card-wrapper ${isActive ? 'active' : ''}`}>
      <div className="study-card">
        <div className="card-header">
          <span className="topic-badge">{data.topic || 'AWS'}</span>
          <div className="mastery-pill">
            <span className="mastery-dot" style={{ background: scoreColor }} />
            <span className="mastery-pct">{score}%</span>
          </div>
        </div>

        {format === 'rule'
          ? <RuleCard data={data} onView={onView} />
          : <QuizCard data={data} format={format} onAnswer={onAnswer} />
        }

        <div className="card-actions">
          <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(v => !v)}>
            <Heart fill={liked ? '#f43f5e' : 'none'} color={liked ? '#f43f5e' : 'white'} size={20} />
          </button>
          <button className={`action-btn ${saved ? 'saved' : ''}`} onClick={() => setSaved(v => !v)}>
            <Bookmark fill={saved ? '#fbbf24' : 'none'} color={saved ? '#fbbf24' : 'white'} size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyCard;
