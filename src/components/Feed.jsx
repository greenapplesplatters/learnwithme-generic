import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import StudyCard from './StudyCard.jsx';
import ProgressHUD from './ProgressHUD.jsx';
import { buildAdaptiveFeed, getWeakTopics } from '../utils/adaptiveFeed.js';
import { recordAnswer, recordView } from '../utils/mastery.js';
import './Feed.css';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Feed = ({ onExit, cards }) => {
  const [feed, setFeed] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const feedRef = useRef(null);

  // Session stats (reset on page refresh — not persisted)
  const [sessionCorrect, setSessionCorrect]   = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionStreak, setSessionStreak]     = useState(0);

  // Topic filter + shuffle state
  const [activeTopic, setActiveTopic] = useState('All');
  const [shuffled, setShuffled] = useState(false);

  // Build the adaptive feed once on mount (order is based on stored mastery)
  useEffect(() => {
    setFeed(buildAdaptiveFeed(cards));
  }, [cards]);

  // Derive unique topics from feed
  const topics = useMemo(() => {
    const seen = new Set();
    feed.forEach(c => c.topic && seen.add(c.topic));
    return ['All', ...Array.from(seen)];
  }, [feed]);

  // Apply topic filter + optional shuffle
  const visibleFeed = useMemo(() => {
    let f = activeTopic === 'All' ? feed : feed.filter(c => c.topic === activeTopic);
    if (shuffled) f = shuffleArr(f);
    return f;
  }, [feed, activeTopic, shuffled]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const idx = Math.round(feedRef.current.scrollTop / window.innerHeight);
    if (idx !== currentIndex && idx >= 0 && idx <= visibleFeed.length) {
      setCurrentIndex(idx);
    }
  }, [currentIndex, visibleFeed.length]);

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

      {/* Topic filter chip bar */}
      <div className="feed-chip-bar">
        {topics.map(t => (
          <button
            key={t}
            className={`feed-chip ${activeTopic === t ? 'feed-chip-active' : ''}`}
            onClick={() => { setActiveTopic(t); setCurrentIndex(0); feedRef.current?.scrollTo(0, 0); }}
          >
            {t}
          </button>
        ))}
        <span className="chip-divider" />
        <button
          className={`feed-chip feed-chip-shuffle ${shuffled ? 'feed-chip-active' : ''}`}
          onClick={() => setShuffled(s => !s)}
        >
          🔀 Shuffle
        </button>
      </div>

      <div className="feed-container" ref={feedRef} onScroll={handleScroll}>
        {visibleFeed.map((card, index) => (
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
