/**
 * Speech & Sound Synthesizer
 * Uses Web Speech API for English text-to-speech pronunciation
 * and Web Audio API for interactive sound effects.
 */

export const sound = {
  audioCtx: null,

  initAudio() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },

  playSuccess() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      
      const now = this.audioCtx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio effect error:', e);
    }
  },

  playError() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      
      const now = this.audioCtx.currentTime;
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(220, now + 0.12);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio effect error:', e);
    }
  },

  speak(text, lang = 'en-US') {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported on this browser');
      return;
    }
    window.speechSynthesis.cancel(); // cancel previous speech
    
    // Clean text from bracketed hints or slashes
    const cleanText = text.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for clear learning pronunciation

    // Find good English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => (v.lang === 'en-US' || v.lang === 'en-GB') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Daniel') || v.name.includes('Samantha')));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  }
};
