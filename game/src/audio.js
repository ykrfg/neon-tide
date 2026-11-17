// Sound, all synthesised with WebAudio: no audio files. Short oscillator-and-noise blips
// for the effects, and a slow minor-key bassline that loops under the fight. The context is
// created on the first user gesture (browsers refuse sound before one), and every function
// is a no-op until then or while muted, so callers never check.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let noteIndex = 0;

  // A two-bar loop in A minor: low roots with a fifth/octave walk, one note per beat.
  const BASSLINE = [55.0, 0, 55.0, 82.41, 0, 55.0, 65.41, 0, 49.0, 0, 49.0, 73.42, 0, 98.0, 82.41, 0];
  const BEAT = 0.24;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    nextNoteTime = context.currentTime + 0.1;
    musicTimer = window.setInterval(scheduleMusic, 90);
    return true;
  }

  function tone(freqFrom, freqTo, duration, type, volume, delay = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqFrom), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function noise(duration, volume, filterFreq, delay = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
  }

  function scheduleMusic() {
    if (context === null) return;
    while (nextNoteTime < context.currentTime + 0.25) {
      const freq = BASSLINE[noteIndex % BASSLINE.length];
      if (freq > 0 && !muted) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.16, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, nextNoteTime + BEAT * 0.95);
        osc.connect(gain).connect(master);
        osc.start(nextNoteTime);
        osc.stop(nextNoteTime + BEAT);
      }
      nextNoteTime += BEAT;
      noteIndex += 1;
    }
  }

  return {
    /** Call on any user gesture: starts the context and the music. Safe to call often. */
    unlock: ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master !== null && context !== null) master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
      return muted;
    },
    shoot() {
      tone(880, 320, 0.07, 'square', 0.05);
    },
    hit() {
      tone(300, 140, 0.05, 'sawtooth', 0.06);
    },
    explosion(big = false) {
      noise(big ? 0.5 : 0.22, big ? 0.5 : 0.25, big ? 900 : 1400);
      tone(big ? 160 : 220, 40, big ? 0.45 : 0.2, 'sine', big ? 0.5 : 0.25);
    },
    playerHit() {
      tone(196, 65, 0.25, 'sawtooth', 0.3);
      noise(0.15, 0.2, 2000);
    },
    coreHit() {
      tone(130, 55, 0.35, 'square', 0.3);
    },
    dash() {
      noise(0.16, 0.12, 3200);
      tone(240, 720, 0.14, 'sine', 0.08);
    },
    upgrade() {
      tone(523.25, 523.25, 0.09, 'triangle', 0.2);
      tone(783.99, 783.99, 0.12, 'triangle', 0.2, 0.08);
      tone(1046.5, 1046.5, 0.18, 'triangle', 0.2, 0.17);
    },
    waveStart() {
      tone(329.63, 659.25, 0.16, 'triangle', 0.18);
    },
    gameOver() {
      tone(392, 392, 0.2, 'triangle', 0.25);
      tone(311.13, 311.13, 0.2, 'triangle', 0.25, 0.18);
      tone(233.08, 110, 0.6, 'triangle', 0.25, 0.36);
    },
    victory() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => tone(freq, freq, 0.22, 'triangle', 0.22, i * 0.13));
    },
  };
}
