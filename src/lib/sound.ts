// Sound manager for the crafting companion
class SoundManager {
  private audioContext: AudioContext | null = null;
  private backgroundMusic: HTMLAudioElement | null = null;
  private sounds: { [key: string]: () => void } = {};
  private audioFiles: { [key: string]: HTMLAudioElement } = {};

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  // Initialize sounds
  init() {
    if (!this.audioContext) return;

    // Background music
    this.backgroundMusic = new Audio('/sounds/background.mp3');
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.8;
    this.backgroundMusic.preload = 'auto';

    // File-based sound effects
    this.audioFiles.collect = new Audio('/sounds/collect.mp3');
    this.audioFiles.collect.volume = 1.0;
    this.audioFiles.collect.preload = 'auto';

    this.audioFiles.craft = new Audio('/sounds/craft.mp3');
    this.audioFiles.craft.volume = 1.0;
    this.audioFiles.craft.preload = 'auto';

    this.audioFiles.button = new Audio('/sounds/button.mp3');
    this.audioFiles.button.volume = 0.8;
    this.audioFiles.button.preload = 'auto';

    // ── Minecraft-themed procedural sounds ──────────────────────────────

    // START BUTTON: hollow oak plank 'thud' + magical shimmer
    this.sounds.craft = () => {
      const ctx = this.audioContext!;
      const now = ctx.currentTime;

      // Low thud body (hollow wood knock)
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      const thudFilter = ctx.createBiquadFilter();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(180, now);
      thudOsc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      thudFilter.type = 'bandpass';
      thudFilter.frequency.value = 300;
      thudFilter.Q.value = 1.5;
      thudOsc.connect(thudFilter);
      thudFilter.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudGain.gain.setValueAtTime(0.9, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      thudOsc.start(now);
      thudOsc.stop(now + 0.5);

      // Magical shimmer overlay (high sparkle)
      [1200, 1800, 2400].forEach((freq, i) => {
        const shimOsc = ctx.createOscillator();
        const shimGain = ctx.createGain();
        shimOsc.type = 'sine';
        shimOsc.frequency.value = freq;
        shimOsc.connect(shimGain);
        shimGain.connect(ctx.destination);
        const startAt = now + i * 0.06;
        shimGain.gain.setValueAtTime(0, startAt);
        shimGain.gain.linearRampToValueAtTime(0.25, startAt + 0.03);
        shimGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.3);
        shimOsc.start(startAt);
        shimOsc.stop(startAt + 0.3);
      });
    };

    // SELECT PING: high-pitched resonant experience orb ping
    this.sounds.collect = () => {
      console.log('[Sound] Playing Experience Orb ping');
      const ctx = this.audioContext!;
      const now = ctx.currentTime;

      // Primary crystal ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);

      // Harmonic shimmer
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2800, now);
      osc2.frequency.exponentialRampToValueAtTime(3200, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.2);

      gain.connect(ctx.destination);
      gain2.connect(ctx.destination);
      osc.connect(gain);
      osc2.connect(gain2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.start(now);
      osc.stop(now + 0.3);
      osc2.start(now);
      osc2.stop(now + 0.3);
    };

    // BACK/CANCEL: crunchy low stone-on-stone slide
    this.sounds.button = () => {
      const ctx = this.audioContext!;
      const now = ctx.currentTime;

      // Low rumble body
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleOsc.type = 'sawtooth';
      rumbleOsc.frequency.setValueAtTime(80, now);
      rumbleOsc.frequency.linearRampToValueAtTime(55, now + 0.2);
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 220;
      rumbleFilter.Q.value = 3;
      rumbleOsc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(ctx.destination);
      rumbleGain.gain.setValueAtTime(0.85, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      rumbleOsc.start(now);
      rumbleOsc.stop(now + 0.22);

      // Grit noise burst (crunch texture)
      const bufferSize = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noise.buffer = buffer;
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 400;
      noiseFilter.Q.value = 0.8;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      noise.start(now);
    };

    // HOVER: very soft organic grass rustle
    this.sounds.hover = () => {
      const ctx = this.audioContext!;
      const now = ctx.currentTime;

      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI); // bell envelope
        data[i] = (Math.random() * 2 - 1) * env * 0.6;
      }
      const noise = ctx.createBufferSource();
      const gain = ctx.createGain();
      const hipass = ctx.createBiquadFilter();
      const lopass = ctx.createBiquadFilter();

      noise.buffer = buffer;
      // Shape into organic rustling band (3–7kHz)
      hipass.type = 'highpass';
      hipass.frequency.value = 3000;
      lopass.type = 'lowpass';
      lopass.frequency.value = 7000;

      noise.connect(hipass);
      hipass.connect(lopass);
      lopass.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.start(now);
    };

    // BACK: smooth whoosh + electronic fade-out
    this.sounds.back = () => {
      const ctx = this.audioContext!;
      const now = ctx.currentTime;

      // Whoosh (noise sweep)
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4000, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
      filter.Q.value = 1.0;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.8, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      noise.start(now);

      // Electronic fade-out (sine ping)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      oscGain.gain.setValueAtTime(0, now + 0.1);
      oscGain.gain.linearRampToValueAtTime(0.2, now + 0.15);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now + 0.1);
      osc.stop(now + 0.4);
    };

    // LOGOUT: crisp click + rising electronic ping
    this.sounds.logout = () => {
      const ctx = this.audioContext!;
      const now = ctx.currentTime;

      // Click (noise burst)
      const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate);
      const clickData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickData.length; i++) clickData[i] = Math.random() * 2 - 1;
      const clickSource = ctx.createBufferSource();
      const clickGain = ctx.createGain();
      const clickFilter = ctx.createBiquadFilter();
      clickSource.buffer = clickBuf;
      clickFilter.type = 'highpass';
      clickFilter.frequency.value = 2000;
      clickSource.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickGain.gain.setValueAtTime(1.0, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
      clickSource.start(now);

      // Rising ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);

      // Reverb/Echo decay
      [0.05, 0.1, 0.15].forEach(delay => {
        const echoOsc = ctx.createOscillator();
        const echoGain = ctx.createGain();
        echoOsc.type = 'sine';
        echoOsc.frequency.setValueAtTime(600 * (1 + delay * 2), now + delay);
        echoOsc.frequency.exponentialRampToValueAtTime(1200, now + delay + 0.1);
        echoOsc.connect(echoGain);
        echoGain.connect(ctx.destination);
        echoGain.gain.setValueAtTime(0.3 / (delay * 10), now + delay);
        echoGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
        echoOsc.start(now + delay);
        echoOsc.stop(now + delay + 0.2);
      });
    };
  }

  // Resume audio context
  private async ensureContextRunning() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Play background music
  playBackgroundMusic() {
    if (this.backgroundMusic && this.audioContext) {
      this.ensureContextRunning();
      this.backgroundMusic.play().catch(e => console.warn('Background music play failed:', e));
    }
  }

  // Stop background music
  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
    }
  }

  // Play a sound effect
  playSound(soundName: 'craft' | 'collect' | 'button' | 'hover' | 'back' | 'logout') {
    if (!this.audioContext) return;
    this.ensureContextRunning().then(() => {
      if (this.sounds[soundName]) {
        this.sounds[soundName]();
      }
    });
  }

  // Play a specific file sound
  playFileSound(fileName: 'collect' | 'craft' | 'button') {
    if (!this.audioContext) return;
    this.ensureContextRunning().then(() => {
      const audio = this.audioFiles[fileName];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn(`File sound ${fileName} play failed:`, e));
      }
    });
  }
}

export const soundManager = new SoundManager();
