import React, { useEffect, useState, useRef, useCallback } from 'react';
import StudyCard from './StudyCard.jsx';
import ProgressHUD from './ProgressHUD.jsx';
import { buildAdaptiveFeed, getWeakTopics } from '../utils/adaptiveFeed.js';
import { recordAnswer, recordView } from '../utils/mastery.js';
import './Feed.css';

const Feed = ({ onExit, cards }) => {
  const [feed, setFeed] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const feedRef = useRef(null);

  // Session stats (reset on page refresh — not persisted)
  const [sessionCorrect, setSessionCorrect]   = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionStreak, setSessionStreak]     = useState(0);

  // Build the adaptive feed once on mount (order is based on stored mastery)
  useEffect(() => {
    setFeed(buildAdaptiveFeed(cards));
  }, [cards]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const idx = Math.round(feedRef.current.scrollTop / window.innerHeight);
    if (idx !== currentIndex && idx >= 0 && idx <= feed.length) {
      setCurrentIndex(idx);
    }
  }, [currentIndex, feed.length]);

  // Called when user picks an option on a quiz/scenario card
  const handleAnswer = useCallback((conceptId, isCorrect, format) => {
    recordAnswer(conceptId, isCorrect, format);

    setSessionAnswered(n => n + 1);
    if (isCorrect) {
      setSessionCorrect(n => n + 1);
      setSessionStreak(n => n + 1);
    } else {
      setSessionStreak(0);
    }

    // Update the mastery score shown on the current card without rebuilding feed order
    setFeed(prev => prev.map(c =>
      c.concept_id === conceptId
        ? { ...c, mastery: { ...c.mastery, score: Math.max(0, Math.min(100, (c.mastery?.score || 0) + (isCorrect ? 10 : -5))) } }
        : c
    ));
  }, []);

  // Called when a rule card becomes active (passive reinforcement)
  const handleView = useCallback((conceptId) => {
    recordView(conceptId);
  }, []);

  if (feed.length === 0) {
    return <div className="loading">Loading study materials...</div>;
  }

  const weakTopics = getWeakTopics(cards);

  return (
    <>
      {onExit && (
        <button className="feed-back-btn" onClick={onExit}>← Modes</button>
      )}
      <ProgressHUD
        correct={sessionCorrect}
        answered={sessionAnswered}
        streak={sessionStreak}
      />

      <div className="feed-container" ref={feedRef} onScroll={handleScroll}>
        {feed.map((card, index) => (
          <StudyCard
            key={card.concept_id}
            data={card}
            isActive={index === currentIndex}
            onAnswer={(isCorrect, fmt) => handleAnswer(card.concept_id, isCorrect, fmt)}
            onView={() => handleView(card.concept_id)}
          />
        ))}

        {/* End-of-feed summary */}
        <div className="end-of-feed">
          <h2>Session Complete</h2>
          <p className="end-sub">
            {sessionAnswered > 0
              ? `${sessionCorrect}/${sessionAnswered} correct · ${Math.round((sessionCorrect / sessionAnswered) * 100)}% accuracy`
              : 'No questions answered yet.'}
          </p>
          {weakTopics.length > 0 && (
            <div className="weak-topics">
              <p className="weak-title">Focus areas:</p>
              {weakTopics.slice(0, 3).map(({ topic, avg }) => (
                <div key={topic} className="weak-row">
                  <span>{topic}</span>
                  <span className="weak-score" style={{ color: avg >= 70 ? '#10b981' : avg >= 35 ? '#f59e0b' : '#ef4444' }}>
                    {avg}%
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="end-cta">Scroll up to keep drilling.</p>
        </div>
      </div>
    </>
  );
};

export default Feed;
