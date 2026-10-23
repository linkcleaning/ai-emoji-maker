/**
 * 로또 추첨기 효과음 — 파일 없이 Web Audio로 직접 합성 (용량 0)
 *  hum()    : 송풍기 모터 소리 (켜고 끄기)
 *  clack(v) : 공끼리·유리에 부딪히는 딸깍
 *  whoosh() : 공이 출구로 빨려 나가는 소리
 *  tick()   : 관 속을 굴러가는 또르륵
 *  ding(k)  : 받침대에 놓일 때 (k번째일수록 음이 올라감)
 *  fanfare(): 12개 모두 추첨 완료
 * 휴대폰은 화면을 한 번 터치해야 소리가 나므로, 첫 터치 때 자동으로 오디오를 깨움.
 */
const KEY = 'jjigeo-sound';
let ctx = null, master = null, noiseBuf = null;
let muted = (() => { try { return localStorage.getItem(KEY) === 'off'; } catch { return false; } })();
const listeners = new Set();

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* 저장 불가해도 무시 */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
  listeners.forEach((f) => f(m));
}
export const onMuteChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

function ac() {
  if (!ctx) {
    const A = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!A) return null;
    try { ctx = new A(); } catch { return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor(); // 소리가 겹쳐도 찢어지지 않게
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
const ready = () => !muted && ctx && ctx.state === 'running';

export function unlock() {
  const c = ac(); if (!c) return;
  const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(master); s.start(0); // iOS 깨우기
}
if (typeof window !== 'undefined') {
  const h = () => unlock();
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((e) => window.addEventListener(e, h, { passive: true, capture: true }));
}

function noise(dur) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = dur > 1; return s; }
function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

/** 송풍기 모터: 바람 소리(걸러낸 잡음) + 낮은 웅웅거림. 반환값 = 끄는 함수 */
export function hum() {
  if (!ac()) return () => {};
  const t = ctx.currentTime;
  const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(1, t + 0.6); out.connect(master);
  const n = noise(2); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
  const ng = ctx.createGain(); ng.gain.value = 0.05; n.connect(bp); bp.connect(ng); ng.connect(out);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
  const og = ctx.createGain(); og.gain.value = 0.018; o.connect(lp); lp.connect(og); og.connect(out);
  n.start(t); lfo.start(t); o.start(t);
  return () => {
    const e = ctx.currentTime;
    out.gain.cancelScheduledValues(e); out.gain.setValueAtTime(out.gain.value || 0.5, e); out.gain.exponentialRampToValueAtTime(0.0001, e + 0.5);
    [n, lfo, o].forEach((x) => { try { x.stop(e + 0.55); } catch { /* 이미 멈춤 */ } });
  };
}

let lastClack = 0;
/** 플라스틱 공 부딪힘. v = 0..1 세기 */
export function clack(v = 0.5) {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (t - lastClack < 0.06) return; // 너무 잦으면 건너뜀
  lastClack = t;
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1700 + Math.random() * 1300;
  const g = ctx.createGain(); env(g, t, 0.02 + 0.07 * v, 0.002, 0.05);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.07);
  const n = noise(0.05); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const ng = ctx.createGain(); env(ng, t, 0.03 * v + 0.01, 0.001, 0.02);
  n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t); n.stop(t + 0.04);
}

/** 출구로 쑥 빨려 나가는 소리 */
export function whoosh() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const n = noise(0.5); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(2800, t + 0.3);
  const g = ctx.createGain(); env(g, t, 0.16, 0.06, 0.3);
  n.connect(bp); bp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.42);
  // 뽁!
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(260, t + 0.02); o.frequency.exponentialRampToValueAtTime(720, t + 0.1);
  const og = ctx.createGain(); env(og, t + 0.02, 0.12, 0.005, 0.1);
  o.connect(og); og.connect(master); o.start(t + 0.02); o.stop(t + 0.15);
}

/** 관 속 또르륵 */
export function tick() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 900 + Math.random() * 300;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
  const g = ctx.createGain(); env(g, t, 0.025, 0.001, 0.025);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.04);
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]; // 도레미솔라 — 놓일수록 올라감
function bell(freq, t, vol = 0.12, dur = 0.9) {
  [[1, vol], [2.76, vol * 0.3], [5.4, vol * 0.12]].forEach(([m, v]) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
    const g = ctx.createGain(); env(g, t, v, 0.004, dur / m ** 0.5);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  });
}
/** 받침대에 놓임: 딩~ */
export function ding(k = 0) {
  if (!ready()) return;
  const t = ctx.currentTime;
  // 받침대에 톡
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
  const g = ctx.createGain(); env(g, t, 0.14, 0.002, 0.07); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
  bell(659.25 * 2 ** (SCALE[k % SCALE.length] / 12), t + 0.02, 0.1, 0.8);
}

/** 추첨 완료 팡파레 */
export function fanfare() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const s = t + i * 0.11;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain(); env(g, s, 0.11, 0.01, i === notes.length - 1 ? 0.9 : 0.16);
    o.connect(g); g.connect(master); o.start(s); o.stop(s + 1);
  });
  [1046.5, 1318.5, 1568].forEach((f) => bell(f, t + 0.46, 0.06, 1.4));
}
