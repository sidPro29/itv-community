// Web Audio API Ringtone & Ringback Tone Synthesizer
// Zero external files, works across Chrome, Safari, Android, iOS

class ToneGenerator {
  constructor() {
    this.audioCtx = null;
    this.interval = null;
    this.isPlaying = false;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Incoming call ringtone (dual tone chime cadence)
  playRingtone() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.initContext();

    const ring = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      try {
        const now = this.audioCtx.currentTime;

        // Dual frequency ring chime (A4 440Hz + B4 480Hz)
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.setValueAtTime(0.2, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.4);
        osc2.stop(now + 1.4);
      } catch (e) {
        console.warn('Ringtone play error:', e);
      }
    };

    ring();
    this.interval = setInterval(ring, 2800);
  }

  // Outgoing call ringback tone (gentle soft beep cadence)
  playRingback() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.initContext();

    const beep = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 425; // standard European/US ringback

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.0);
        gain.gain.linearRampToValueAtTime(0, now + 1.15);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 1.15);
      } catch (e) {
        console.warn('Ringback play error:', e);
      }
    };

    beep();
    this.interval = setInterval(beep, 3000);
  }

  stop() {
    this.isPlaying = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const ringtone = new ToneGenerator();
export const ringback = new ToneGenerator();
