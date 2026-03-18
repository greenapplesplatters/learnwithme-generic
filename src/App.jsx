import React, { useState } from 'react';
import ModeSelect from './components/ModeSelect';
import Feed from './components/Feed';
import ChallengeMode from './components/ChallengeMode';
import StudyMode from './components/StudyMode';
import SubjectSetup from './components/SubjectSetup';
import {
  getActiveSubject,
  saveSubject,
  setActiveSubjectId,
  subjectIdFromName,
} from './utils/subjects.js';
import './index.css';

function App() {
  const [mode, setMode] = useState(null); // null | 'learn' | 'study' | 'challenge' | 'setup'
  const [activeSubject, setActiveSubject] = useState(() => getActiveSubject());

  const handleSubjectComplete = (name, cards, lessons) => {
    const id = subjectIdFromName(name);
    saveSubject(id, name, cards, lessons);
    setActiveSubjectId(id);
    setActiveSubject({ id, name, cards, lessons, updatedAt: Date.now() });
    setMode(null);
  };

  // No subject yet, or user clicked "Change Subject"
  if (!activeSubject || mode === 'setup') {
    return <SubjectSetup onComplete={handleSubjectComplete} />;
  }

  return (
    <div className="app-container">
      {mode === null && (
        <ModeSelect
          onSelect={setMode}
          subject={activeSubject}
          onChangeSubject={() => setMode('setup')}
        />
      )}
      {mode === 'learn' && (
        <StudyMode onExit={() => setMode(null)} lessons={activeSubject.lessons} />
      )}
      {mode === 'study' && (
        <Feed onExit={() => setMode(null)} cards={activeSubject.cards} />
      )}
      {mode === 'challenge' && (
        <ChallengeMode onExit={() => setMode(null)} cards={activeSubject.cards} />
      )}
    </div>
  );
}

export default App;
