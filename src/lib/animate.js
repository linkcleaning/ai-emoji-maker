// ─────────────────────────────────────────────────────────────
// 움직이는 이모티콘: 완성된 스티커 그림을 앱이 직접 움직여 GIF로 (AI 추가 비용 0원)
//  표정마다 어울리는 움직임을 자동으로 고름 (분노=부들부들, 사랑=두근두근, 축하=폴짝+반짝 …)
// ─────────────────────────────────────────────────────────────
import { encodeGif } from './gif.js';
import { loadImage } from './imageTools.js';

const FRAMES = 16;
const DELAY = 70; // ms → 한 바퀴 약 1.1초
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// 움직임 종류
const MOTION = {
  bounce: { label: '통통' },
  shake: { label: '부들부들' },
  pulse: { label: '두근두근', fx: '💗' },
  wobble: { label: '갸우뚱' },
  wave: { label: '흔들흔들' },
  jump: { label: '폴짝', fx: '✨' },
  droop: { label: '축 처짐', fx: '💧' },
  float: { label: '둥실둥실', fx: '💤' },
  spin: { label: '빙글' },
};

// 표정 → 움직임 (없으면 이름의 느낌으로 추측, 그래도 없으면 통통)
const BY_ID = {
  hello: 'wave', bye: 'wave', lc_arrive: 'wave', cr_welcome: 'wave', good_morning: 'jump',
  love: 'pulse', miss_you: 'pulse', kiss: 'pulse', finger_heart: 'pulse', shy: 'pulse', hug_me: 'pulse', flowers: 'pulse', lc_again: 'pulse', cr_sweet: 'pulse',
  fighting: 'jump', party: 'jump', payday: 'jump', leave_work: 'jump', dance: 'jump', clap: 'jump', birthday: 'jump', lc_done: 'jump', lc_sparkle: 'jump', lc_movein: 'jump', cr_birthday: 'jump', cr_new: 'jump', x_merry: 'jump', x_gift_open: 'jump', x_newyear: 'jump', yes_sir: 'jump', lol: 'shake',
  angry: 'shake', panic: 'shake', jealous: 'shake', headache: 'shake', surprised: 'shake', x_cold: 'shake', lc_mold: 'shake', lc_dust: 'shake',
  question: 'wobble', thinking: 'wobble', cool: 'wobble', idea: 'jump', lc_check: 'wobble', bored: 'wobble',
  sad: 'droop', sorry: 'droop', sorry_bow: 'droop', tired: 'droop', overtime: 'droop', commute: 'droop',
  sleep: 'float', good_night: 'float', roll: 'spin', x_snowball: 'spin', zoomies: 'spin',
};
export function motionFor(item) {
  if (BY_ID[item.id]) return BY_ID[item.id];
  const t = `${item.label} ${item.text || ''}`;
  if (/사랑|하트|고마|감사|♥/.test(t)) return 'pulse';
  if (/화|분노|짜증|추워|깜짝/.test(t)) return 'shake';
  if (/축하|신나|완료|최고|월급|출시/.test(t)) return 'jump';
  if (/졸|잠|자요|피곤/.test(t)) return 'float';
  if (/슬|눈물|미안|죄송/.test(t)) return 'droop';
  if (/\?|궁금|생각/.test(t)) return 'wobble';
  if (/안녕|어서|인사/.test(t)) return 'wave';
  return 'bounce';
}

/** t: 0~1 한 바퀴 위치 → 그릴 위치·크기·기울기 */
function pose(kind, t) {
  const s = Math.sin(t * Math.PI * 2), c = Math.cos(t * Math.PI * 2);
  switch (kind) {
    case 'shake': return { dx: Math.sin(t * Math.PI * 8) * 0.025, rot: Math.sin(t * Math.PI * 8) * 0.04, sx: 1, sy: 1 };
    case 'pulse': { const k = 1 + Math.max(0, Math.sin(t * Math.PI * 4)) * 0.07; return { sx: k, sy: k }; }
    case 'wobble': return { rot: s * 0.13, dy: -Math.abs(s) * 0.01 };
    case 'wave': return { rot: s * 0.08, dx: s * 0.015 };
    case 'jump': { const up = Math.max(0, Math.sin(t * Math.PI * 2)); const land = Math.max(0, -s); return { dy: -up * 0.09, sx: 1 + land * 0.06, sy: 1 - land * 0.06 }; }
    case 'droop': return { dy: (1 - c) * 0.02, sy: 1 - (1 - c) * 0.025, sx: 1 + (1 - c) * 0.015 };
    case 'float': return { dy: s * 0.025, rot: s * 0.03 };
    case 'spin': { const k = t < 0.5 ? 0 : (t - 0.5) * 2; const e = k * k * (3 - 2 * k); return { rot: e * Math.PI * 2, dy: -Math.sin(k * Math.PI) * 0.06, center: true }; } // 쉬었다가 한 바퀴
    default: { const up = Math.abs(Math.sin(t * Math.PI * 2)); return { dy: -up * 0.06, sx: 1 + (1 - up) * 0.04, sy: 1 - (1 - up) * 0.04 }; } // bounce
  }
}

/** 효과(하트·반짝이·zz·눈물) 그리기 */
function drawFx(ctx, kind, fx, t, size) {
  if (!fx) return;
  ctx.save();
  ctx.font = `${Math.round(size * 0.13)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const n = kind === 'jump' ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const p = (t + i / n) % 1;
    let x, y, a = Math.sin(p * Math.PI);
    if (kind === 'droop') { x = size * (0.36 + i * 0.28); y = size * (0.42 + p * 0.3); }
    else if (kind === 'float') { x = size * (0.76 + Math.sin(p * 6) * 0.03); y = size * (0.3 - p * 0.22); }
    else if (kind === 'jump') { const ang = (i / n) * Math.PI * 2 + 0.6; x = size * (0.5 + Math.cos(ang) * 0.4); y = size * (0.45 + Math.sin(ang) * 0.36); a = Math.abs(Math.sin(p * Math.PI * 2)); }
    else { x = size * (0.2 + i * 0.6); y = size * (0.55 - p * 0.4); }
    ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.3));
    ctx.fillText(fx, x, y);
  }
  ctx.restore();
}

/**
 * 스티커 PNG → 움직이는 GIF (dataURL)
 * @param url 완성된 스티커 그림, @param item 표정 정보, @param size 보낼 크기(px)
 */
export async function makeAnimatedSticker(url, item, size = 160) {
  const img = await loadImage(url);
  const kind = motionFor(item);
  const fx = MOTION[kind].fx;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  const base = size * 0.84; // 움직일 여유
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const t = f / FRAMES;
    const { dx = 0, dy = 0, rot = 0, sx = 1, sy = 1, center = false } = pose(kind, t);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (center) { // 가운데를 축으로 빙글
      ctx.translate(size / 2 + dx * size, size / 2 + dy * size); ctx.rotate(rot); ctx.scale(sx * 0.9, sy * 0.9);
      ctx.drawImage(img, -base / 2, -base / 2, base, base);
    } else {
      // 발밑을 기준으로 늘었다 줄었다 (통통 튀는 느낌)
      ctx.translate(size / 2 + dx * size, size / 2 + base / 2 + dy * size);
      ctx.rotate(rot);
      ctx.scale(sx, sy);
      ctx.drawImage(img, -base / 2, -base, base, base);
    }
    ctx.restore();
    drawFx(ctx, kind, fx, t, size);
    frames.push(ctx.getImageData(0, 0, size, size));
  }
  const bytes = encodeGif(frames, DELAY);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:image/gif;base64,${btoa(bin)}`;
}

export const motionLabel = (item) => MOTION[motionFor(item)].label;
