import React, { useState } from 'react';
import './SubjectSetup.css';

const SubjectSetup = ({ onComplete }) => {
  const [phase, setPhase]             = useState('name'); // 'name'|'loading-topics'|'topics'|'generating'
  const [subjectName, setSubjectName] = useState('');
  const [topics, setTopics]           = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [customTopic, setCustomTopic] = useState('');
  const [progress, setProgress]       = useState({ done: 0, total: 0 });
  const [error, setError]             = useState('');

  // ── Step 1: fetch suggested topics ────────────────────────────────────────
  const fetchTopics = async () => {
    if (!subjectName.trim()) return;
    setPhase('loading-topics');
    setError('');
    try {
      const res  = await fetch('/api/suggest-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectName.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTopics(data.topics);
      setSelected(new Set(data.topics));
      setPhase('topics');
    } catch (e) {
      setError(e.message);
      setPhase('name');
    }
  };

  // ── Step 2: add/remove topics ─────────────────────────────────────────────
  const toggleTopic = (t) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const addCustom = () => {
    const t = customTopic.trim();
    if (!t || topics.includes(t)) return;
    setTopics(prev => [...prev, t]);
    setSelected(prev => new Set([...prev, t]));
    setCustomTopic('');
  };

  // ── Step 3: generate cards + lessons ─────────────────────────────────────
  const generate = async () => {
    const topicList = topics.filter(t => selected.has(t));
    if (!topicList.length) return;
    setProgress({ done: 0, total: topicList.length });
    setPhase('generating');
    setError('');

    const allCards = [];
    for (const topic of topicList) {
      try {
        const res  = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: subjectName.trim(), topic, cardsPerTopic: 3 }),
        });
        const data = await res.json();
        if (data.cards) allCards.push(...data.cards);
      } catch { /* skip failed topic */ }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }

    // Generate sensationalist lesson cards for Study Mode
    let allLessons = [];
    try {
      const res = await fetch('/api/generate-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectName.trim(), topics: topicList }),
      });
      const data = await res.json();
      console.log('Lessons API response:', res.status, data);
      if (data.lessons) allLessons = data.lessons;
      if (data.error) console.error('Lessons API error:', data.error);
    } catch (err) {
      console.error('Lessons API fetch failed:', err.message);
    }

    onComplete(subjectName.trim(), allCards, allLessons);
  };

  // ── Generating screen ──────────────────────────────────────────────────────
  if (phase === 'generating') {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="setup-container">
        <div className="setup-card">
          <div className="setup-icon">🧠</div>
          <h2 className="setup-title">Building your deck</h2>
          <p className="setup-sub">{subjectName}</p>
          <div className="setup-progress-track">
            <div className="setup-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="setup-progress-label">{progress.done} / {progress.total} topics</p>
        </div>
      </div>
    );
  }

  // ── Loading topics screen ──────────────────────────────────────────────────
  if (phase === 'loading-topics') {
    return (
      <div className="setup-container">
        <div className="setup-card">
          <div className="setup-spinner" />
          <p className="setup-sub">
            Finding topics for <strong>{subjectName}</strong>…
          </p>
        </div>
      </div>
    );
  }

  // ── Topics selection screen ────────────────────────────────────────────────
  if (phase === 'topics') {
    const selectedCount = topics.filter(t => selected.has(t)).length;
    return (
      <div className="setup-container">
        <div className="setup-card setup-card--wide">
          <h2 className="setup-title">Choose your topics</h2>
          <p className="setup-sub">{subjectName} · {selectedCount} selected</p>

          <div className="topic-chips">
            {topics.map(t => (
              <button
                key={t}
                className={`topic-chip ${selected.has(t) ? 'selected' : ''}`}
                onClick={() => toggleTopic(t)}
              >
                {selected.has(t) ? '✓ ' : ''}{t}
              </button>
            ))}
          </div>

          <div className="custom-topic-row">
            <input
              className="setup-input"
              placeholder="Add a topic…"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
            />
            <button className="btn-add-topic" onClick={addCustom}>+</button>
          </div>

          <button
            className="btn-generate"
            onClick={generate}
            disabled={selectedCount === 0}
          >
            Generate {selectedCount} topic{selectedCount !== 1 ? 's' : ''} →
          </button>
        </div>
      </div>
    );
  }

  // ── Subject name screen ────────────────────────────────────────────────────
  return (
    <div className="setup-container">
      <div className="setup-card">
        <span className="setup-logo-icon">⚡</span>
        <h1 className="setup-logo-title">LearnWithMe</h1>
        <p className="setup-prompt">What do you want to study?</p>
        <input
          className="setup-input setup-input--large"
          placeholder="e.g. AP Biology, Spanish B2, Roman History…"
          value={subjectName}
          onChange={e => setSubjectName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchTopics()}
          autoFocus
        />
        {error && <p className="setup-error">{error}</p>}
        <button
          className="btn-generate"
          onClick={fetchTopics}
          disabled={!subjectName.trim()}
        >
          Continue →
        </button>
      </div>
    </div>
  );
};

export default SubjectSetup;
