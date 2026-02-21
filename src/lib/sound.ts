// Sound manager for the crafting companion
class SoundManager {
  private audioContext: AudioContext | null = null;
  private backgroundMusic: HTMLAudioElement | null = null;
  private sounds: { [key: string]: () => void } = {};

  constructor() {
    // Initialize audio context for Web Audio API
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

    // Background music (placeholder - user should replace with actual file)
    this.backgroundMusic = new Audio('/sounds/background.mp3');
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.3;

    // Generate procedural sounds
    this.sounds.craft = () => this.playTone(800, 0.2, 'sawtooth');
    this.sounds.collect = () => this.playTone(600, 0.3, 'sine');
    this.sounds.button = () => this.playTone(400, 0.1, 'square');

    // Preload background music
    this.backgroundMusic.preload = 'auto';
  }

  // Play a procedural tone
  private playTone(frequency: number, duration: number, waveType: OscillatorType = 'sine') {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = waveType;

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Play background music
  playBackgroundMusic() {
    if (this.backgroundMusic && this.audioContext) {
      // Resume audio context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
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
  playSound(soundName: 'craft' | 'collect' | 'button') {
    if (this.sounds[soundName]) {
      this.sounds[soundName]();
    }
  }
}

export const soundManager = new SoundManager();