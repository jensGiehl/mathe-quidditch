const CHEERS = Array.from({ length: 5 }, (_, index) => `cheer-${index + 1}`);

export class FlightAudio {
  constructor({ effects = true, music = false } = {}) {
    this.effectsEnabled = effects;
    this.musicEnabled = music;
    this.paused = document.hidden;
    this.context = null;
    this.buffers = new Map();
    this.loading = new Map();
    this.sources = new Set();
    this.musicSource = null;
    this.musicGain = null;
    this.generation = 0;
    this.pendingRewards = [];
    this.pendingWrongAnswer = false;
    this.cheerBag = [];
    this.lastCheer = null;
  }

  async unlock() {
    try {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
      }
      if (!this.paused && this.context.state === 'suspended') await this.context.resume();
      if (this.paused && this.context.state === 'running') await this.context.suspend();
      if (this.musicEnabled) await this.startMusic();
      for (const file of [...CHEERS, 'crowd-ohh', 'spell']) this.load(file).catch(() => {});
    } catch {}
  }

  async load(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    if (this.loading.has(name)) return this.loading.get(name);
    if (!this.context) return null;
    const promise = fetch(`/assets/audio/${name}.wav`)
      .then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      })
      .then(data => this.context.decodeAudioData(data))
      .then(buffer => {
        this.buffers.set(name, buffer);
        this.loading.delete(name);
        return buffer;
      })
      .catch(error => {
        this.loading.delete(name);
        throw error;
      });
    this.loading.set(name, promise);
    return promise;
  }

  async play(name, volume = 0.65) {
    if (!this.effectsEnabled || this.paused || document.hidden || !this.context) return;
    const generation = this.generation;
    try {
      const buffer = await this.load(name);
      if (!buffer || generation !== this.generation || !this.effectsEnabled) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain).connect(this.context.destination);
      source.onended = () => {
        this.sources.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      this.sources.add(source);
      source.start();
    } catch {}
  }

  reward(reward) {
    if (!this.effectsEnabled) return;
    if (this.paused || document.hidden) {
      this.pendingRewards.push(reward);
      return;
    }
    this.play(this.nextCheer(), 0.58);
    if (reward.milestone) this.play('spell', 0.48);
  }

  nextCheer() {
    if (!this.cheerBag.length) {
      this.cheerBag = [...CHEERS];
      for (let index = this.cheerBag.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [this.cheerBag[index], this.cheerBag[other]] = [this.cheerBag[other], this.cheerBag[index]];
      }
      const last = this.cheerBag.length - 1;
      if (this.cheerBag[last] === this.lastCheer) {
        const other = Math.floor(Math.random() * last);
        [this.cheerBag[last], this.cheerBag[other]] = [this.cheerBag[other], this.cheerBag[last]];
      }
    }
    this.lastCheer = this.cheerBag.pop();
    return this.lastCheer;
  }

  wrongAnswer() {
    if (!this.effectsEnabled) return;
    if (this.paused || document.hidden) {
      this.pendingWrongAnswer = true;
      return;
    }
    this.play('crowd-ohh', 0.64);
  }

  boost() {
    if (!this.effectsEnabled || this.paused || !this.context || document.hidden) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain).connect(this.context.destination);
    this.sources.add(oscillator);
    oscillator.onended = () => {
      this.sources.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  async startMusic() {
    if (!this.context || !this.musicEnabled || this.musicSource) return;
    try {
      const buffer = await this.load('music');
      if (!buffer || !this.musicEnabled || this.musicSource) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0.19;
      source.connect(gain).connect(this.context.destination);
      source.start();
      this.musicGain = gain;
      this.musicSource = source;
    } catch {}
  }

  setEffects(enabled) {
    this.effectsEnabled = enabled;
    if (!enabled) this.stopEffects();
  }

  setMusic(enabled) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.unlock();
    } else if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource.disconnect();
      this.musicGain.disconnect();
      this.musicSource = null;
      this.musicGain = null;
    }
  }

  async setPaused(paused) {
    this.paused = paused;
    if (!this.context) return;
    try {
      if (paused && this.context.state === 'running') await this.context.suspend();
      if (!paused && this.context.state === 'suspended') await this.context.resume();
      if (!this.paused && !document.hidden) {
        const rewards = this.pendingRewards.splice(0);
        rewards.forEach(reward => this.reward(reward));
        if (this.pendingWrongAnswer) {
          this.pendingWrongAnswer = false;
          this.wrongAnswer();
        }
      }
    } catch {}
  }

  stopEffects() {
    this.generation += 1;
    this.pendingRewards = [];
    this.pendingWrongAnswer = false;
    for (const source of this.sources) {
      try { source.stop(); } catch {}
    }
    this.sources.clear();
  }
}
