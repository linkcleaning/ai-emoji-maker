// ─────────────────────────────────────────────────────────────
// 아주 작은 움직이는 GIF 만들기 (외부 라이브러리 없이)
//  - 모든 프레임에서 색 255개를 골라(미디언 컷) 공용 팔레트로 사용, 1색은 투명
//  - 투명 배경 유지: 카톡 채팅방 배경 위에 스티커만 보임
// ─────────────────────────────────────────────────────────────

const TRANSPARENT = 255;

/** 5비트(32×32×32) 색 상자에서 미디언 컷으로 최대 255색 팔레트 */
function buildPalette(frames, alphaMin) {
  const hist = new Uint32Array(32768);
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < alphaMin) continue;
      hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
    }
  }
  const colors = [];
  for (let k = 0; k < 32768; k++) if (hist[k]) colors.push(k);
  if (!colors.length) return [[255, 255, 255]];
  const ch = (k, c) => (c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31);
  let boxes = [colors];
  while (boxes.length < 255) {
    // 가장 넓게 퍼진(픽셀 많은) 상자를 반으로
    let bi = -1, best = -1, bc = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 31, hi = 0, n = 0;
        for (const k of b) { const v = ch(k, c); if (v < lo) lo = v; if (v > hi) hi = v; n += hist[k]; }
        const score = (hi - lo) * Math.sqrt(n);
        if (score > best) { best = score; bi = i; bc = c; }
      }
    });
    if (bi < 0 || best <= 0) break;
    const b = boxes[bi].sort((x, y) => ch(x, bc) - ch(y, bc));
    let total = 0; for (const k of b) total += hist[k];
    let acc = 0, cut = 1;
    for (let i = 0; i < b.length - 1; i++) { acc += hist[b[i]]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  return boxes.map((b) => {
    let r = 0, g = 0, bl = 0, n = 0;
    for (const k of b) { const w = hist[k]; r += (k >> 10) * w; g += ((k >> 5) & 31) * w; bl += (k & 31) * w; n += w; }
    return [Math.round((r / n) * 8.22), Math.round((g / n) * 8.22), Math.round((bl / n) * 8.22)];
  });
}

function nearestMap(palette) {
  const cache = new Int16Array(32768).fill(-1);
  return (k) => {
    let v = cache[k];
    if (v >= 0) return v;
    const r = (k >> 10) * 8.22, g = ((k >> 5) & 31) * 8.22, b = (k & 31) * 8.22;
    let best = 1e9;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i], d = (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2;
      if (d < best) { best = d; v = i; }
    }
    cache[k] = v;
    return v;
  };
}

/** LZW 압축 (GIF 규격) */
function lzw(indices, minCode, out) {
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1, dict = new Map();
  let buf = 0, bits = 0;
  const bytes = [];
  const emit = (code) => {
    buf |= code << bits; bits += size;
    while (bits >= 8) { bytes.push(buf & 255); buf >>>= 8; bits -= 8; }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << size) && size < 12) size++;
    } else {
      emit(clear); dict = new Map(); size = minCode + 1; next = eoi + 1;
    }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) bytes.push(buf & 255);
  out.push(minCode);
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
}

/**
 * frames: ImageData[] (같은 크기), delayMs: 프레임 간격
 * @returns Uint8Array (GIF 파일)
 */
export function encodeGif(frames, delayMs = 70, alphaMin = 110) {
  const w = frames[0].width, h = frames[0].height;
  const palette = buildPalette(frames, alphaMin);
  const near = nearestMap(palette);
  const out = [];
  const str = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
  const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
  // 머리말 + 화면 정보 + 팔레트(256칸)
  str('GIF89a'); u16(w); u16(h); out.push(0xf7, TRANSPARENT, 0);
  for (let i = 0; i < 256; i++) { const p = palette[i] || [255, 255, 255]; out.push(p[0], p[1], p[2]); }
  // 무한 반복
  out.push(0x21, 0xff, 11); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0);
  const delay = Math.max(2, Math.round(delayMs / 10));
  for (const f of frames) {
    out.push(0x21, 0xf9, 4, 0b00001001, delay & 255, delay >> 8, TRANSPARENT, 0); // 지우고 다음 장(투명)
    out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0);
    const d = f.data, idx = new Uint8Array(w * h);
    for (let p = 0, i = 0; p < idx.length; p++, i += 4) {
      idx[p] = d[i + 3] < alphaMin ? TRANSPARENT : near(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
    }
    lzw(idx, 8, out);
  }
  out.push(0x3b);
  return new Uint8Array(out);
}
