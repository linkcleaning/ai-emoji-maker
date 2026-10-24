// ─────────────────────────────────────────────────────────────
// 이미지 후처리: 업로드 리사이즈, 크로마 배경 제거, 다이컷 흰 테두리 + 그림자, 시트 분할
// ─────────────────────────────────────────────────────────────

export const OUTPUT_SIZE = 768; // 최종 스티커 PNG 크기(정사각)

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
    img.src = src;
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** 업로드 사진 → 최대 1024px JPEG(base64) */
export async function prepareUpload(file, max = 768) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = makeCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.86);
    return { dataUrl, mime: 'image/jpeg', base64: dataUrl.split(',')[1] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlToRef(dataUrl) {
  const [head, base64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] || 'image/png';
  return { mime, base64 };
}

/** 이미 투명 배경인지(모서리 알파 확인) */
function hasTransparentCorners(data, w, h) {
  const idx = [0, w - 1, (h - 1) * w, h * w - 1];
  return idx.filter((i) => data[i * 4 + 3] < 20).length >= 3;
}

/** 가장자리에서 배경색 추정 (가장자리 픽셀 평균) */
function estimateKey(data, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(1, Math.floor(w / 64));
  const add = (x, y) => { const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; };
  for (let x = 0; x < w; x += step) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y += step) { add(0, y); add(w - 1, y); }
  return [r / n, g / n, b / n];
}

/**
 * 가장자리에서 연결된 배경만 flood-fill로 제거 (캐릭터 내부의 같은 색은 보존)
 * 경계는 부드럽게 반투명 처리 + 초록 번짐(despill) 제거
 */
export function removeBackground(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  if (hasTransparentCorners(d, w, h)) return canvas;

  const key = estimateKey(d, w, h);
  const isGreenKey = key[1] > key[0] + 40 && key[1] > key[2] + 40;

  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(p);
  };
  const seedEdges = () => {
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  };

  if (isGreenKey) {
    // ── 크로마 그린 ──
    // 배경 = '밝고 확실한 초록'. 캐릭터 털·옷에 비친 초록(그림자 쪽)은 밝기가 낮아 배경으로 보지 않음.
    // 확실한 배경 픽셀을 따라서만 안쪽으로 번져 나가고, 경계의 애매한 픽셀은 반투명 처리만 하고 멈춤.
    const keyG = key[1];
    const gness = (i) => d[i + 1] - Math.max(d[i], d[i + 2]);
    const bright = (i) => d[i + 1] >= keyG * 0.55;
    const LO = 22, HI = 70;   // 초록 우세 정도: LO 이하 = 캐릭터, HI 이상 = 배경
    const SPREAD = 46;         // 이 이상 + 밝은 초록이어야 '확실한 배경'으로 보고 계속 번짐
    seedEdges();
    while (stack.length) {
      const p = stack.pop();
      const i = p * 4;
      const g = gness(i);
      if (g <= LO || !bright(i)) continue; // 캐릭터(또는 초록이 비친 털) → 멈춤
      const a = g >= HI ? 0 : (HI - g) / (HI - LO);
      d[i + 3] = Math.min(d[i + 3], Math.round(a * 255));
      if (g >= SPREAD) {
        const x = p % w, y = (p / w) | 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      }
    }
    // 팔·꼬리 사이처럼 바깥과 이어지지 않은 '갇힌 배경': 아주 확실한 밝은 초록만 제거
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const g = gness(i);
      if (d[i + 1] >= keyG * 0.7) {
        if (g >= 95) d[i + 3] = 0;
        else if (g > 70) d[i + 3] = Math.min(d[i + 3], Math.round(((95 - g) / 25) * 255));
      }
    }
    // 초록 반사(스필) 제거: 남은 모든 픽셀의 초록 기운을 빨강·파랑 수준으로 낮춤 (투명도는 그대로)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const m = Math.max(d[i], d[i + 2]), avg = (d[i] + d[i + 2]) / 2;
      if (d[i + 1] > m) d[i + 1] = Math.round(Math.max(m, avg + 8));
    }
  } else {
    // ── 그 밖의 단색 배경(흰색 등): 색 거리로 판단 ──
    const T1 = 38, T2 = 70;
    const dist = (i) => {
      const dr = d[i] - key[0], dg = d[i + 1] - key[1], db = d[i + 2] - key[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };
    seedEdges();
    while (stack.length) {
      const p = stack.pop();
      const i = p * 4;
      const dd = dist(i);
      if (dd < T1) {
        d[i + 3] = 0;
        const x = p % w, y = (p / w) | 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      } else if (dd < T2) {
        d[i + 3] = Math.min(d[i + 3], Math.round(((dd - T1) / (T2 - T1)) * 255));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** 불투명 영역의 bounding box */
function contentBox(canvas, alphaMin = 24) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > alphaMin) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ── 정확한 거리 변환(EDT): 각 픽셀에서 가장 가까운 '캐릭터' 픽셀까지의 거리 ──
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    do { const r = v[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r); } while (s <= z[k] && --k >= 0);
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
}
function distanceField(mask, w, h) {
  const INF = 1e20, g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? 0 : INF;
  const n = Math.max(w, h), f = new Float32Array(n), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]); }
  return g;
}

/**
 * 배경 찌꺼기 청소: 덜 지워진 점·티끌(작은 조각)을 없애고 캐릭터 가장자리만 남김
 * → 흰 테두리가 울퉁불퉁·점선처럼 보이던 문제 해결
 */
export function cleanAlpha(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 128 ? 1 : 0;
  // 연결된 덩어리별 크기 → 작은 티끌 제거 (하트·물음표·폭죽 조각 같은 소품은 유지)
  const label = new Int32Array(w * h), sizes = [0], stack = [];
  let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!solid[i] || label[i]) continue;
    id++; let cnt = 0; stack.push(i); label[i] = id;
    while (stack.length) {
      const p = stack.pop(); cnt++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && solid[p - 1] && !label[p - 1]) { label[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && solid[p + 1] && !label[p + 1]) { label[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && solid[p - w] && !label[p - w]) { label[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && solid[p + w] && !label[p + w]) { label[p + w] = id; stack.push(p + w); }
    }
    sizes.push(cnt);
  }
  const minSize = Math.max(40, Math.round(w * h * 0.00012));
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) keep[i] = label[i] && sizes[label[i]] >= minSize ? 1 : 0;
  // 남긴 덩어리에서 2px 넘게 떨어진 반투명 점은 모두 제거
  const dist = distanceField(keep, w, h);
  for (let i = 0; i < w * h; i++) {
    if (keep[i]) continue;
    if (dist[i] > 2) d[i * 4 + 3] = 0;
    else if (label[i]) d[i * 4 + 3] = 0; // 작은 덩어리 자체
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * 다이컷 스티커: 캐릭터 둘레로 일정한 두께의 매끈한 흰 테두리 + 은은한 그림자, 정사각 투명 PNG
 */
export function dieCut(srcCanvas, size = OUTPUT_SIZE) {
  cleanAlpha(srcCanvas);
  const box = contentBox(srcCanvas, 128);
  const border = Math.round(size * 0.028);           // 굵은 흰 테두리
  const shadowPad = Math.round(size * 0.035);
  const inner = size - 2 * (border + shadowPad);
  const scale = Math.min(inner / box.w, inner / box.h);
  const cw = Math.round(box.w * scale), ch = Math.round(box.h * scale);
  const ox = Math.round((size - cw) / 2), oy = Math.round((size - ch) / 2);

  // 1) 캐릭터만 배치
  const art = makeCanvas(size, size);
  const actx = art.getContext('2d', { willReadFrequently: true });
  actx.imageSmoothingQuality = 'high';
  actx.drawImage(srcCanvas, box.x, box.y, box.w, box.h, ox, oy, cw, ch);

  // 2) 거리 변환으로 정확히 같은 두께의 둥근 테두리 계산 (가장자리는 1px 부드럽게)
  const ad = actx.getImageData(0, 0, size, size).data;
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) mask[i] = ad[i * 4 + 3] > 110 ? 1 : 0;
  const dist = distanceField(mask, size, size);
  const sticker = makeCanvas(size, size);
  const tctx = sticker.getContext('2d');
  const bimg = tctx.createImageData(size, size), bd = bimg.data;
  for (let i = 0; i < size * size; i++) {
    const a = Math.max(0, Math.min(1, border + 0.5 - dist[i]));
    if (a > 0) { bd[i * 4] = 255; bd[i * 4 + 1] = 255; bd[i * 4 + 2] = 255; bd[i * 4 + 3] = Math.round(a * 255); }
  }
  tctx.putImageData(bimg, 0, 0);
  tctx.drawImage(art, 0, 0);

  // 3) 그림자와 합성
  const out = makeCanvas(size, size);
  const octx = out.getContext('2d');
  octx.shadowColor = 'rgba(62, 44, 34, 0.28)';
  octx.shadowBlur = Math.round(size * 0.018);
  octx.shadowOffsetY = Math.round(size * 0.008);
  octx.drawImage(sticker, 0, 0);
  return out;
}

/** 단순 정사각 배치(후처리 끔) */
function fitSquare(srcCanvas, size = OUTPUT_SIZE) {
  const out = makeCanvas(size, size);
  const ctx = out.getContext('2d');
  const s = Math.min(size / srcCanvas.width, size / srcCanvas.height);
  const w = srcCanvas.width * s, h = srcCanvas.height * s;
  ctx.drawImage(srcCanvas, (size - w) / 2, (size - h) / 2, w, h);
  return out;
}

function imageToCanvas(img, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const c = makeCanvas(Math.round(sw), Math.round(sh));
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/** AI 원본 → 최종 스티커 PNG dataURL */
export async function processSticker(rawDataUrl, { postprocess = true } = {}) {
  const img = await loadImage(rawDataUrl);
  const c = imageToCanvas(img);
  if (!postprocess) return fitSquare(c).toDataURL('image/png');
  removeBackground(c);
  removeFrame(c);
  return dieCut(c).toDataURL('image/png');
}

/**
 * AI가 그린 이미지의 배경이 정상인지 검사
 * 정상: 이미지 가장자리 둘레가 대부분 초록(또는 투명) → 액자·카드가 없음
 */
export async function checkBackground(rawDataUrl) {
  const img = await loadImage(rawDataUrl);
  const c = imageToCanvas(img);
  const w = c.width, h = c.height;
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const isBg = (x, y) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 30) return true;
    return d[i + 1] - Math.max(d[i], d[i + 2]) > 60 && d[i + 1] > 140;
  };
  // 네 변에서 안쪽으로 훑어 처음 만나는 '배경 아닌 픽셀'의 깊이를 잼.
  // 액자·카드: 한 변의 거의 모든 줄이 같은 깊이에서 부딪힘. 캐릭터 몸이 아래에 닿는 건 한 변뿐이라 괜찮음.
  const maxDepth = Math.round(Math.min(w, h) * 0.15);
  const sides = [
    (t, k) => [Math.round(w * t), k], (t, k) => [Math.round(w * t), h - 1 - k],
    (t, k) => [k, Math.round(h * t)], (t, k) => [w - 1 - k, Math.round(h * t)],
  ];
  let framed = 0;
  for (const at of sides) {
    const depths = [];
    for (let s = 0; s < 40; s++) {
      const t = 0.1 + (0.8 * s) / 39;
      let hit = null;
      for (let k = 0; k < maxDepth; k++) { const [x, y] = at(t, k); if (!isBg(x, y)) { hit = k; break; } }
      depths.push(hit);
    }
    const hits = depths.filter((v) => v !== null).sort((a, b) => a - b);
    if (hits.length < 32) continue; // 80% 미만이 부딪힘 → 액자 아님
    const m = hits[hits.length >> 1];
    const close = hits.filter((v) => Math.abs(v - m) <= Math.max(4, w * 0.006)).length;
    if (close >= 28) framed++;
  }
  return { ok: framed < 3, framedSides: framed };
}

/**
 * 액자·카드 제거 (AI가 지시를 어기고 사각 테두리나 카드 배경을 그린 경우의 안전장치)
 * 1) 이미지 거의 전체를 두르는 '가는 선' 덩어리(액자 선) 제거
 * 2) 남은 그림이 사각형 카드처럼 이미지 대부분을 덮으면, 카드 바깥쪽 색을 따라 안으로 벗겨냄
 */
export function removeFrame(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const solid = (p) => d[p * 4 + 3] > 128;

  // 1) 연결 덩어리 중 '이미지 전체를 감싸는데 속이 빈' 것 = 액자 선
  const label = new Int32Array(w * h);
  let id = 0;
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!solid(s) || label[s]) continue;
    id++; label[s] = id; stack.push(s);
    let cnt = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    const members = [];
    while (stack.length) {
      const p = stack.pop(); cnt++; members.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && solid(p - 1) && !label[p - 1]) { label[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && solid(p + 1) && !label[p + 1]) { label[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && solid(p - w) && !label[p - w]) { label[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && solid(p + w) && !label[p + w]) { label[p + w] = id; stack.push(p + w); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const fill = cnt / (bw * bh);
    if (bw > w * 0.8 && bh > h * 0.8 && fill < 0.18) {
      for (const p of members) d[p * 4 + 3] = 0; // 속 빈 액자 선 → 삭제
    }
  }

  // 2) 카드 벗기기: 불투명 영역이 이미지 거의 전체(88%↑)를 덮고 둘레가 꽉 차 있으면(=카드),
  //    둘레 색(액자 선 색 + 카드 바탕색)을 여러 깊이에서 뽑아 바깥부터 벗겨냄 (최대 3번)
  const med = (arr) => arr.sort((m, n) => m - n)[arr.length >> 1];
  for (let round = 0; round < 3; round++) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let p = 0; p < w * h; p++) if (solid(p)) {
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0 || (x1 - x0) < w * 0.88 || (y1 - y0) < h * 0.88) break;
    const ringAt = (k) => {
      const rs = [], gs = [], bs = []; let total = 0;
      const take = (x, y) => { total++; const i = (y * w + x) * 4; if (d[i + 3] > 128) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); } };
      for (let x = x0 + k; x <= x1 - k; x += 3) { take(x, y0 + k); take(x, y1 - k); }
      for (let y = y0 + k; y <= y1 - k; y += 3) { take(x0 + k, y); take(x1 - k, y); }
      return { fill: rs.length / Math.max(1, total), key: rs.length > 20 ? [med(rs), med(gs), med(bs)] : null };
    };
    const outer = ringAt(4);
    // 캐릭터가 크게 그려져 가장자리에 닿은 경우(둘레 대부분 비어 있음)는 건드리지 않음
    if (outer.fill < 0.7) break;
    const keys = [outer.key];
    for (const k of [Math.round(w * 0.012), Math.round(w * 0.025), Math.round(w * 0.04)]) {
      const r = ringAt(k);
      if (r.key && r.fill > 0.7) keys.push(r.key);
    }
    // 둘레 색들 + '두 색이 섞인 중간색'(액자 선과 카드 사이 번짐)까지 가까운 정도
    const segs = [];
    for (let m = 0; m < keys.length; m++) for (let n = m + 1; n < keys.length; n++) segs.push([keys[m], keys[n]]);
    const near = (i) => {
      const c = [d[i], d[i + 1], d[i + 2]];
      let best = 1e9;
      for (const k of keys) best = Math.min(best, Math.hypot(c[0] - k[0], c[1] - k[1], c[2] - k[2]));
      for (const [A, B] of segs) {
        const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        if (len2 < 400) continue;
        const t = Math.max(0, Math.min(1, ((c[0] - A[0]) * ab[0] + (c[1] - A[1]) * ab[1] + (c[2] - A[2]) * ab[2]) / len2));
        best = Math.min(best, Math.hypot(c[0] - A[0] - t * ab[0], c[1] - A[1] - t * ab[1], c[2] - A[2] - t * ab[2]) + 6);
      }
      return best;
    };
    const seen = new Uint8Array(w * h), st = [];
    const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (seen[p]) return; seen[p] = 1; st.push(p); };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    let removed = 0;
    while (st.length) {
      const p = st.pop(), i = p * 4;
      const passable = d[i + 3] < 200; // 이미 (반)투명 = 지나갈 수 있음
      const dist = passable ? 0 : near(i);
      // 기준을 좁게(30): 검은 액자 옆의 검은 머리·옷은 남김
      if (passable || dist < 30) {
        if (d[i + 3] && (dist < 30 || near(i) < 60)) { d[i + 3] = 0; removed++; }
        const x = p % w, y = (p / w) | 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      } else if (dist < 55) {
        d[i + 3] = Math.min(d[i + 3], Math.round(((dist - 30) / 25) * 255));
      }
    }
    if (removed < w * h * 0.01) break;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** 4행×3열 시트 → 12장 원본 조각(dataURL). 배경 제거 후 셀 단위로 자름 */
/**
 * 4행×3열 시트 → 12장 조각
 * AI가 칸을 정확히 안 맞춰 그려도 되도록, 배경을 지운 뒤 '그림 덩어리'를 찾아
 * 각 덩어리의 중심이 들어간 칸에 배정해서 오려냄 (칸 경계에서 잘리지 않음)
 */
export async function sliceSheet(rawDataUrl, cols = 3, rows = 4) {
  const img = await loadImage(rawDataUrl);
  const full = imageToCanvas(img);
  removeBackground(full);
  removeFrame(full);
  const w = full.width, h = full.height;
  const ctx = full.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, w, h).data;
  const cw = w / cols, ch = h / rows;

  // 덩어리 찾기
  const label = new Int32Array(w * h);
  const comps = [null];
  const stack = [];
  const minSize = Math.max(30, Math.round(w * h * 0.00004));
  for (let s = 0; s < w * h; s++) {
    if (label[s] || d[s * 4 + 3] <= 110) continue;
    const id = comps.length;
    label[s] = id; stack.push(s);
    let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && !label[q] && d[q * 4 + 3] > 110) { label[q] = id; stack.push(q); }
    }
    comps.push({ n, cx: sx / n, cy: sy / n, x0, y0, x1, y1 });
  }

  // 덩어리 → 칸 배정
  //  1) 큰 덩어리(캐릭터 몸)는 중심이 들어간 칸으로
  //  2) 작은 덩어리(하트·물음표 같은 소품)는 가장 가까운 캐릭터를 따라감 → 옆 칸 소품이 섞이지 않음
  const cellOf = (c) => Math.min(rows - 1, Math.floor(c.cy / ch)) * cols + Math.min(cols - 1, Math.floor(c.cx / cw));
  const groups = Array.from({ length: cols * rows }, () => []);
  const valid = comps.map((c, id) => (c && c.n >= minSize ? id : 0)).filter(Boolean);
  const maxN = Math.max(1, ...valid.map((id) => comps[id].n));
  const big = valid.filter((id) => comps[id].n >= maxN * 0.15);
  const owner = new Map();
  for (const id of big) { const k = cellOf(comps[id]); groups[k].push(id); owner.set(id, k); }
  const gap = (c, b) => Math.hypot(Math.max(b.x0 - c.cx, 0, c.cx - b.x1), Math.max(b.y0 - c.cy, 0, c.cy - b.y1));
  for (const id of valid) {
    if (owner.has(id)) continue;
    const c = comps[id];
    let best = null, bd = Infinity;
    for (const b of big) { const dd = gap(c, comps[b]); if (dd < bd) { bd = dd; best = b; } }
    groups[best != null && bd < Math.max(cw, ch) * 0.6 ? owner.get(best) : cellOf(c)].push(id);
  }

  const pieces = [];
  for (let k = 0; k < cols * rows; k++) {
    const ids = groups[k];
    if (!ids.length) { // 못 찾으면 예전처럼 칸 그대로
      pieces.push(imageToCanvas(full, (k % cols) * cw, Math.floor(k / cols) * ch, cw, ch));
      continue;
    }
    const mine = new Set(ids);
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const id of ids) { const c = comps[id]; x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); }
    const pad = 3;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
    const piece = makeCanvas(pw, ph);
    const pctx = piece.getContext('2d', { willReadFrequently: true });
    const out = pctx.createImageData(pw, ph);
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const sp = (y + y0) * w + (x + x0), si = sp * 4, di = (y * pw + x) * 4;
        const l = label[sp];
        if (l && !mine.has(l)) continue; // 다른 칸의 그림은 빼기
        out.data[di] = d[si]; out.data[di + 1] = d[si + 1]; out.data[di + 2] = d[si + 2]; out.data[di + 3] = d[si + 3];
      }
    }
    pctx.putImageData(out, 0, 0);
    pieces.push(piece);
  }
  return pieces;
}

export function pieceToSticker(pieceCanvas, postprocess = true, size = 512) {
  // 시트 조각은 원래 300px 정도라 768로 키워 봐야 선명해지지 않음 → 512로 (처리 시간 절반 이하)
  return (postprocess ? dieCut(pieceCanvas, size) : fitSquare(pieceCanvas, size)).toDataURL('image/png');
}

/** 12장 → 샘플처럼 베이지 배경 스티커 시트 한 장 */
export async function composeSheet(urls, { cols = 3, cell = 360, gap = 24, bg = '#F4EEE5' } = {}) {
  const rows = Math.ceil(urls.length / cols);
  const c = makeCanvas(cols * cell + (cols + 1) * gap, rows * cell + (rows + 1) * gap);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  const imgs = await Promise.all(urls.map((u) => (u ? loadImage(u) : null)));
  imgs.forEach((im, i) => {
    if (!im) return;
    const x = gap + (i % cols) * (cell + gap), y = gap + Math.floor(i / cols) * (cell + gap);
    ctx.drawImage(im, x, y, cell, cell);
  });
  return c.toDataURL('image/png');
}

export function dataUrlToBlob(dataUrl) {
  const { mime, base64 } = dataUrlToRef(dataUrl);
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** 기준 캐릭터 참조용: 768px JPEG로 줄여 요청 크기를 줄임(원본 PNG는 수 MB) */
export async function toJpegRef(dataUrl, max = 768) {
  const img = await loadImage(dataUrl);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = makeCanvas(Math.round(img.width * s), Math.round(img.height * s));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return dataUrlToRef(c.toDataURL('image/jpeg', 0.88));
}

/**
 * 보내기용 크기 줄이기 (투명 배경 유지, PNG)
 * 한 번에 많이 줄이면 테두리가 거칠어져서 절반씩 단계적으로 줄임
 */
export async function resizeSticker(dataUrl, px) {
  const img = await loadImage(dataUrl);
  if (!px || px >= img.width) return dataUrl;
  let src = img, w = img.width;
  while (w / 2 >= px) {
    w = Math.round(w / 2);
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, w);
    src = c;
  }
  const out = makeCanvas(px, px);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, px, px);
  return out.toDataURL('image/png');
}
