import React from 'react';
import LessonCard from './LessonCard';
import './StudyMode.css';

export default function StudyMode({ onExit, lessons = [] }) {
  // Lessons are generated per subject when created; if none, show message
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

  return (
    <div className="study-mode">
      <div className="study-mode-header">
        <button className="study-mode-exit" onClick={onExit}>← Exit</button>
        <span className="study-mode-title">Study Mode</span>
        <span className="study-mode-count">{lessons.length} lessons</span>
      </div>

      <div className="study-mode-feed">
        {lessons.map((lesson) => (
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
