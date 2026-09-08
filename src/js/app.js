/**
 * Main Application Orchestrator
 * English 16 Lessons (Dmitry Petrov Method) for Ukrainian Speakers
 */

import { storage } from './storage.js';
import { sound } from './speech.js';
import { QuizEngine } from './quizEngine.js';
import { verbMatrixData } from './verbMatrix.js';
import { DictionaryPageController } from './dictionaryPage.js';

class App {
  constructor() {
    this.lessons = [];
    this.dictionary = [];
    this.currentLesson = null;
    this.activeScreen = 'screen-dashboard';
    this.currentPronoun = 'I';
    this.currentVerb = 'love';

    this.quiz = new QuizEngine({
      onProgress: (data) => this.renderQuizProgress(data),
      onFinish: (result) => this.renderQuizResults(result)
    });

    this.dictController = new DictionaryPageController();

    this.init();
  }

  async init() {
    this.initTheme();
    this.initEventListeners();
    await this.loadData();
    this.updateHeaderStats();
    this.renderDashboard();
    this.initVerbMatrix();
    this.renderDictionary();
    await this.dictController.init();
  }

  /* --------------------------------------------------------------------------
     Data Loading
  -------------------------------------------------------------------------- */
  async loadData() {
    try {
      const lessonsRes = await fetch('./data/lessons_data.json');
      this.lessons = await lessonsRes.json();
    } catch (e) {
      console.error('Failed to load lessons_data.json:', e);
    }

    try {
      const dictRes = await fetch('./data/dictionary.json');
      this.dictionary = await dictRes.json();
    } catch (e) {
      console.error('Failed to load dictionary.json:', e);
    }
  }

  /* --------------------------------------------------------------------------
     Theme & Sound
  -------------------------------------------------------------------------- */
  initTheme() {
    const state = storage.load();
    document.documentElement.setAttribute('data-theme', state.theme || 'dark');
    this.updateThemeIcon(state.theme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    storage.setTheme(next);
    this.updateThemeIcon(next);
  }

  updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }

  updateHeaderStats() {
    const state = storage.load();
    const xpEl = document.getElementById('header-xp-val');
    const streakEl = document.getElementById('header-streak-val');
    const totalDoneEl = document.getElementById('hero-completed-count');
    const heroXpEl = document.getElementById('hero-total-xp');

    if (xpEl) xpEl.textContent = `${state.xp || 0} XP`;
    if (streakEl) streakEl.textContent = `${state.streakDays || 1} дн.`;
    if (heroXpEl) heroXpEl.textContent = state.xp || 0;

    const completedCount = Object.keys(state.completedLessons || {}).length;
    if (totalDoneEl) totalDoneEl.textContent = `${completedCount} / 16`;
  }

  /* --------------------------------------------------------------------------
     Screen Navigation
  -------------------------------------------------------------------------- */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.activeScreen = screenId;

    // Update nav button states
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === screenId);
    });
  }

  /* --------------------------------------------------------------------------
     Event Listeners
  -------------------------------------------------------------------------- */
  initEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    // Navigation links
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target;
        if (target) this.showScreen(target);
      });
    });

    // Logo click -> go to dashboard
    document.querySelector('.logo-group')?.addEventListener('click', () => this.showScreen('screen-dashboard'));

    // Theory screen actions
    document.getElementById('theory-back-btn')?.addEventListener('click', () => this.showScreen('screen-dashboard'));
    document.getElementById('theory-start-quiz-btn')?.addEventListener('click', () => {
      if (this.currentLesson) this.startQuizForLesson(this.currentLesson);
    });

    // Quiz screen actions
    document.getElementById('quiz-exit-btn')?.addEventListener('click', () => {
      if (confirm('Ви дійсно хочете перервати тренування?')) {
        this.showScreen('screen-dashboard');
      }
    });

    document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
      this.quiz.nextQuestion();
    });

    // Result screen actions
    document.getElementById('res-back-dashboard-btn')?.addEventListener('click', () => {
      this.updateHeaderStats();
      this.renderDashboard();
      this.showScreen('screen-dashboard');
    });

    document.getElementById('res-retry-btn')?.addEventListener('click', () => {
      if (this.currentLesson) this.startQuizForLesson(this.currentLesson);
    });

    document.getElementById('res-review-mistakes-btn')?.addEventListener('click', () => {
      this.startMistakesReview();
    });

    // Verb matrix controls
    document.getElementById('matrix-verb-select')?.addEventListener('change', (e) => {
      this.currentVerb = e.target.value;
      this.updateVerbMatrix();
    });

    // Dictionary search
    document.getElementById('dict-search-input')?.addEventListener('input', (e) => {
      this.renderDictionary(e.target.value);
    });

    // Global pronunciation event delegation for elements with data-speak
    document.addEventListener('click', (e) => {
      const speakTarget = e.target.closest('[data-speak]');
      if (speakTarget) {
        e.stopPropagation();
        const text = speakTarget.getAttribute('data-speak');
        if (text) sound.speak(text);
      }
    });
  }

  /* --------------------------------------------------------------------------
     Dashboard Rendering
  -------------------------------------------------------------------------- */
  renderDashboard() {
    const grid = document.getElementById('lessons-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const state = storage.load();

    this.lessons.forEach(lesson => {
      const record = state.completedLessons[lesson.id];
      const isCompleted = !!record;
      const percent = record ? record.percent : 0;

      const card = document.createElement('div');
      card.className = `lesson-card ${isCompleted ? 'completed' : ''}`;
      card.innerHTML = `
        <div>
          <div class="card-top">
            <div class="lesson-number-badge">
              <div class="num-circle">${lesson.id}</div>
              <span class="badge-tag">${lesson.badge || 'Урок ' + lesson.id}</span>
            </div>
            <div class="lesson-icon">${lesson.icon || '📖'}</div>
          </div>
          <div class="card-body">
            <h3>${lesson.title}</h3>
            <p>${lesson.subtitle}</p>
          </div>
        </div>
        <div>
          ${isCompleted ? `
            <div style="font-size:0.8rem; color:var(--success); font-weight:700; margin-bottom:0.8rem;">
              Результат: ${record.score}/${record.total} (${percent}%)
            </div>
          ` : ''}
          <div class="card-footer">
            <button class="btn btn-secondary btn-theory" data-id="${lesson.id}">
              📖 Теорія
            </button>
            <button class="btn btn-primary btn-play" data-id="${lesson.id}">
              ⚡ Тренажер
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-theory').addEventListener('click', () => this.openLessonTheory(lesson));
      card.querySelector('.btn-play').addEventListener('click', () => this.startQuizForLesson(lesson));

      grid.appendChild(card);
    });
  }

  /* --------------------------------------------------------------------------
     Lesson Theory (Markdown Loader & Parser)
  -------------------------------------------------------------------------- */
  async openLessonTheory(lesson) {
    this.currentLesson = lesson;
    const bodyEl = document.getElementById('theory-content');
    if (!bodyEl) return;

    bodyEl.innerHTML = '<p style="text-align:center; padding:2rem;">Завантаження конспекту уроку...</p>';
    this.showScreen('screen-theory');

    try {
      const fileName = `lesson_${String(lesson.id).padStart(2, '0')}.md`;
      const res = await fetch(`./content/${fileName}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const md = await res.text();
      bodyEl.innerHTML = this.parseMarkdown(md);
    } catch (e) {
      console.error('Failed to load markdown:', e);
      bodyEl.innerHTML = `
        <h2>${lesson.title}</h2>
        <p>${lesson.subtitle}</p>
        <p style="color:var(--danger)">Не вдалося завантажити детальний файл конспекту. Перевірте доступність контенту.</p>
      `;
    }
  }

  /* --------------------------------------------------------------------------
     Lightweight Built-in Markdown to HTML Parser
  -------------------------------------------------------------------------- */
  parseMarkdown(md) {
    // Normalise newlines
    let text = md.replace(/\r\n/g, '\n');

    // Headers
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');

    // Blockquotes
    text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold and Italic
    text = text.replace(/\*\*\*(.*?)\*\*\*/gim, '<b><i>$1</i></b>');
    text = text.replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>');
    text = text.replace(/\*(.*?)\*/gim, '<i>$1</i>');

    // Inline code
    text = text.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Tables
    text = text.replace(/(?:\|.*\|\n?)+/g, (tableMatch) => {
      const rows = tableMatch.trim().split('\n');
      if (rows.length < 2) return tableMatch;

      let html = '<table>';
      rows.forEach((row, i) => {
        // Skip separator row (| :--- | :--- |)
        if (row.includes('---')) return;
        const cells = row.split('|').map(c => c.trim()).filter((c, idx, arr) => idx !== 0 && idx !== arr.length - 1);
        if (cells.length === 0) return;

        html += '<tr>';
        cells.forEach(cell => {
          const tag = (i === 0) ? 'th' : 'td';
          html += `<${tag}>${cell}</${tag}>`;
        });
        html += '</tr>';
      });
      html += '</table>';
      return html;
    });

    // Unordered lists
    text = text.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

    // Clean multiple <ul> tags
    text = text.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraphs
    const blocks = text.split(/\n{2,}/);
    const result = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<h') || block.startsWith('<table') || block.startsWith('<ul') || block.startsWith('<blockquote') || block.startsWith('<hr')) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return result;
  }

  /* --------------------------------------------------------------------------
     Interactive Quiz Logic
  -------------------------------------------------------------------------- */
  startQuizForLesson(lesson) {
    this.currentLesson = lesson;
    this.showScreen('screen-quiz');
    this.quiz.startLesson(lesson, false);
  }

  startMistakesReview() {
    const state = storage.load();
    const mistakes = state.mistakes || [];
    if (mistakes.length === 0) {
      alert('У вас немає активних помилок для повторення! Чудова робота!');
      return;
    }
    this.currentLesson = { id: 0, title: 'Робота над помилками', subtitle: 'Повторення складних запитань' };
    this.showScreen('screen-quiz');
    this.quiz.startLesson({ id: 0, title: 'Робота над помилками', questions: mistakes }, true);
  }

  renderQuizProgress(data) {
    const { question, currentIndex, total, lesson, isReviewMode } = data;

    document.getElementById('quiz-lesson-badge').textContent = isReviewMode ? 'Повторення' : `Урок ${lesson.id}`;
    document.getElementById('quiz-counter-text').textContent = `Питання ${currentIndex + 1} з ${total}`;

    const percent = Math.round(((currentIndex) / total) * 100);
    document.getElementById('quiz-progress-fill').style.width = `${percent}%`;

    // Question category badge
    const catBadge = document.getElementById('quiz-cat-badge');
    if (catBadge) catBadge.textContent = question.type || 'Питання';

    // Question text
    document.getElementById('quiz-question-text').textContent = question.question;

    // Pronunciation button
    const audioBtn = document.getElementById('quiz-audio-btn');
    if (audioBtn) {
      const speechPhrase = question.speechText || question.options[question.answer];
      audioBtn.setAttribute('data-speak', speechPhrase);
      audioBtn.style.display = speechPhrase ? 'flex' : 'none';
    }

    // Hide feedback & next button
    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.className = 'quiz-feedback';
    feedbackEl.innerHTML = '';
    document.getElementById('quiz-next-btn').style.display = 'none';

    // Render options
    const optionsContainer = document.getElementById('quiz-options-list');
    optionsContainer.innerHTML = '';

    question.options.forEach((optText, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span>${optText}</span><span class="opt-status-icon"></span>`;
      btn.addEventListener('click', () => this.handleOptionSelect(index, btn));
      optionsContainer.appendChild(btn);
    });
  }

  handleOptionSelect(selectedIndex, buttonEl) {
    const result = this.quiz.submitAnswer(selectedIndex);
    if (!result) return;

    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === result.correctIndex) {
        btn.classList.add('correct');
        btn.querySelector('.opt-status-icon').textContent = '✓';
      } else if (idx === result.selectedIndex && !result.isCorrect) {
        btn.classList.add('incorrect');
        btn.querySelector('.opt-status-icon').textContent = '✗';
      }
    });

    // Show feedback card
    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.className = `quiz-feedback show ${result.isCorrect ? 'correct-feedback' : 'wrong-feedback'}`;
    feedbackEl.innerHTML = `
      <div class="feedback-title">
        ${result.isCorrect ? '🎉 Правильно!' : '💡 Пояснення правила:'}
      </div>
      <div class="feedback-text">${result.explanation || result.hint}</div>
    `;

    // Speak the English phrase automatically on answer for reinforcement!
    if (result.speechText) {
      setTimeout(() => sound.speak(result.speechText), 200);
    }

    // Show Next button
    document.getElementById('quiz-next-btn').style.display = 'inline-flex';
  }

  renderQuizResults(result) {
    this.showScreen('screen-result');

    const badgeIcon = result.percent >= 80 ? '🏆' : result.percent >= 50 ? '🌟' : '📚';
    document.getElementById('result-badge-anim').textContent = badgeIcon;

    const titleEl = document.getElementById('result-title');
    if (result.percent === 100) {
      titleEl.textContent = 'Ідеальний результат!';
    } else if (result.percent >= 80) {
      titleEl.textContent = 'Чудова робота!';
    } else if (result.percent >= 50) {
      titleEl.textContent = 'Добре! Ще трохи практики!';
    } else {
      titleEl.textContent = 'Не здавайтеся!';
    }

    document.getElementById('result-score-circle').textContent = `${result.percent}%`;
    document.getElementById('result-correct-count').textContent = `${result.score} з ${result.total}`;
    document.getElementById('result-xp-earned').textContent = `+${result.bonusXp || result.score * 10} XP`;

    // Show or hide review mistakes button
    const reviewBtn = document.getElementById('res-review-mistakes-btn');
    const state = storage.load();
    const hasMistakes = (state.mistakes && state.mistakes.length > 0);
    if (reviewBtn) {
      reviewBtn.style.display = hasMistakes ? 'inline-flex' : 'none';
      if (hasMistakes) {
        reviewBtn.textContent = `⚡ Робота над помилками (${state.mistakes.length})`;
      }
    }

    this.updateHeaderStats();
  }

  /* --------------------------------------------------------------------------
     Verb Matrix Interactive Tool
  -------------------------------------------------------------------------- */
  initVerbMatrix() {
    const select = document.getElementById('matrix-verb-select');
    if (select) {
      select.innerHTML = '';
      verbMatrixData.verbs.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.inf} (${v.ua})`;
        select.appendChild(opt);
      });
      select.value = this.currentVerb;
    }

    const pronounWrap = document.getElementById('matrix-pronouns-wrap');
    if (pronounWrap) {
      pronounWrap.innerHTML = '';
      verbMatrixData.pronouns.forEach(p => {
        const btn = document.createElement('button');
        btn.className = `pronoun-btn ${p.id === this.currentPronoun ? 'active' : ''}`;
        btn.textContent = p.label;
        btn.addEventListener('click', () => {
          this.currentPronoun = p.id;
          pronounWrap.querySelectorAll('.pronoun-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.updateVerbMatrix();
        });
        pronounWrap.appendChild(btn);
      });
    }

    this.updateVerbMatrix();
  }

  updateVerbMatrix() {
    const data = verbMatrixData.generateMatrix(this.currentVerb, this.currentPronoun);
    const container = document.getElementById('matrix-grid-container');
    if (!container) return;

    const c = data.cells;

    container.innerHTML = `
      <div class="matrix-grid">
        <!-- Headers -->
        <div class="matrix-header-cell">Час / Форма</div>
        <div class="matrix-header-cell">Питання (?)</div>
        <div class="matrix-header-cell">Ствердження (+)</div>
        <div class="matrix-header-cell">Заперечення (-)</div>

        <!-- Row 1: Future -->
        <div class="matrix-row-title">Майбутній (Future)</div>
        <div class="matrix-cell" data-speak="${c.futureQ.en}">
          <div class="matrix-cell-en">${c.futureQ.en}</div>
          <div class="matrix-cell-ua">${c.futureQ.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
        <div class="matrix-cell" data-speak="${c.futureAff.en}">
          <div class="matrix-cell-en">${c.futureAff.en}</div>
          <div class="matrix-cell-ua">${c.futureAff.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
        <div class="matrix-cell" data-speak="${c.futureNeg.en}">
          <div class="matrix-cell-en">${c.futureNeg.en}</div>
          <div class="matrix-cell-ua">${c.futureNeg.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>

        <!-- Row 2: Present -->
        <div class="matrix-row-title">Теперішній (Present)</div>
        <div class="matrix-cell" data-speak="${c.presentQ.en}">
          <div class="matrix-cell-en">${c.presentQ.en}</div>
          <div class="matrix-cell-ua">${c.presentQ.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
        <div class="matrix-cell" data-speak="${c.presentAff.en}">
          <div class="matrix-cell-en">${c.presentAff.en}</div>
          <div class="matrix-cell-ua">${c.presentAff.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
        <div class="matrix-cell" data-speak="${c.presentNeg.en}">
          <div class="matrix-cell-en">${c.presentNeg.en}</div>
          <div class="matrix-cell-ua">${c.presentNeg.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>

        <!-- Row 3: Past -->
        <div class="matrix-row-title">Минулий (Past)</div>
        <div class="matrix-cell" data-speak="${c.pastQ.en}">
          <div class="matrix-cell-en">${c.pastQ.en}</div>
          <div class="matrix-cell-ua">${c.pastQ.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
        <div class="matrix-cell" data-speak="${c.pastAff.en}">
          <div class="matrix-cell-en">${c.pastAff.en}</div>
          <div class="matrix-cell-ua">${c.pastAff.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
        <div class="matrix-cell" data-speak="${c.pastNeg.en}">
          <div class="matrix-cell-en">${c.pastNeg.en}</div>
          <div class="matrix-cell-ua">${c.pastNeg.ua}</div>
          <span class="matrix-cell-speak">🔊</span>
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Dictionary & Flashcards
  -------------------------------------------------------------------------- */
  renderDictionary(filterQuery = '') {
    const grid = document.getElementById('dictionary-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const query = filterQuery.toLowerCase().trim();
    const filtered = this.dictionary.filter(w => {
      if (!query) return true;
      return w.word.toLowerCase().includes(query) || w.translation.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding:2rem;">Слів не знайдено</p>';
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'word-card';
      card.innerHTML = `
        <div class="word-card-top">
          <div>
            <div class="word-en">${item.word}</div>
            <div class="word-transcription">${item.transcription || ''}</div>
          </div>
          <button class="icon-btn" data-speak="${item.word}" title="Прослухати">🔊</button>
        </div>
        <div class="word-ua">${item.translation}</div>
        ${item.example ? `<div class="word-example">${item.example}</div>` : ''}
      `;
      grid.appendChild(card);
    });
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
