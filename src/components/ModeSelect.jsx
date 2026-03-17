import React from 'react';
import { getChallengeScores } from '../utils/challengeScore.js';
import './ModeSelect.css';

const ModeSelect = ({ onSelect, subject, onChangeSubject }) => {
  const { high, last } = getChallengeScores();

  return (
    <div className="mode-select">
      <div className="mode-logo">
        <span className="mode-logo-icon">⚡</span>
        <h1>LearnWithMe</h1>
        <div className="mode-subject-row">
          <p>{subject.name}</p>
          <button className="btn-change-subject" onClick={onChangeSubject}>
            change
          </button>
        </div>
      </div>

      <div className="mode-cards">

        <button className="mode-card study-card-btn" onClick={() => onSelect('study')}>
          <span className="mode-icon">📚</span>
          <h2>Test Mode</h2>
          <p>Adaptive cards ranked by your weakest topics. Tracks mastery over time.</p>
          <span className="mode-cta">Start Studying →</span>
        </button>

        <button className="mode-card challenge-card-btn" onClick={() => onSelect('challenge')}>
          <span className="mode-icon">💀</span>
          <h2>Challenge Mode</h2>
          <p>4 hearts. Every wrong answer costs you one. How far can you go?</p>
          <div className="challenge-stats">
            {high > 0 && (
              <span className="stat-pill high">🏆 Best: {high}</span>
            )}
            {last !== null && (
              <span className="stat-pill last">Last: {last}</span>
            )}
          </div>
          <span className="mode-cta">Accept Challenge →</span>
        </button>

      </div>
    </div>
  );
};

export default ModeSelect;
