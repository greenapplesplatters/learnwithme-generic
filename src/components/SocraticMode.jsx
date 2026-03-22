import React, { useState, useEffect, useRef } from 'react';
import './SocraticMode.css';

const MAX_INPUT_LENGTH = 500;

const INJECTION_PATTERNS = [
  /(ignore|disregard|forget|override|skip|drop|cancel|delete|erase|wipe|clear)\s+.{0,30}(instructions|rules|prompt|guidelines|directives|constraints|boundaries|limitations|programming)/i,
  /you\s+are\s+now\s+(a|an|my)\s+/i,
  /act\s+as\s+(a|an|my|if)\s+/i,
  /pretend\s+(you('re|\s+are)\s+|to\s+be\s+)/i,
  /new\s+(instructions|rules|prompt|role|persona)/i,
  /system\s*prompt/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /bypass\s+(your|the|all)\s+(rules|filters|restrictions|limitations|guidelines)/i,
  /from\s+now\s+on/i,
  /for\s+the\s+rest\s+of\s+(this|our)\s+(conversation|chat|session)/i,
  /respond\s+(only\s+)?(in|with|as)/i,
  /\brole\s*play/i,
  /stop\s+being\s+(a\s+)?socratic/i,
  /you\s+must\s+obey/i,
  /I\s+command\s+you/i,
];

function detectInjection(text) {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

const MAX_STRIKES = 2;
const LOCKOUT_KEY = 'socratic_lockout';
const LOCKOUT_DURATION = 15 * 60 * 1000;

function isLockedOut() {
  try {
    const lockout = localStorage.getItem(LOCKOUT_KEY);
    if (!lockout) return false;
    const expiry = JSON.parse(lockout);
    if (Date.now() < expiry) return true;
    localStorage.removeItem(LOCKOUT_KEY);
    return false;
  } catch { return false; }
}

function setLockout() {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(Date.now() + LOCKOUT_DURATION));
}

const SESSION_PREFIX = 'socratic_session_';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_MESSAGES = 36;

function getSessionKey(t) {
  return SESSION_PREFIX + t.toLowerCase().replace(/\s+/g, '_');
}

function saveSession(t, msgs) {
  try {
    const trimmed = msgs.slice(-SESSION_MAX_MESSAGES);
    localStorage.setItem(getSessionKey(t), JSON.stringify({ messages: trimmed, savedAt: Date.now() }));
  } catch { /* storage full — degrade gracefully */ }
}

function loadSession(t) {
  try {
    const raw = localStorage.getItem(getSessionKey(t));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > SESSION_MAX_AGE) {
      localStorage.removeItem(getSessionKey(t));
      return null;
    }
    return data.messages;
  } catch { return null; }
}

function clearSession(t) {
  localStorage.removeItem(getSessionKey(t));
}

function hasSession(t) {
  try {
    const raw = localStorage.getItem(getSessionKey(t));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > SESSION_MAX_AGE) return false;
    return data.messages?.length > 0;
  } catch { return false; }
}

function topicColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 55%, 50%)`;
}

const PERSONALITIES = [
  {
    id: 'socratic',
    icon: '🏛️',
    label: 'Socrates',
    desc: 'The ancient philosopher. Questions that reveal what you don\'t know.',
    avatarLabel: 'S',
  },
  {
    id: 'tutor',
    icon: '👨‍🏫',
    label: 'Direct Tutor',
    desc: 'Clear Q&A. Honest feedback. Builds from fundamentals up.',
    avatarLabel: 'T',
  },
  {
    id: 'gameshow',
    icon: '🎤',
    label: 'Game Show',
    desc: 'High stakes. Dramatic reveals. Prime time energy.',
    avatarLabel: '★',
  },
];

export default function SocraticMode({ onExit, subject }) {
  const ALL_TOPICS = [...new Set((subject?.cards || []).map(c => c.topic))];

  const [personality, setPersonality] = useState(null);
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [terminated, setTerminated] = useState(false);
  const [pendingResume, setPendingResume] = useState(null);
  const strikesRef = useRef(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isLockedOut()) setTerminated(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    if (!streaming && topic && messages.length > 0) {
      saveSession(topic, messages);
    }
  }, [streaming, messages, topic]);

  useEffect(() => {
    if (!topic) return;
    const saved = loadSession(topic);
    if (saved && saved.length > 0) {
      setPendingResume(saved);
    } else {
      setMessages([]);
      askAI([], topic);
    }
  }, [topic]);

  async function askAI(history, selectedTopic) {
    const currentTopic = selectedTopic || topic;
    setStreaming(true);
    setError(null);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.name,
          topic: currentTopic,
          history,
          personality: personality || 'socratic',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.error === 'session_terminated') {
          setLockout();
          setTerminated(true);
          return;
        }
        if (errData.error === 'injection_blocked') {
          strikesRef.current += 1;
          if (strikesRef.current >= MAX_STRIKES) {
            setLockout();
            setTerminated(true);
            return;
          }
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: `${errData.message}\n\nStrike ${strikesRef.current} of ${MAX_STRIKES}. One more and this session ends.` };
            return updated;
          });
          return;
        }
        if (response.status === 429) {
          strikesRef.current += 1;
          if (strikesRef.current >= MAX_STRIKES) {
            setLockout();
            setTerminated(true);
            return;
          }
        }
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text, error: streamErr } = JSON.parse(payload);
            if (streamErr) throw new Error(streamErr);
            if (text) {
              full += text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: full };
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;
    let sanitized = input.trim();
    if (sanitized.length > MAX_INPUT_LENGTH) sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);

    if (detectInjection(sanitized)) {
      strikesRef.current += 1;
      if (strikesRef.current >= MAX_STRIKES) {
        setLockout();
        setTerminated(true);
        return;
      }
      const blocked = { role: 'user', content: sanitized };
      const refusal = { role: 'assistant', content: `That looks like an attempt to change my instructions. I'm your tutor for ${topic} — nothing else. This is strike ${strikesRef.current} of ${MAX_STRIKES}. One more and this session ends.\n\nBack to ${topic}:` };
      setMessages(prev => [...prev, blocked, refusal]);
      setInput('');
      return;
    }

    const userMessage = { role: 'user', content: sanitized };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput('');
    await askAI(updatedHistory.slice(-SESSION_MAX_MESSAGES).map(m => ({ role: m.role, content: m.content })), topic);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChangeTopic() {
    setTopic(null);
    setMessages([]);
    setError(null);
  }

  const activePersonality = PERSONALITIES.find(p => p.id === (personality || 'socratic'));

  // -- Session terminated --
  if (terminated) {
    return (
      <div className="socratic-select">
        <div className="socratic-select-header">
          <h1 className="socratic-title" style={{ color: '#ef4444' }}>Session Terminated</h1>
          <span className="socratic-subtitle">
            Socratic Mode has been locked due to repeated policy violations. Try again later.
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="socratic-exit-btn" onClick={onExit} style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
            &larr; Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // -- Personality picker --
  if (!personality) {
    return (
      <div className="socratic-select">
        <div className="socratic-select-header">
          <button className="socratic-exit-btn" onClick={onExit}>&larr; Exit</button>
          <h1 className="socratic-title">Socratic Mode</h1>
          <span className="socratic-subtitle">Choose your guide</span>
        </div>
        <div className="socratic-personality-grid">
          {PERSONALITIES.map(p => (
            <button
              key={p.id}
              className="socratic-personality-btn"
              onClick={() => setPersonality(p.id)}
            >
              <span className="socratic-personality-icon">{p.icon}</span>
              <span className="socratic-personality-label">{p.label}</span>
              <span className="socratic-personality-desc">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -- Resume prompt --
  if (pendingResume) {
    const accentColor = topicColor(topic);
    return (
      <div className="socratic-select">
        <div className="socratic-select-header">
          <h1 className="socratic-title">Continue Session?</h1>
          <span className="socratic-subtitle">
            You have a previous session on <strong style={{ color: accentColor }}>{topic}</strong> ({pendingResume.length} messages).
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          <button
            className="socratic-topic-btn"
            style={{ '--accent': accentColor, minWidth: '160px' }}
            onClick={() => { setMessages(pendingResume); setPendingResume(null); }}
          >
            Continue
          </button>
          <button
            className="socratic-topic-btn"
            style={{ '--accent': '#6b7280', minWidth: '160px' }}
            onClick={() => { clearSession(topic); setPendingResume(null); setMessages([]); askAI([], topic); }}
          >
            Start Fresh
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button className="socratic-exit-btn" onClick={() => { setPendingResume(null); setTopic(null); }}>
            &larr; Back to Topics
          </button>
        </div>
      </div>
    );
  }

  // -- Topic selector --
  if (!topic) {
    return (
      <div className="socratic-select">
        <div className="socratic-select-header">
          <button className="socratic-exit-btn" onClick={onExit}>&larr; Exit</button>
          <h1 className="socratic-title">Socratic Mode</h1>
          <span className="socratic-subtitle">{activePersonality.icon} {activePersonality.label} · Pick a topic</span>
        </div>
        <div className="socratic-topic-grid">
          {ALL_TOPICS.map(t => (
            <button
              key={t}
              className="socratic-topic-btn"
              style={{ '--accent': topicColor(t) }}
              onClick={() => setTopic(t)}
            >
              <span className="socratic-topic-dot" style={{ background: topicColor(t) }} />
              {t}
              {hasSession(t) && <span style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: '0.4rem' }}>resume</span>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '1rem' }}>
          <button className="socratic-exit-btn" onClick={() => setPersonality(null)}>
            ← Change Guide
          </button>
        </div>
      </div>
    );
  }

  const accentColor = topicColor(topic);

  // -- Chat view --
  return (
    <div className="socratic-chat">
      {/* Header */}
      <div className="socratic-header" style={{ '--accent': accentColor }}>
        <button className="socratic-exit-btn" onClick={onExit}>&larr; Exit</button>
        <div className="socratic-header-center">
          <span className="socratic-header-mode">{activePersonality.icon} {activePersonality.label}</span>
          <button className="socratic-topic-pill" style={{ background: accentColor }} onClick={handleChangeTopic}>
            {topic} &darr;
          </button>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Messages */}
      <div className="socratic-messages">
        {messages.length === 0 && !streaming && !error && (
          <div className="socratic-loading">
            <span className="socratic-dot-pulse" />
            <span className="socratic-dot-pulse" />
            <span className="socratic-dot-pulse" />
          </div>
        )}

        {error && (
          <div className="socratic-error">{error}</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`socratic-bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="socratic-avatar" style={{ background: accentColor }}>{activePersonality.avatarLabel}</div>
            )}
            <div className={`socratic-bubble ${msg.role}`} style={msg.role === 'assistant' ? { '--accent': accentColor } : {}}>
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="socratic-cursor" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="socratic-input-bar">
        <textarea
          ref={inputRef}
          className="socratic-input"
          placeholder="Your answer..."
          value={input}
          maxLength={MAX_INPUT_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
        />
        <button
          className="socratic-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          style={{ background: accentColor }}
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}
