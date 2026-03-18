import React, { useState, useMemo } from 'react';
import LessonCard from './LessonCard';
import './StudyMode.css';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudyMode({ onExit, lessons = [] }) {
  const [activeTopic, setActiveTopic] = useState('All');
  const [shuffled, setShuffled] = useState(false);

  // Lessons are generated per subject; if none, show message
  if (!lessons || lessons.length === 0) {
    return (
      <div className="study-mode">
        <div className="study-mode-header">
          <button className="study-mode-exit" onClick={onExit}>← Exit</button>
          <span className="study-mode-title">Study Mode</span>
          <span className="study-mode-count">0 lessons</span>
        </div>
        <div className="study-mode-feed" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
            Lessons will be generated when you create a new subject.
          </p>
        </div>
      </div>
    );
  }

  // Derive unique topics from lessons
  const topics = useMemo(() => {
    const seen = new Set();
    lessons.forEach(l => l.topic && seen.add(l.topic));
    return ['All', ...Array.from(seen).sort()];
  }, [lessons]);

  // Filter and optionally shuffle
  const visibleLessons = useMemo(() => {
    let f = activeTopic === 'All' ? lessons : lessons.filter(l => l.topic === activeTopic);
    if (shuffled) f = shuffleArr(f);
    return f;
  }, [lessons, activeTopic, shuffled]);

  return (
    <div className="study-mode">
      <div className="study-mode-header">
        <button className="study-mode-exit" onClick={onExit}>← Exit</button>
        <span className="study-mode-title">Study Mode</span>
        <span className="study-mode-count">{visibleLessons.length} lessons</span>
      </div>

      {/* Topic filter chip bar */}
      <div className="study-mode-chip-bar">
        {topics.map(t => (
          <button
            key={t}
            className={`study-mode-chip ${activeTopic === t ? 'study-mode-chip-active' : ''}`}
            onClick={() => setActiveTopic(t)}
          >
            {t}
          </button>
        ))}
        <span className="study-mode-chip-divider" />
        <button
          className={`study-mode-chip study-mode-chip-shuffle ${shuffled ? 'study-mode-chip-active' : ''}`}
          onClick={() => setShuffled(s => !s)}
        >
          🔀 Shuffle
        </button>
      </div>

      <div className="study-mode-feed">
        {visibleLessons.map((lesson) => (
          <div key={lesson.id} className="study-mode-slot">
            <LessonCard lesson={lesson} />
          </div>
        ))}
        <div className="study-mode-end">
          <p>You've reached the end 🎉</p>
          <button className="study-mode-exit-btn" onClick={onExit}>Back to Menu</button>
        </div>
      </div>
    </div>
  );
}
