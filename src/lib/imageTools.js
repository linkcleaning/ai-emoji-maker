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
  const T1 = isGreenKey ? 90 : 38;   // 완전 제거 임계
  const T2 = isGreenKey ? 150 : 70;  // 반투명 경계 임계
  const dist = (i) => {
    const dr = d[i] - key[0], dg = d[i + 1] - key[1], db = d[i + 2] - key[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

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
      if (isGreenKey) { const m = Math.max(d[i], d[i + 2]); if (d[i + 1] > m) d[i + 1] = m; }
    }
  }
  // 팔·꼬리 사이처럼 테두리와 연결되지 않은 '갇힌 배경'도 제거 (크로마 그린일 때만, 확실한 초록만)
  if (isGreenKey) {
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const dd = dist(i);
      if (dd < T1 * 0.75) d[i + 3] = 0;
      else if (dd < T1 * 1.2 && d[i + 1] > d[i] + 60 && d[i + 1] > d[i + 2] + 60) {
        d[i + 3] = Math.min(d[i + 3], Math.round(((dd - T1 * 0.75) / (T1 * 0.45)) * 255));
      }
    }
  }
  // 경계 주변 1px 초록 번짐 추가 제거
  if (isGreenKey) {
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const m = Math.max(d[i], d[i + 2]);
      if (d[i + 1] > m + 20) d[i + 1] = m + 20;
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

/**
 * 다이컷 스티커: 실루엣을 원형으로 확장(흰 테두리) + 은은한 그림자, 정사각 투명 PNG로 정렬
 */
export function dieCut(srcCanvas, size = OUTPUT_SIZE) {
  const box = contentBox(srcCanvas);
  const border = Math.round(size * 0.028);           // 굵은 흰 테두리
  const shadowPad = Math.round(size * 0.035);
  const inner = size - 2 * (border + shadowPad);
  const scale = Math.min(inner / box.w, inner / box.h);
  const cw = Math.round(box.w * scale), ch = Math.round(box.h * scale);
  const ox = Math.round((size - cw) / 2), oy = Math.round((size - ch) / 2);

  // 1) 캐릭터만 배치
  const art = makeCanvas(size, size);
  const actx = art.getContext('2d');
  actx.imageSmoothingQuality = 'high';
  actx.drawImage(srcCanvas, box.x, box.y, box.w, box.h, ox, oy, cw, ch);

  // 2) 흰색 실루엣
  const sil = makeCanvas(size, size);
  const sctx = sil.getContext('2d');
  sctx.drawImage(art, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, size, size);

  // 3) 실루엣 팽창 → 테두리
  const sticker = makeCanvas(size, size);
  const tctx = sticker.getContext('2d');
  const steps = 32;
  for (const r of [border * 0.5, border]) {
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      tctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  // 테두리 가장자리 알파를 단단하게 (반투명 얼룩 제거)
  const td = tctx.getImageData(0, 0, size, size);
  for (let i = 3; i < td.data.length; i += 4) td.data[i] = td.data[i] > 90 ? 255 : Math.round(td.data[i] * 1.6);
  tctx.putImageData(td, 0, 0);
  tctx.drawImage(art, 0, 0);

  // 4) 그림자와 합성
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
