import React, { useState } from 'react';
import './LessonCard.css';

const TOPIC_COLORS = {
  'EC2 Auto Scaling':     '#e67e22',
  'S3 Storage Classes':   '#2980b9',
  'IAM':                  '#c0392b',
  'VPC & Security Groups':'#27ae60',
  'Elastic Load Balancing':'#8e44ad',
  'RDS vs DynamoDB':      '#16a085',
  'AWS Lambda':           '#d35400',
  'CloudFront CDN':       '#2471a3',
  'Route 53':             '#1a5276',
  'SQS vs SNS':           '#117a65',
  'EBS vs EFS vs S3':     '#6c3483',
  'Amazon Aurora':        '#1e8bc3',
  'Encryption & KMS':     '#922b21',
  'High Availability':    '#1f618d',
  'Cost Optimization':    '#b7950b',
};

export default function LessonCard({ lesson }) {
  const [flipped, setFlipped] = useState(false);
  const [page, setPage] = useState(0);

  const pages = lesson.lesson_pages;
  const accentColor = TOPIC_COLORS[lesson.topic] || '#444';

  const flip = () => {
    setFlipped(true);
    setPage(0);
  };

  const unflip = (e) => {
    e.stopPropagation();
    setFlipped(false);
  };

  const goNext = (e) => {
    e.stopPropagation();
    if (page < pages.length - 1) setPage(p => p + 1);
  };

  const goPrev = (e) => {
    e.stopPropagation();
    if (page > 0) setPage(p => p - 1);
  };

  return (
    <div className={`lc-card ${flipped ? 'lc-flipped' : ''}`} onClick={!flipped ? flip : undefined}>
      <div className="lc-inner">

        {/* ── FRONT ── */}
        <div className="lc-face lc-front" style={{ '--accent': accentColor }}>
          <div className="lc-front-glow" style={{ background: accentColor }} />
          <span className="lc-topic-badge" style={{ background: accentColor }}>
            {lesson.topic}
          </span>
          <h2 className="lc-headline">{lesson.headline}</h2>
          {lesson.subheadline && (
            <p className="lc-subheadline">{lesson.subheadline}</p>
          )}
          <div className="lc-tap-hint">
            <span>Tap to reveal</span>
            <span className="lc-tap-arrow">↓</span>
          </div>
        </div>

        {/* ── BACK ── */}
        <div className="lc-face lc-back">
          <div className="lc-back-accent" style={{ background: accentColor }} />
          <span className="lc-topic-badge lc-badge-back" style={{ background: accentColor }}>
            {lesson.topic}
          </span>

          <div className="lc-page">
            <h3 className="lc-page-title">{pages[page].title}</h3>
            <p className="lc-page-body">{pages[page].body}</p>
          </div>

          {pages.length > 1 && (
            <div className="lc-page-nav">
              <button
                className="lc-nav-btn"
                onClick={goPrev}
                disabled={page === 0}
                aria-label="Previous"
              >←</button>
              <div className="lc-dots">
                {pages.map((_, i) => (
                  <span key={i} className={`lc-dot ${i === page ? 'lc-dot-active' : ''}`}
                    style={i === page ? { background: accentColor } : {}} />
                ))}
              </div>
              <button
                className="lc-nav-btn"
                onClick={goNext}
                disabled={page === pages.length - 1}
                aria-label="Next"
              >→</button>
            </div>
          )}

          <button className="lc-back-btn" onClick={unflip}>↩ Back</button>
        </div>

      </div>
    </div>
  );
}
