// Âm thanh cho màn hình trình chiếu: nhạc nền vui nhộn tự tạo bằng Web Audio
// (không cần file, không vướng bản quyền) hoặc file nhạc BTC chọn từ máy (phát
// tại chỗ qua object URL, không tải lên server), cộng tiếng "ting" mỗi khi có
// người check-in.
//
// Trình duyệt chặn tự phát âm thanh: AudioContext chỉ chạy sau một cú bấm của
// người dùng, nên mọi thứ khởi tạo lười trong ensure() được gọi từ nút "Bật nhạc".

const midiToHz = (n) => 440 * 2 ** ((n - 69) / 12);

const BPM = 124;
const STEP = 60 / BPM / 4; // nốt móc kép
const LOOKAHEAD_S = 0.15;

// Vòng hợp âm I–V–vi–IV (Đô trưởng), mỗi hợp âm một ô nhịp = 16 bước.
const CHORDS = [
  { bass: 36, tones: [60, 64, 67, 72] }, // C
  { bass: 43, tones: [59, 62, 67, 71] }, // G
  { bass: 45, tones: [60, 64, 69, 72] }, // Am
  { bass: 41, tones: [60, 65, 69, 72] }, // F
];

// Giai điệu 2 ô nhịp (32 bước) lặp lại; null = nghỉ.
const MELODY = [
  76, null, 79, null, 76, 74, 72, null, 74, null, 76, null, 79, null, null, null,
  74, null, 74, 76, 79, null, 81, null, 79, null, 76, null, 74, null, null, null,
];

function envelope(ctx, node, t, peak, attack, release) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

class SynthLoop {
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noise;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  start() {
    this.nextTime = this.ctx.currentTime + 0.05;
    this.step = 0;
    // setInterval chỉ để "đánh thức" bộ lập lịch; thời điểm phát nốt do
    // AudioContext quyết định nên nhịp không bị lệch khi tab bận.
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  scheduleStep(step, t) {
    const s = step % 16;
    const chord = CHORDS[Math.floor(step / 16)];
    if (s % 4 === 0) this.kick(t);
    if (s % 4 === 2) this.hat(t);
    if (s === 4 || s === 12) this.clap(t);
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.bass(t, chord.bass + (s === 8 || s === 14 ? 12 : 0));
    if (s % 2 === 0) this.pluck(t, chord.tones[(s / 2) % 4] + 12);
    const note = MELODY[step % 32];
    if (note) this.lead(t, note);
  }

  kick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    envelope(this.ctx, g, t, 0.9, 0.005, 0.25);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  noiseHit(t, type, freq, peak, release) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    envelope(this.ctx, g, t, peak, 0.002, release);
    src.connect(filter).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + release + 0.05);
  }

  hat(t) { this.noiseHit(t, 'highpass', 7000, 0.18, 0.05); }
  clap(t) { this.noiseHit(t, 'bandpass', 1500, 0.45, 0.14); }

  tone(t, midi, { type, peak, release, cutoff }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(midiToHz(midi), t);
    const g = this.ctx.createGain();
    envelope(this.ctx, g, t, peak, 0.01, release);
    let node = osc;
    if (cutoff) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      node = osc.connect(f);
    }
    node.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + release + 0.05);
  }

  bass(t, midi) { this.tone(t, midi, { type: 'sawtooth', peak: 0.28, release: 0.2, cutoff: 450 }); }
  pluck(t, midi) { this.tone(t, midi, { type: 'triangle', peak: 0.07, release: 0.22 }); }
  lead(t, midi) { this.tone(t, midi, { type: 'square', peak: 0.07, release: 0.2, cutoff: 2600 }); }
}

export default class PartyAudio {
  constructor() {
    this.ctx = null;
    this.synth = null;
    this.fileEl = null;
    this.fileUrl = null;
    this.volume = 0.6;
    this.sfxEnabled = true;
  }

  // Phải được gọi trong handler của một cú bấm (chính sách autoplay).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.connect(this.master);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);

      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get unlocked() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  startSynth() {
    this.stopMusic();
    if (!this.ensure()) return false;
    this.synth = new SynthLoop(this.ctx, this.music, this.noise);
    this.synth.start();
    return true;
  }

  async playFile(file) {
    this.stopMusic();
    if (!this.ensure()) return false;
    this.fileUrl = URL.createObjectURL(file);
    const el = new Audio(this.fileUrl);
    el.loop = true;
    // Đi qua AudioContext để dùng chung âm lượng và cơ chế hạ nhạc khi "ting".
    this.ctx.createMediaElementSource(el).connect(this.music);
    this.fileEl = el;
    try {
      await el.play();
      return true;
    } catch {
      this.stopMusic();
      return false;
    }
  }

  stopMusic() {
    this.synth?.stop();
    this.synth = null;
    if (this.fileEl) {
      this.fileEl.pause();
      this.fileEl.src = '';
      this.fileEl = null;
    }
    if (this.fileUrl) {
      URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = null;
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // Hạ nhạc nền một chút cho tiếng chào nổi bật rồi trả lại.
  duck() {
    const now = this.ctx.currentTime;
    const g = this.music.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.35, now + 0.08);
    g.setValueAtTime(0.35, now + 1.2);
    g.linearRampToValueAtTime(1, now + 1.8);
  }

  // big = chào nhóm nhiều người cùng lúc: hợp âm "ta-da" dài hơn.
  chime({ big = false } = {}) {
    if (!this.sfxEnabled || !this.unlocked) return;
    this.duck();
    const t0 = this.ctx.currentTime + 0.02;
    const notes = big ? [72, 76, 79, 84, 88, 91, 96] : [84, 88, 91, 96];
    notes.forEach((n, i) => {
      const t = t0 + i * (big ? 0.06 : 0.07);
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(midiToHz(n), t);
      const g = this.ctx.createGain();
      envelope(this.ctx, g, t, big ? 0.22 : 0.25, 0.005, big ? 1.1 : 0.6);
      osc.connect(g).connect(this.sfx);
      osc.start(t);
      osc.stop(t + 1.3);
    });
  }

  dispose() {
    this.stopMusic();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
