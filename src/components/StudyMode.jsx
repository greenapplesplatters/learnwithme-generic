import React from 'react';
import LessonCard from './LessonCard';
import defaultLessons from '../data/lessons.json';
import './StudyMode.css';

export default function StudyMode({ onExit, lessons }) {
  lessons = (lessons && lessons.length > 0) ? lessons : defaultLessons;
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
