/**
 * Quiz Engine for English 16 Lessons Game
 * Manages question progression, score tracking, hints, feedback, and mistakes.
 */

import { sound } from './speech.js';
import { storage } from './storage.js';

export class QuizEngine {
  constructor(options = {}) {
    this.onProgress = options.onProgress || (() => {});
    this.onFinish = options.onFinish || (() => {});
    this.lesson = null;
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.isAnswered = false;
    this.mistakesInSession = [];
    this.isReviewMode = false;
  }

  startLesson(lessonData, isReview = false) {
    this.lesson = lessonData;
    this.isReviewMode = isReview;
    this.questions = this.prepareQuestions(lessonData.questions || []);
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.isAnswered = false;
    this.mistakesInSession = [];
    this.renderCurrent();
  }

  prepareQuestions(list) {
    // Clone and shuffle options while preserving the correct answer string
    return list.map(q => {
      const cloned = { ...q };
      const correctText = q.options[q.answer];
      // Shuffle options
      const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
      cloned.options = shuffledOptions;
      cloned.answer = shuffledOptions.indexOf(correctText);
      return cloned;
    });
  }

  getCurrentQuestion() {
    if (this.currentIndex >= this.questions.length) return null;
    return this.questions[this.currentIndex];
  }

  renderCurrent() {
    const q = this.getCurrentQuestion();
    if (!q) {
      this.finish();
      return;
    }

    this.isAnswered = false;
    this.onProgress({
      question: q,
      currentIndex: this.currentIndex,
      total: this.questions.length,
      score: this.score,
      combo: this.combo,
      lesson: this.lesson,
      isReviewMode: this.isReviewMode
    });
  }

  submitAnswer(optionIndex) {
    if (this.isAnswered) return null;
    this.isAnswered = true;

    const q = this.getCurrentQuestion();
    const isCorrect = optionIndex === q.answer;

    if (isCorrect) {
      this.score++;
      this.combo++;
      storage.addXP(10 + Math.min(this.combo * 2, 10)); // combo bonus XP
      sound.playSuccess();
      if (this.isReviewMode) {
        storage.removeMistake(q.id);
      }
    } else {
      this.combo = 0;
      sound.playError();
      this.mistakesInSession.push(q);
      storage.recordMistake(q);
    }

    return {
      isCorrect,
      selectedIndex: optionIndex,
      correctIndex: q.answer,
      explanation: q.explanation,
      hint: q.hint,
      speechText: q.speechText,
      score: this.score,
      combo: this.combo
    };
  }

  nextQuestion() {
    this.currentIndex++;
    this.renderCurrent();
  }

  finish() {
    let result = {
      score: this.score,
      total: this.questions.length,
      percent: Math.round((this.score / (this.questions.length || 1)) * 100),
      lesson: this.lesson,
      mistakes: this.mistakesInSession,
      isReviewMode: this.isReviewMode
    };

    if (!this.isReviewMode && this.lesson && this.lesson.id) {
      const record = storage.recordLessonComplete(this.lesson.id, this.score, this.questions.length);
      result.bonusXp = record.bonusXp;
    }

    this.onFinish(result);
  }
}
