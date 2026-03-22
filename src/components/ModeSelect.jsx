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

      <div className="mode-categories">

        <section className="mode-section">
          <h3 className="mode-section-label">Learn</h3>
          <div className="mode-pair">
            <button className="mode-card mode-card-half learn-card-btn" onClick={() => onSelect('learn')}>
              <span className="mode-icon">🧠</span>
              <h2>Study</h2>
              <p>Bite-sized lessons with headline hooks.</p>
              <span className="mode-cta">Start →</span>
            </button>
            <button className="mode-card mode-card-half study-card-btn" onClick={() => onSelect('study')}>
              <span className="mode-icon">📚</span>
              <h2>Test</h2>
              <p>Adaptive cards ranked by weakness.</p>
              <span className="mode-cta">Start →</span>
            </button>
          </div>
        </section>

        <section className="mode-section">
          <h3 className="mode-section-label">Challenge</h3>
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
        </section>

        <section className="mode-section">
          <h3 className="mode-section-label">AI Dialogue</h3>
          <div className="mode-pair">
            <button className="mode-card mode-card-half socratic-card-btn" onClick={() => onSelect('socratic')}>
              <span className="mode-icon">🏛️</span>
              <h2>Socratic</h2>
              <p>Guided dialogue. Real understanding follows.</p>
              <span className="mode-cta">Begin →</span>
            </button>
            <button className="mode-card mode-card-half quest-card-btn" onClick={() => onSelect('quest')}>
              <span className="mode-icon">🧙</span>
              <h2>Quest</h2>
              <p>Enter the dungeon. Knowledge is your weapon.</p>
              <span className="mode-cta">Enter →</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ModeSelect;
