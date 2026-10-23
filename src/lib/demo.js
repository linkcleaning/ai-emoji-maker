// ─────────────────────────────────────────────────────────────
// 데모 모드: API 없이 체험용 캐릭터를 캔버스로 그려 AI 응답을 흉내냄
// (실제 AI처럼 크로마 그린 배경으로 그려서, 배경 제거·다이컷 테두리 파이프라인을 그대로 통과)
// ─────────────────────────────────────────────────────────────

const PAL = {
  person: { skin: '#F7D5BD', hair: '#6B4632', hair2: '#8A5D42', cloth: '#F4F0E8' },
  cat: { skin: '#F2B36F', hair: '#C9773A', hair2: '#FBF6EE', cloth: '#FBF6EE' },
  dog: { skin: '#F3E2C7', hair: '#C98B55', hair2: '#FFF8EC', cloth: '#E86F5C' },
};
const INK = '#5A3B2A';

// 감정별 표정·소품 (EMOTIONS 순서와 동일)
const FACES = [
  { eyes: 'open', mouth: 'open', props: ['wave'] },
  { eyes: 'happy', mouth: 'smile', props: ['heart', 'hearts'] },
  { eyes: 'wink', mouth: 'grin', props: ['fist', 'sparkle'] },
  { eyes: 'shock', mouth: 'o', props: ['headhands', 'sweat'] },
  { eyes: 'angry', mouth: 'pout', props: ['vein', 'steam'], blush: 1.6 },
  { eyes: 'cry', mouth: 'wail', props: ['tears', 'tissue'] },
  { eyes: 'half', mouth: 'line', props: ['iv', 'darkcircle'] },
  { eyes: 'open', mouth: 'small', props: ['question'], tilt: -0.18 },
  { eyes: 'happy', mouth: 'open', props: ['partyhat', 'confetti'] },
  { eyes: 'closed', mouth: 'small', props: ['pillow', 'zzz', 'bubble'], tilt: 0.28 },
  { eyes: 'shades', mouth: 'smirk', props: ['arms', 'star'] },
  { eyes: 'happy', mouth: 'open', props: ['thumb', 'ok'] },
];

function fillShape(ctx, style, color, drawPath, { light = 0.28 } = {}) {
  ctx.beginPath();
  drawPath();
  if (style === '3d') {
    // 위 왼쪽에서 빛이 들어오는 말랑한 입체감
    const b = ctx.__bounds || { x: 256, y: 256, r: 140 };
    const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.45, b.r * 0.1, b.x, b.y, b.r * 1.25);
    g.addColorStop(0, shade(color, light));
    g.addColorStop(0.65, color);
    g.addColorStop(1, shade(color, -0.18));
    ctx.fillStyle = g;
    ctx.fill();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

const bounds = (ctx, x, y, r) => { ctx.__bounds = { x, y, r }; };
const circle = (ctx, x, y, r) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
const ellipse = (ctx, x, y, rx, ry, rot = 0) => () => ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);

function heart(ctx, x, y, s, color = '#E8434F') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 30, s / 30);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-30, -10, -15, -32, 0, -16);
  ctx.bezierCurveTo(15, -32, 30, -10, 0, 10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(-9, -14, 5, 3, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function text(ctx, str, x, y, size, color = INK, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `900 ${size}px "Jua", "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#fff'; ctx.strokeText(str, 0, 0);
  ctx.fillStyle = color; ctx.fillText(str, 0, 0);
  ctx.restore();
}

function star(ctx, x, y, r, color = '#FFC93C') {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.32 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawEyes(ctx, type, style, cx, cy) {
  const dx = 46;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 7;
  const big = style === '3d' ? 22 : 15;
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    const t = type === 'wink' && s === 1 ? 'happy' : type;
    if (t === 'open' || t === 'shock') {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x, cy, big * 0.8, big, 0, 0, Math.PI * 2); ctx.fill();
      if (style === '3d') {
        ctx.fillStyle = '#7B5136';
        ctx.beginPath(); ctx.ellipse(x, cy + 4, big * 0.6, big * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(x, cy + 3, big * 0.35, big * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      const hl = t === 'shock' ? 0.22 : 0.38;
      ctx.beginPath(); ctx.arc(x - big * 0.25, cy - big * 0.35, big * hl, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + big * 0.3, cy + big * 0.35, big * 0.14, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'happy') {
      ctx.beginPath(); ctx.arc(x, cy + 8, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (t === 'closed') {
      ctx.beginPath(); ctx.arc(x, cy - 6, 16, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    } else if (t === 'cry') {
      ctx.beginPath(); ctx.moveTo(x - 16, cy - 4); ctx.lineTo(x, cy + 6); ctx.lineTo(x + 16, cy - 4); ctx.stroke();
    } else if (t === 'angry') {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x, cy + 4, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 26, cy - 26); ctx.lineTo(x + s * 14, cy - 10); ctx.stroke();
    } else if (t === 'half') {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x, cy + 6, 12, 8, 0, 0, Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 18, cy + 4); ctx.lineTo(x + 18, cy + 4); ctx.stroke();
    }
  }
  if (type === 'shades') {
    ctx.fillStyle = '#1E1A1A';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.roundRect(cx + s * dx - 34, cy - 22, 68, 44, 14); ctx.fill();
    }
    ctx.lineWidth = 8; ctx.strokeStyle = '#1E1A1A';
    ctx.beginPath(); ctx.moveTo(cx - 14, cy - 10); ctx.lineTo(cx + 14, cy - 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(cx + s * dx - 22, cy - 14, 18, 8, 4); ctx.fill(); }
  }
}

function drawMouth(ctx, type, cx, cy) {
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.fillStyle = '#B94A48';
  ctx.beginPath();
  switch (type) {
    case 'open': ctx.moveTo(cx - 24, cy - 6); ctx.quadraticCurveTo(cx, cy + 40, cx + 24, cy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#F08A8A'; ctx.beginPath(); ctx.ellipse(cx, cy + 12, 11, 6, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'smile': ctx.arc(cx, cy - 8, 18, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); break;
    case 'grin': ctx.moveTo(cx - 20, cy - 4); ctx.quadraticCurveTo(cx, cy + 26, cx + 22, cy - 8); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'o': ctx.ellipse(cx, cy + 6, 13, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'small': ctx.ellipse(cx, cy + 2, 7, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'pout': ctx.moveTo(cx - 16, cy + 8); ctx.quadraticCurveTo(cx, cy - 10, cx + 16, cy + 8); ctx.stroke(); break;
    case 'wail': ctx.moveTo(cx - 30, cy + 22); ctx.quadraticCurveTo(cx, cy - 22, cx + 30, cy + 22); ctx.quadraticCurveTo(cx, cy + 34, cx - 30, cy + 22); ctx.fill(); ctx.stroke(); break;
    case 'line': ctx.moveTo(cx - 14, cy + 4); ctx.lineTo(cx + 14, cy + 2); ctx.stroke(); break;
    case 'smirk': ctx.moveTo(cx - 16, cy + 4); ctx.quadraticCurveTo(cx + 8, cy + 12, cx + 22, cy - 6); ctx.stroke(); break;
    default: break;
  }
}

function hand(ctx, style, p, x, y, r = 26) {
  bounds(ctx, x, y, r);
  fillShape(ctx, style, p.skin, circle(ctx, x, y, r));
}

/** 캐릭터 한 명을 (cx, cy) 기준으로 그림. 크기 기준 512px */
function drawCharacter(ctx, { category, style, index }) {
  const f = FACES[index];
  const p = PAL[category];
  const cx = 256, cy = 228, R = 118;
  const has = (k) => f.props.includes(k);

  ctx.save();
  ctx.translate(256, 300); ctx.rotate(f.tilt || 0); ctx.translate(-256, -300);

  if (has('pillow')) {
    bounds(ctx, 256, 360, 190);
    fillShape(ctx, style, '#FFFFFF', () => ctx.roundRect(70, 300, 372, 130, 60));
  }

  // 몸
  if (category === 'person') {
    bounds(ctx, cx, 420, 150);
    fillShape(ctx, style, p.cloth, () => ctx.roundRect(cx - 120, 330, 240, 170, [90, 90, 20, 20]));
    bounds(ctx, cx, 330, 40);
    fillShape(ctx, style, p.skin, () => ctx.roundRect(cx - 26, 318, 52, 34, 14));
  } else {
    bounds(ctx, cx, 400, 130);
    fillShape(ctx, style, p.skin, ellipse(ctx, cx, 395, 118, 100));
    bounds(ctx, cx, 410, 70);
    fillShape(ctx, style, p.hair2, ellipse(ctx, cx, 410, 66, 70), { light: 0.1 });
    if (category === 'dog') { // 빨간 목줄
      ctx.fillStyle = p.cloth; ctx.beginPath(); ctx.roundRect(cx - 70, 316, 140, 22, 11); ctx.fill();
      ctx.fillStyle = '#FFC93C'; ctx.beginPath(); ctx.arc(cx, 344, 12, 0, Math.PI * 2); ctx.fill();
    }
    // 꼬리
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = style === '2d' ? INK : shade(p.hair, -0.1); ctx.lineWidth = style === '2d' ? 30 : 26;
    ctx.beginPath(); ctx.moveTo(cx + 100, 440); ctx.quadraticCurveTo(cx + 190, 430, cx + 170, 340); ctx.stroke();
    ctx.strokeStyle = category === 'cat' ? p.hair : p.skin; ctx.lineWidth = 20;
    ctx.stroke();
    ctx.restore();
  }

  // 귀 (동물)
  if (category === 'cat') {
    for (const s of [-1, 1]) {
      bounds(ctx, cx + s * 80, cy - 100, 60);
      fillShape(ctx, style, p.skin, () => { ctx.moveTo(cx + s * 30, cy - 100); ctx.lineTo(cx + s * 100, cy - 150); ctx.lineTo(cx + s * 112, cy - 40); ctx.closePath(); });
      ctx.fillStyle = '#F7A6A6';
      ctx.beginPath(); ctx.moveTo(cx + s * 52, cy - 96); ctx.lineTo(cx + s * 96, cy - 126); ctx.lineTo(cx + s * 100, cy - 66); ctx.closePath(); ctx.fill();
    }
  }
  if (category === 'dog') {
    for (const s of [-1, 1]) {
      bounds(ctx, cx + s * 120, cy, 70);
      fillShape(ctx, style, p.hair, ellipse(ctx, cx + s * 112, cy - 8, 40, 82, s * 0.35));
    }
  }

  // 머리
  bounds(ctx, cx, cy, R);
  if (category === 'person') {
    fillShape(ctx, style, p.hair, ellipse(ctx, cx, cy + 10, R + 18, R + 26)); // 뒷머리
    bounds(ctx, cx, cy, R);
  }
  fillShape(ctx, style, p.skin, ellipse(ctx, cx, cy + 6, R, R * 0.96));

  if (category === 'person') { // 앞머리 + 똥머리
    bounds(ctx, cx, cy - 80, 120);
    fillShape(ctx, style, p.hair, () => {
      ctx.moveTo(cx - R - 6, cy + 10);
      ctx.bezierCurveTo(cx - R, cy - 150, cx + R, cy - 150, cx + R + 6, cy + 10);
      ctx.bezierCurveTo(cx + 70, cy - 60, cx + 10, cy - 70, cx - 10, cy - 40);
      ctx.bezierCurveTo(cx - 40, cy - 70, cx - 90, cy - 50, cx - R - 6, cy + 10);
    });
    bounds(ctx, cx + 20, cy - 140, 40);
    fillShape(ctx, style, p.hair, circle(ctx, cx + 30, cy - 132, 38));
  }
  if (category === 'cat') { // 이마 줄무늬
    ctx.strokeStyle = p.hair; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const o of [-22, 0, 22]) { ctx.beginPath(); ctx.moveTo(cx + o, cy - 106); ctx.lineTo(cx + o * 0.7, cy - 70); ctx.stroke(); }
    for (const s of [-1, 1]) for (const o of [0, 26]) { ctx.beginPath(); ctx.moveTo(cx + s * 118, cy + o - 6); ctx.lineTo(cx + s * 86, cy + o); ctx.stroke(); }
  }
  if (category !== 'person') { // 주둥이
    bounds(ctx, cx, cy + 50, 60);
    fillShape(ctx, style, p.hair2, ellipse(ctx, cx, cy + 52, 58, 40), { light: 0.1 });
    ctx.fillStyle = category === 'cat' ? '#E98A8A' : '#3A2A22';
    ctx.beginPath(); ctx.ellipse(cx, cy + 28, category === 'cat' ? 10 : 16, category === 'cat' ? 7 : 11, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 볼터치
  ctx.fillStyle = `rgba(255,120,120,${0.35 * (f.blush || 1)})`;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 76, cy + 38, 22 * (f.blush || 1) ** 0.5, 13, 0, 0, Math.PI * 2); ctx.fill(); }

  if (has('darkcircle')) {
    ctx.strokeStyle = 'rgba(110,80,140,.45)'; ctx.lineWidth = 6;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 46, cy + 4, 20, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  }
  drawEyes(ctx, f.eyes, style, cx, cy);
  drawMouth(ctx, f.mouth, cx, cy + (category === 'person' ? 48 : 62));

  // ── 소품 ──
  if (has('wave')) { hand(ctx, style, p, cx - 150, cy + 70); hand(ctx, style, p, cx + 150, cy + 70);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 150, cy + 70, 46, s > 0 ? -0.9 : Math.PI - 0.1, s > 0 ? 0.1 : Math.PI + 0.9); ctx.stroke(); } }
  if (has('heart')) { heart(ctx, cx, 392, 80); hand(ctx, style, p, cx - 60, 400, 22); hand(ctx, style, p, cx + 60, 400, 22); }
  if (has('hearts')) { heart(ctx, cx + 160, cy - 110, 30); heart(ctx, cx - 165, cy - 70, 22); }
  if (has('fist')) { hand(ctx, style, p, cx + 150, cy + 30, 32); ctx.strokeStyle = INK; ctx.lineWidth = 4; for (const o of [-10, 4, 18]) { ctx.beginPath(); ctx.moveTo(cx + 132, cy + 20 + o); ctx.lineTo(cx + 150, cy + 20 + o); ctx.stroke(); } }
  if (has('sparkle')) { star(ctx, cx + 175, cy - 70, 22); star(ctx, cx - 165, cy - 110, 14); }
  if (has('headhands')) { hand(ctx, style, p, cx - 112, cy - 60); hand(ctx, style, p, cx + 112, cy - 60); }
  if (has('sweat')) { ctx.fillStyle = '#6FB6F2'; for (const [x, y, s] of [[cx + 150, cy - 40, 1], [cx - 160, cy - 10, 0.8], [cx + 130, cy + 20, 0.6]]) { ctx.beginPath(); ctx.moveTo(x, y - 24 * s); ctx.quadraticCurveTo(x + 16 * s, y, x, y + 10 * s); ctx.quadraticCurveTo(x - 16 * s, y, x, y - 24 * s); ctx.fill(); } }
  if (has('vein')) { ctx.strokeStyle = '#E2453C'; ctx.lineWidth = 9; ctx.lineCap = 'round'; const x = cx + 120, y = cy - 120;
    for (const [a, b] of [[[-18, -6], [-6, -6]], [[6, -18], [6, -6]], [[18, 6], [6, 6]], [[-6, 18], [-6, 6]]]) { ctx.beginPath(); ctx.moveTo(x + a[0], y + a[1]); ctx.lineTo(x + b[0], y + b[1]); ctx.stroke(); } }
  if (has('steam')) { ctx.fillStyle = '#FFFFFF'; for (const [x, y, r] of [[cx - 170, cy - 40, 22], [cx - 185, cy - 70, 15], [cx + 170, cy - 30, 18]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); } }
  if (has('tears')) { ctx.fillStyle = 'rgba(111,182,242,.85)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(cx + s * 46 - 10, cy + 6, 20, 120, 10); ctx.fill(); } }
  if (has('tissue')) { bounds(ctx, cx + 140, cy + 110, 40); fillShape(ctx, style, '#FFFFFF', () => { ctx.moveTo(cx + 120, cy + 140); ctx.lineTo(cx + 110, cy + 80); ctx.lineTo(cx + 150, cy + 70); ctx.lineTo(cx + 175, cy + 130); ctx.closePath(); }); hand(ctx, style, p, cx + 140, cy + 140, 22); }
  if (has('iv')) {
    ctx.strokeStyle = '#9AA3AD'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx + 190, 470); ctx.lineTo(cx + 190, 60); ctx.lineTo(cx + 150, 60); ctx.stroke();
    bounds(ctx, cx + 150, 110, 40); fillShape(ctx, style, '#FFFFFF', () => ctx.roundRect(cx + 122, 72, 56, 76, 10));
    ctx.fillStyle = '#7A4B2E'; ctx.beginPath(); ctx.roundRect(cx + 128, 104, 44, 38, 6); ctx.fill();
    text(ctx, 'Coffee', cx + 150, 90, 14, '#7A4B2E');
    ctx.strokeStyle = '#7A4B2E'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 150, 148); ctx.quadraticCurveTo(cx + 170, 300, cx + 90, 380); ctx.stroke();
  }
  if (has('question')) { bounds(ctx, cx + 150, cy - 130, 50); fillShape(ctx, style, '#FFFFFF', circle(ctx, cx + 150, cy - 130, 46)); text(ctx, '?', cx + 150, cy - 128, 58); hand(ctx, style, p, cx + 40, cy + 120, 20); }
  if (has('partyhat')) { bounds(ctx, cx, cy - 170, 60); fillShape(ctx, style, '#6FB6F2', () => { ctx.moveTo(cx - 50, cy - 110); ctx.lineTo(cx + 10, cy - 230); ctx.lineTo(cx + 60, cy - 105); ctx.closePath(); });
    ctx.strokeStyle = '#FFC93C'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx - 28, cy - 150); ctx.lineTo(cx + 38, cy - 150); ctx.stroke(); star(ctx, cx + 10, cy - 232, 18, '#FF7F66'); }
  if (has('confetti')) { const cols = ['#FF7F66', '#FFC93C', '#6FB6F2', '#8BD17C', '#B98AF0']; for (let i = 0; i < 22; i++) { const a = i * 2.4, r = 170 + (i % 4) * 18; ctx.fillStyle = cols[i % 5]; ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy - 20 + Math.sin(a) * r * 0.8); ctx.rotate(a); ctx.fillRect(-7, -3, 14, 6); ctx.restore(); } }
  if (has('zzz')) { text(ctx, 'Z', cx + 130, cy - 120, 44, '#6B6FD4', -0.2); text(ctx, 'z', cx + 175, cy - 165, 32, '#6B6FD4', -0.2); text(ctx, 'z', cx + 200, cy - 200, 24, '#6B6FD4', -0.2); }
  if (has('bubble')) { ctx.fillStyle = 'rgba(160,210,250,.75)'; ctx.beginPath(); ctx.arc(cx + 30, cy + 40, 20, 0, Math.PI * 2); ctx.fill(); }
  if (has('arms')) { bounds(ctx, cx, 380, 120); fillShape(ctx, style, category === 'person' ? p.skin : p.skin, () => ctx.roundRect(cx - 100, 360, 200, 46, 23)); }
  if (has('star')) star(ctx, cx + 165, cy - 60, 26);
  if (has('thumb')) { hand(ctx, style, p, cx + 150, cy + 80, 30); bounds(ctx, cx + 150, cy + 40, 20); fillShape(ctx, style, p.skin, () => ctx.roundRect(cx + 138, cy + 20, 24, 50, 12)); }
  if (has('ok')) text(ctx, 'OK!', cx - 150, cy - 110, 54, '#FF7F66', -0.15);

  ctx.restore();
}

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(0, 0, w, h);
  return [c, ctx];
}

/** AI 응답 흉내: 한 장 */
export async function demoSticker({ category, style, index }) {
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 450));
  const [c, ctx] = newCanvas(512, 512);
  ctx.save();
  ctx.translate(256, 256); ctx.scale(0.86, 0.86); ctx.translate(-256, -256);
  drawCharacter(ctx, { category, style, index });
  ctx.restore();
  return c.toDataURL('image/png');
}

/** AI 응답 흉내: 4행×3열 시트 */
export async function demoSheet({ category, style, set }) {
  await new Promise((r) => setTimeout(r, 1200));
  const [c, ctx] = newCanvas(768, 1024);
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.translate((i % 3) * 256, Math.floor(i / 3) * 256);
    ctx.scale(0.42, 0.42); ctx.translate(48, 48);
    drawCharacter(ctx, { category, style, index: set?.[i]?.demo ?? i });
    ctx.restore();
  }
  return c.toDataURL('image/png');
}
