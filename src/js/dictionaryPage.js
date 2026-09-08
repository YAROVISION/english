/**
 * Dictionary & Word Game UI Controller
 * Integrates 5,600+ bilingual words from base/file.pdf and WordGame engine
 */

import { WordGame } from './wordGame.js';
import { sound } from './speech.js';

export class DictionaryPageController {
  constructor() {
    this.dictionary = [];
    this.searchQuery = '';
    this.direction = 'en_to_ua'; // 'en_to_ua' | 'ua_to_en'
    this.currentLetter = 'ALL';
    this.currentPage = 1;
    this.pageSize = 36;
    this.filteredEntries = [];
    
    this.wordGame = null;
    this.activeSubTab = 'dict'; // 'dict' | 'game'
  }

  async init() {
    await this.loadDatabase();
    this.wordGame = new WordGame(this.dictionary, {
      onProgress: (data) => this.renderGameRound(data),
      onFinish: (result) => this.renderGameResults(result)
    });

    this.initEventListeners();
    this.renderAlphabetRibbon();
    this.applyFilters();
  }

  async loadDatabase() {
    try {
      const res = await fetch('./data/dictionary_db.json');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      this.dictionary = await res.json();
      console.log(`Loaded ${this.dictionary.length} dictionary entries.`);
    } catch (e) {
      console.error('Failed to load dictionary_db.json:', e);
      this.dictionary = [];
    }
  }

  initEventListeners() {
    // Sub-tab toggles: Dictionary vs Word Game
    document.querySelectorAll('.dict-subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subtab = e.currentTarget.dataset.subtab;
        this.switchSubTab(subtab);
      });
    });

    // Direction switcher buttons
    document.querySelectorAll('.dict-dir-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.direction = e.currentTarget.dataset.dir;
        document.querySelectorAll('.dict-dir-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Update search placeholder
        const input = document.getElementById('big-dict-search-input');
        if (input) {
          input.placeholder = this.direction === 'en_to_ua' 
            ? '🔍 Пошук за англійським словом (наприклад: friend, life, open)...'
            : '🔍 Пошук за українським перекладом (наприклад: друг, життя, відкривати)...';
        }

        this.currentLetter = 'ALL';
        this.currentPage = 1;
        this.renderAlphabetRibbon();
        this.applyFilters();
      });
    });

    // Live search input with debounce
    let debounceTimer = null;
    const searchInput = document.getElementById('big-dict-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          this.currentPage = 1;
          this.applyFilters();
        }, 200);
      });
    }

    // Pagination buttons
    document.getElementById('dict-prev-page-btn')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderCards();
        window.scrollTo({ top: 400, behavior: 'smooth' });
      }
    });

    document.getElementById('dict-next-page-btn')?.addEventListener('click', () => {
      const totalPages = Math.ceil(this.filteredEntries.length / this.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderCards();
        window.scrollTo({ top: 400, behavior: 'smooth' });
      }
    });

    // Game controls
    document.getElementById('start-word-game-btn')?.addEventListener('click', () => {
      const modeSelect = document.getElementById('game-mode-select');
      const countSelect = document.getElementById('game-count-select');
      const mode = modeSelect ? modeSelect.value : 'en_to_ua';
      const count = countSelect ? parseInt(countSelect.value, 10) : 10;
      this.startNewGame(mode, count);
    });

    document.getElementById('game-next-round-btn')?.addEventListener('click', () => {
      this.wordGame.nextRound();
    });

    document.getElementById('game-retry-btn')?.addEventListener('click', () => {
      const modeSelect = document.getElementById('game-mode-select');
      const mode = modeSelect ? modeSelect.value : 'en_to_ua';
      this.startNewGame(mode, 10);
    });

    document.getElementById('game-review-mistakes-btn')?.addEventListener('click', () => {
      if (this.wordGame && this.wordGame.mistakes.length > 0) {
        this.wordGame.startGame(this.wordGame.mode, this.wordGame.mistakes.length, this.wordGame.mistakes);
        document.getElementById('game-results-panel').style.display = 'none';
        document.getElementById('game-arena-panel').style.display = 'block';
      }
    });
  }

  switchSubTab(subtab) {
    this.activeSubTab = subtab;
    document.querySelectorAll('.dict-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subtab);
    });

    const dictView = document.getElementById('subtab-content-dict');
    const gameView = document.getElementById('subtab-content-game');

    if (dictView) dictView.style.display = subtab === 'dict' ? 'block' : 'none';
    if (gameView) gameView.style.display = subtab === 'game' ? 'block' : 'none';
  }

  renderAlphabetRibbon() {
    const container = document.getElementById('dict-alphabet-ribbon');
    if (!container) return;
    container.innerHTML = '';

    const letters = this.direction === 'en_to_ua'
      ? ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
      : ['ALL', ...'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ'.split('')];

    letters.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = `letter-chip ${this.currentLetter === letter ? 'active' : ''}`;
      btn.textContent = letter === 'ALL' ? 'Всі' : letter;
      btn.addEventListener('click', () => {
        this.currentLetter = letter;
        container.querySelectorAll('.letter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPage = 1;
        this.applyFilters();
      });
      container.appendChild(btn);
    });
  }

  applyFilters() {
    let list = this.dictionary;

    // Search text filter
    if (this.searchQuery) {
      if (this.direction === 'en_to_ua') {
        list = list.filter(item => 
          item.en.toLowerCase().includes(this.searchQuery) ||
          item.ua.toLowerCase().includes(this.searchQuery)
        );
      } else {
        list = list.filter(item => 
          item.ua.toLowerCase().includes(this.searchQuery) ||
          item.en.toLowerCase().includes(this.searchQuery)
        );
      }
    }

    // Alphabet letter filter
    if (this.currentLetter && this.currentLetter !== 'ALL') {
      const targetL = this.currentLetter.toLowerCase();
      if (this.direction === 'en_to_ua') {
        list = list.filter(item => item.en.toLowerCase().startsWith(targetL));
      } else {
        list = list.filter(item => item.ua.trim().toLowerCase().startsWith(targetL));
      }
    }

    this.filteredEntries = list;
    this.renderCards();
  }

  renderCards() {
    const grid = document.getElementById('big-dictionary-grid');
    const countEl = document.getElementById('dict-results-count');
    const paginationWrap = document.getElementById('dict-pagination-controls');
    const pageNumEl = document.getElementById('dict-page-number');

    if (!grid) return;
    grid.innerHTML = '';

    const total = this.filteredEntries.length;
    if (countEl) countEl.textContent = `Знайдено слів: ${total.toLocaleString()}`;

    if (total === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:0.5rem;">🔍</div>
          <h3>Нічого не знайдено</h3>
          <p>Спробуйте змінити запит або перемкнути мовний напрямок.</p>
        </div>
      `;
      if (paginationWrap) paginationWrap.style.display = 'none';
      return;
    }

    const totalPages = Math.ceil(total / this.pageSize);
    if (this.currentPage > totalPages) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredEntries.slice(start, start + this.pageSize);

    pageItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'dict-entry-card';

      // Primary word according to direction
      const headword = this.direction === 'en_to_ua' ? item.en : item.ua.split(';')[0];
      const translation = this.direction === 'en_to_ua' ? item.ua : item.en;

      card.innerHTML = `
        <div class="dict-card-header">
          <div>
            <span class="dict-headword">${headword}</span>
            ${item.transcription ? `<span class="dict-transcription">${item.transcription}</span>` : ''}
          </div>
          <button class="icon-btn dict-audio-btn" data-speak="${item.en}" title="Вимова англійською">
            🔊
          </button>
        </div>
        <div class="dict-translation">${translation}</div>
        <div class="dict-card-footer">
          <button class="btn-train-word" title="Грати з цим словом">
            🎯 Тренувати це слово
          </button>
        </div>
      `;

      card.querySelector('.btn-train-word').addEventListener('click', () => {
        this.switchSubTab('game');
        this.startNewGame('en_to_ua', 5, [item]);
      });

      grid.appendChild(card);
    });

    if (paginationWrap && totalPages > 1) {
      paginationWrap.style.display = 'flex';
      if (pageNumEl) pageNumEl.textContent = `Сторінка ${this.currentPage} з ${totalPages}`;
      document.getElementById('dict-prev-page-btn').disabled = (this.currentPage === 1);
      document.getElementById('dict-next-page-btn').disabled = (this.currentPage === totalPages);
    } else if (paginationWrap) {
      paginationWrap.style.display = 'none';
    }
  }

  /* --------------------------------------------------------------------------
     Word Guess Game Interface
  -------------------------------------------------------------------------- */
  startNewGame(mode = 'en_to_ua', rounds = 10, specificWords = null) {
    document.getElementById('game-setup-panel').style.display = 'none';
    document.getElementById('game-results-panel').style.display = 'none';
    document.getElementById('game-arena-panel').style.display = 'block';

    this.wordGame.startGame(mode, rounds, specificWords);
  }

  renderGameRound(data) {
    const { round, total, score, combo, question } = data;

    document.getElementById('wg-round-badge').textContent = `Слово ${round} з ${total}`;
    document.getElementById('wg-score-text').textContent = `Бали: ${score}`;
    document.getElementById('wg-combo-text').textContent = combo > 1 ? `🔥 Combo x${combo}` : '';

    const percent = Math.round(((round - 1) / total) * 100);
    document.getElementById('wg-progress-fill').style.width = `${percent}%`;

    // Direction title
    const dirTitle = document.getElementById('wg-direction-title');
    if (dirTitle) {
      dirTitle.textContent = question.direction === 'en_to_ua' 
        ? '🇬🇧 Відгадайте український переклад:' 
        : '🇺🇦 Відгадайте англійське слово:';
    }

    // Prompt word
    document.getElementById('wg-prompt-word').textContent = question.prompt;
    
    // Hint / Transcription
    const hintEl = document.getElementById('wg-hint-text');
    if (hintEl) {
      hintEl.textContent = question.hint || '';
    }

    // Audio button for English word
    const audioBtn = document.getElementById('wg-audio-btn');
    if (audioBtn) {
      audioBtn.setAttribute('data-speak', question.speechPrompt);
      audioBtn.style.display = question.speechPrompt ? 'inline-flex' : 'none';
    }

    // Hide feedback & next button
    const feedbackEl = document.getElementById('wg-feedback');
    feedbackEl.className = 'game-feedback';
    feedbackEl.innerHTML = '';
    document.getElementById('game-next-round-btn').style.display = 'none';

    // Render options
    const optionsWrap = document.getElementById('wg-options-grid');
    optionsWrap.innerHTML = '';

    question.options.forEach((optText, index) => {
      const btn = document.createElement('button');
      btn.className = 'game-opt-btn';
      btn.innerHTML = `
        <span class="game-opt-text">${optText}</span>
        <span class="game-opt-icon"></span>
      `;
      btn.addEventListener('click', () => this.handleGameChoice(index, btn));
      optionsWrap.appendChild(btn);
    });
  }

  handleGameChoice(selectedIndex, buttonEl) {
    const result = this.wordGame.submitChoice(selectedIndex);
    if (!result) return;

    const allButtons = document.querySelectorAll('.game-opt-btn');
    allButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === result.correctIndex) {
        btn.classList.add('correct');
        btn.querySelector('.game-opt-icon').textContent = '✓';
      } else if (idx === result.selectedIndex && !result.isCorrect) {
        btn.classList.add('incorrect');
        btn.querySelector('.game-opt-icon').textContent = '✗';
      }
    });

    // Show feedback card
    const feedbackEl = document.getElementById('wg-feedback');
    feedbackEl.className = `game-feedback show ${result.isCorrect ? 'correct-feedback' : 'wrong-feedback'}`;
    feedbackEl.innerHTML = `
      <div class="feedback-title">
        ${result.isCorrect ? '🎉 Чудово, правильна відповідь!' : '💡 Правильне значення:'}
      </div>
      <div class="feedback-text">
        <strong>${result.targetWord.en}</strong> ${result.targetWord.transcription || ''} — ${result.targetWord.ua}
      </div>
    `;

    // Next round button
    document.getElementById('game-next-round-btn').style.display = 'inline-flex';
  }

  renderGameResults(result) {
    document.getElementById('game-arena-panel').style.display = 'none';
    const resPanel = document.getElementById('game-results-panel');
    resPanel.style.display = 'block';

    const iconEl = document.getElementById('wg-result-icon');
    iconEl.textContent = result.percent >= 80 ? '🏆' : result.percent >= 50 ? '🌟' : '🎯';

    document.getElementById('wg-result-percent').textContent = `${result.percent}%`;
    document.getElementById('wg-result-correct').textContent = `${result.score} з ${result.total}`;
    document.getElementById('wg-result-combo').textContent = result.maxCombo > 1 ? `x${result.maxCombo}` : '0';
    document.getElementById('wg-result-xp').textContent = `+${result.bonusXp} XP`;

    const reviewBtn = document.getElementById('game-review-mistakes-btn');
    if (reviewBtn) {
      reviewBtn.style.display = result.mistakes.length > 0 ? 'inline-flex' : 'none';
      if (result.mistakes.length > 0) {
        reviewBtn.textContent = `⚡ Повторити помилки (${result.mistakes.length})`;
      }
    }
  }
}
