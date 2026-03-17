const SUBJECTS_KEY = 'lwm_subjects_v1';
const ACTIVE_KEY   = 'lwm_active_subject';

export function getSubjects() {
  try { return JSON.parse(localStorage.getItem(SUBJECTS_KEY) || '{}'); }
  catch { return {}; }
}

export function saveSubject(id, name, cards) {
  const all = getSubjects();
  all[id] = { id, name, cards, updatedAt: Date.now() };
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(all));
}

export function deleteSubject(id) {
  const all = getSubjects();
  delete all[id];
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(all));
  if (getActiveSubjectId() === id) localStorage.removeItem(ACTIVE_KEY);
}

export function getActiveSubjectId() {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveSubjectId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveSubject() {
  const id = getActiveSubjectId();
  if (!id) return null;
  return getSubjects()[id] || null;
}

export function subjectIdFromName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
