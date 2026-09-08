/**
 * Storage Manager for English 16 Lessons Game
 * Handles local persistence of XP, completed lessons, streaks, and settings.
 */

const STORAGE_KEY = 'polyglot_english_16_state';

const defaultState = {
  xp: 0,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  completedLessons: {}, // { 1: { score: 10, total: 10, percent: 100, date: '...' } }
  mistakes: [], // list of question IDs or question objects failed
  theme: 'dark',
  soundEnabled: true
};

export const storage = {
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return { ...defaultState };
      const parsed = JSON.parse(data);
      return { ...defaultState, ...parsed };
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
      return { ...defaultState };
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  },

  addXP(amount) {
    const state = this.load();
    state.xp = (state.xp || 0) + amount;
    this.checkStreak(state);
    this.save(state);
    return state.xp;
  },

  checkStreak(state) {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.lastActiveDate) {
      state.lastActiveDate = today;
      state.streakDays = 1;
      return;
    }
    if (state.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (state.lastActiveDate === yesterday) {
        state.streakDays = (state.streakDays || 1) + 1;
      } else {
        state.streakDays = 1;
      }
      state.lastActiveDate = today;
    }
  },

  recordLessonComplete(lessonId, score, total) {
    const state = this.load();
    const percent = Math.round((score / total) * 100);
    const existing = state.completedLessons[lessonId];
    
    // Only update if better or first time
    if (!existing || percent >= existing.percent) {
      state.completedLessons[lessonId] = {
        score,
        total,
        percent,
        date: new Date().toISOString().slice(0, 10)
      };
    }

    // Award bonus XP for completing lesson
    const bonusXp = score * 10 + (percent === 100 ? 50 : 0);
    state.xp = (state.xp || 0) + bonusXp;

    this.checkStreak(state);
    this.save(state);
    return { state, bonusXp };
  },

  recordMistake(question) {
    const state = this.load();
    if (!state.mistakes) state.mistakes = [];
    if (!state.mistakes.find(m => m.id === question.id)) {
      state.mistakes.push(question);
      this.save(state);
    }
  },

  removeMistake(questionId) {
    const state = this.load();
    if (!state.mistakes) return;
    state.mistakes = state.mistakes.filter(m => m.id !== questionId);
    this.save(state);
  },

  clearMistakes() {
    const state = this.load();
    state.mistakes = [];
    this.save(state);
  },

  setTheme(theme) {
    const state = this.load();
    state.theme = theme;
    this.save(state);
  },

  setSound(enabled) {
    const state = this.load();
    state.soundEnabled = enabled;
    this.save(state);
  },

  resetAllProgress() {
    localStorage.removeItem(STORAGE_KEY);
    return { ...defaultState };
  }
};
