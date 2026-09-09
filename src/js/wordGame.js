/**
 * Word Guessing Game Engine (Interactive Vocabulary Trainer)
 * Supports Bidirectional Learning: EN -> UA, UA -> EN, and Mixed Mode
 */

import { sound } from './speech.js';
import { storage } from './storage.js';

export class WordGame {
  constructor(dictionaryData = [], options = {}) {
    this.dictionary = dictionaryData;
    this.mode = 'en_to_ua'; // 'en_to_ua' | 'ua_to_en' | 'random'
    this.roundsTotal = 10;
    this.currentRound = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isAnswered = false;
    this.currentQuestion = null;
    this.mistakes = [];
    this.activeWordsPool = [];
    this.onProgress = options.onProgress || (() => {});
    this.onFinish = options.onFinish || (() => {});
  }

  setDictionary(dict) {
    this.dictionary = dict;
  }

  startGame(mode = 'en_to_ua', rounds = 10, specificWords = null) {
    this.mode = mode;
    this.roundsTotal = rounds;
    this.currentRound = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isAnswered = false;
    this.mistakes = [];

    if (specificWords && specificWords.length > 0) {
      this.activeWordsPool = [...specificWords].sort(() => Math.random() - 0.5);
      this.roundsTotal = this.activeWordsPool.length;
    } else {
      // Pick random pool efficiently from large dictionary without sorting entire array
      const poolSize = Math.min(this.roundsTotal * 2, this.dictionary.length);
      const chosenIndices = new Set();
      const pool = [];
      let attempts = 0;
      while (pool.length < poolSize && attempts < poolSize * 10) {
        attempts++;
        const randIdx = Math.floor(Math.random() * this.dictionary.length);
        if (!chosenIndices.has(randIdx)) {
          chosenIndices.add(randIdx);
          const candidate = this.dictionary[randIdx];
          if (candidate && candidate.ua && candidate.ua.length > 1 && candidate.en && candidate.en.length > 1) {
            pool.push(candidate);
          }
        }
      }
      this.activeWordsPool = pool.length > 0 ? pool : this.dictionary.slice(0, poolSize);
    }

    this.nextRound();
  }

  generateQuestion() {
    if (this.currentRound >= this.roundsTotal || this.activeWordsPool.length === 0) {
      return null;
    }

    const targetWord = this.activeWordsPool[this.currentRound % this.activeWordsPool.length];

    // Determine direction for this question
    let questionDirection = this.mode;
    if (this.mode === 'random') {
      questionDirection = Math.random() > 0.5 ? 'en_to_ua' : 'ua_to_en';
    }

    // Select 3 random distractors distinct from targetWord
    const distractors = [];
    const usedIndices = new Set();
    while (distractors.length < 3 && distractors.length < this.dictionary.length - 1) {
      const randIdx = Math.floor(Math.random() * this.dictionary.length);
      const candidate = this.dictionary[randIdx];
      if (candidate && candidate.id !== targetWord.id && !usedIndices.has(randIdx)) {
        usedIndices.add(randIdx);
        distractors.push(candidate);
      }
    }

    // Prepare choices
    let prompt = '';
    let speechPrompt = '';
    let hint = '';
    let correctChoice = '';
    let options = [];

    if (questionDirection === 'en_to_ua') {
      prompt = targetWord.en;
      speechPrompt = targetWord.en;
      hint = targetWord.transcription || '';
      correctChoice = targetWord.ua_keywords && targetWord.ua_keywords.length > 0 
        ? targetWord.ua_keywords.join(', ') 
        : targetWord.ua.split(';')[0];

      const distractorChoices = distractors.map(d => 
        (d.ua_keywords && d.ua_keywords.length > 0) ? d.ua_keywords.join(', ') : d.ua.split(';')[0]
      );
      options = [correctChoice, ...distractorChoices];
    } else {
      // UA -> EN
      const uaPrompt = targetWord.ua_keywords && targetWord.ua_keywords.length > 0 
        ? targetWord.ua_keywords.join(', ') 
        : targetWord.ua.split(';')[0];
      prompt = uaPrompt;
      speechPrompt = targetWord.en;
      hint = 'Оберіть правильний англійський відповідник';
      correctChoice = targetWord.en;

      const distractorChoices = distractors.map(d => d.en);
      options = [correctChoice, ...distractorChoices];
    }

    // Shuffle options
    const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(correctChoice);

    return {
      direction: questionDirection,
      targetWord,
      prompt,
      speechPrompt: targetWord.en,
      hint,
      options: shuffledOptions,
      correctIndex,
      fullUa: targetWord.ua,
      fullEn: targetWord.en
    };
  }

  nextRound() {
    this.currentRound++;
    if (this.currentRound > this.roundsTotal) {
      this.finish();
      return;
    }

    this.isAnswered = false;
    this.currentQuestion = this.generateQuestion();

    if (!this.currentQuestion) {
      this.finish();
      return;
    }

    this.onProgress({
      round: this.currentRound,
      total: this.roundsTotal,
      score: this.score,
      combo: this.combo,
      question: this.currentQuestion
    });
  }

  submitChoice(index) {
    if (this.isAnswered || !this.currentQuestion) return null;
    this.isAnswered = true;

    const isCorrect = index === this.currentQuestion.correctIndex;

    if (isCorrect) {
      this.score++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const gainedXP = 10 + Math.min(this.combo * 2, 10);
      storage.addXP(gainedXP);
      sound.playSuccess();
    } else {
      this.combo = 0;
      sound.playError();
      this.mistakes.push(this.currentQuestion.targetWord);
    }

    // Speak the English word automatically on answer
    if (this.currentQuestion.speechPrompt) {
      setTimeout(() => sound.speak(this.currentQuestion.speechPrompt), 150);
    }

    return {
      isCorrect,
      selectedIndex: index,
      correctIndex: this.currentQuestion.correctIndex,
      targetWord: this.currentQuestion.targetWord,
      score: this.score,
      combo: this.combo
    };
  }

  finish() {
    const percent = Math.round((this.score / (this.roundsTotal || 1)) * 100);
    const bonusXp = this.score * 12 + (percent >= 80 ? 30 : 0);
    storage.addXP(bonusXp);

    this.onFinish({
      score: this.score,
      total: this.roundsTotal,
      percent,
      maxCombo: this.maxCombo,
      bonusXp,
      mistakes: this.mistakes
    });
  }
}
