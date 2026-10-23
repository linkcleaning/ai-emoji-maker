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
export async function prepareUpload(file, max = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = makeCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
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
  const INF = 1e20, g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? 0 : INF;
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
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
  return dieCut(c).toDataURL('image/png');
}

/** 4행×3열 시트 → 12장 원본 조각(dataURL). 배경 제거 후 셀 단위로 자름 */
export async function sliceSheet(rawDataUrl, cols = 3, rows = 4) {
  const img = await loadImage(rawDataUrl);
  const full = imageToCanvas(img);
  removeBackground(full);
  const cw = full.width / cols, ch = full.height / rows;
  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pieces.push(imageToCanvas(full, c * cw, r * ch, cw, ch));
    }
  }
  return pieces;
}

export function pieceToSticker(pieceCanvas, postprocess = true) {
  return (postprocess ? dieCut(pieceCanvas) : fitSquare(pieceCanvas)).toDataURL('image/png');
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
