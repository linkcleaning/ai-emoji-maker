// ─────────────────────────────────────────────────────────────
// AI 이미지 생성 API (브라우저에서 사용자 키로 직접 호출)
// ─────────────────────────────────────────────────────────────
import { demoSticker, demoSheet } from './demo.js';

export const PROVIDERS = {
  server: {
    label: '무료 이용',
    models: [
      { id: 'gemini-3.1-flash-image', label: '나노바나나 2 (추천)' },
      { id: 'gemini-3.1-flash-lite-image', label: '나노바나나 2 라이트 (빠름)' },
    ],
    keyUrl: '',
    bgMode: 'chroma',
    noKey: true,
    serverOnly: true, // 서버(Cloudflare)에서 열었을 때만 보임
  },
  demo: {
    label: '데모 체험',
    models: [{ id: 'demo', label: '데모 (API 없이 미리보기)' }],
    keyUrl: '',
    bgMode: 'chroma',
    noKey: true,
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-3.1-flash-image', label: '나노바나나 2 (추천)' },
      { id: 'gemini-3.1-flash-lite-image', label: '나노바나나 2 라이트 (저렴·빠름)' },
      { id: 'gemini-3-pro-image', label: '나노바나나 프로 (고품질·비쌈)' },
    ],
    keyUrl: 'https://aistudio.google.com/apikey',
    bgMode: 'chroma',
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-image-1', label: 'gpt-image-1 (투명 배경 지원)' },
      { id: 'gpt-image-1-mini', label: 'gpt-image-1-mini (저렴)' },
    ],
    keyUrl: 'https://platform.openai.com/api-keys',
    bgMode: 'transparent',
  },
};

// ─────────────────────────────────────────────────────────────
// 오류 분류
//  - fatal: 다시 해도 소용없음 (결제 없음, 키 오류, 모델 없음) → 전체 즉시 중단
//  - retryable: 잠깐 몰림(429 분당 제한), 서버 바쁨(500/503), 네트워크 끊김, 이미지 미생성 → 자동 재시도
// ─────────────────────────────────────────────────────────────
function makeError(msg, extra) {
  return Object.assign(new Error(msg), { short: '생성 실패', fatal: false, retryable: false, ...extra });
}

function parseRetryDelay(json, res) {
  const info = json?.error?.details?.find((d) => String(d['@type'] || '').includes('RetryInfo'));
  const sec = parseFloat(String(info?.retryDelay || '').replace('s', ''));
  if (sec > 0) return Math.min(sec * 1000, 60000);
  const ra = parseFloat(res.headers.get('retry-after') || '');
  return ra > 0 ? Math.min(ra * 1000, 60000) : 0;
}

async function readError(res) {
  let raw = `HTTP ${res.status}`, json = null;
  try { json = await res.json(); raw = json?.error?.message || json?.message || raw; } catch { /* ignore */ }
  const low = raw.toLowerCase();
  const detail = raw;
  const retryAfter = parseRetryDelay(json, res);
  const billingHelp = { label: 'AI Studio에서 결제 연결하기', url: 'https://aistudio.google.com/usage' };

  if (res.status === 403 && raw === 'pack_token') {
    return makeError('이번 팩의 AI 사용 횟수를 다 썼거나 6시간이 지났어요. [새로 만들기]로 새 팩을 시작해 주세요.', { fatal: true, short: '팩 만료', detail, status: 403 });
  }
  if (res.status === 429) {
    // 무료 등급(할당량 0) 또는 결제 한도 초과 → 다시 해도 안 됨
    // ※ 분당 제한 메시지에도 'quota', 'billing details'라는 말이 들어가므로 그 단어만으로는 판단하지 않음
    if (/limit:\s*0\b/.test(low) || low.includes('free_tier') || low.includes('insufficient_quota') || low.includes('spending cap') || low.includes('prepayment')) {
      return makeError('이 API 키는 이미지 생성 할당량이 없어요. 결제(빌링)가 연결된 프로젝트의 키를 넣어주세요. (AI Studio → API 키에서 결제 등급이 "Tier 1" 이상인 키)', { fatal: true, short: '결제 필요', help: billingHelp, detail, status: 429 });
    }
    // 분당·일일 요청 제한 → 기다렸다가 자동 재시도
    const daily = low.includes('per day') || low.includes('perday') || low.includes('_day');
    if (daily) return makeError('오늘 쓸 수 있는 생성 횟수를 다 썼어요. 내일 다시 하거나 AI Studio에서 한도를 확인해 주세요.', { fatal: true, short: '일일 한도', help: billingHelp, detail, status: 429 });
    return makeError('요청이 잠깐 몰렸어요. 자동으로 다시 시도해요.', { retryable: true, short: '잠시 대기', retryAfter, detail, status: 429 });
  }
  if (res.status >= 500) {
    return makeError('AI 서버가 바빠요. 자동으로 다시 시도해요.', { retryable: true, short: '서버 바쁨', retryAfter, detail, status: res.status });
  }
  if (res.status === 401 || res.status === 403 || (res.status === 400 && (low.includes('api key') || low.includes('api_key')))) {
    return makeError('API 키가 올바르지 않거나 권한이 없어요. 설정에서 키를 다시 확인해 주세요.', { fatal: true, short: 'API 키 오류', detail, status: res.status });
  }
  if (res.status === 402 || low.includes('billing') || low.includes('payment')) {
    return makeError('이 모델은 결제(빌링)가 연결된 계정에서만 쓸 수 있어요.', { fatal: true, short: '결제 필요', help: billingHelp, detail, status: res.status });
  }
  if (res.status === 404 || low.includes('is not found') || low.includes('not supported') || low.includes('no longer available')) {
    return makeError('선택한 AI 모델을 쓸 수 없어요. 설정에서 다른 모델을 골라주세요.', { fatal: true, short: '모델 없음', detail, status: res.status });
  }
  if (res.status === 400 && (low.includes('image') && (low.includes('size') || low.includes('too large') || low.includes('invalid')))) {
    return makeError('사진을 처리하지 못했어요. 다른 사진(JPG/PNG)으로 해보세요.', { fatal: true, short: '사진 오류', detail, status: 400 });
  }
  return makeError('생성 중 오류가 났어요. [다시]를 눌러주세요.', { detail, status: res.status, retryable: res.status === 408 });
}

// 요청 1건에 시간 제한(기본 150초)을 걸고, 사용자의 '중단'도 함께 반영
async function fetchWithTimeout(url, opts, signal, ms = 150000) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (ctrl.signal.aborted) throw makeError('응답이 너무 오래 걸려요. 자동으로 다시 시도해요.', { retryable: true, short: '시간 초과' });
    // 네트워크 끊김(화면 꺼짐·앱 전환·와이파이 변경 등)
    throw makeError('인터넷 연결이 끊겼어요. 생성 중에는 화면을 켜두세요. 자동으로 다시 시도해요.', { retryable: true, short: '연결 끊김', detail: String(e?.message || e) });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Gemini 이미지 생성
 * @param refs [{mime, base64}] 참조 이미지(원본 사진, 기준 캐릭터)
 */
async function generateGemini({ apiKey, model, refs, prompt, aspect = '1:1', signal, server }) {
  // server: { token } → 우리 서버(/api/generate)를 거쳐 사장님 키로 호출
  const url = server ? '/api/generate' : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const authHeaders = server ? { 'x-pack-token': server.token, 'x-model': model } : { 'x-goog-api-key': apiKey };
  const parts = [
    ...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })),
    { text: prompt },
  ];
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
    }),
  }, signal);
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  const cand = data?.candidates?.[0];
  // Gemini 3 계열은 '생각 중' 초안 이미지(thought: true)를 먼저 보낼 수 있음 → 마지막 최종 이미지를 사용
  const imgs = (cand?.content?.parts || []).filter((p) => (p.inlineData || p.inline_data)?.data);
  const finals = imgs.filter((p) => !p.thought);
  const pick = (finals.length ? finals : imgs).at(-1);
  const inline = pick?.inlineData || pick?.inline_data;
  if (!inline?.data) {
    const reason = cand?.finishReason || data?.promptFeedback?.blockReason || 'NO_IMAGE';
    const safety = /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|IMAGE_OTHER/.test(reason) || !!data?.promptFeedback?.blockReason;
    if (safety) {
      throw makeError('AI 안전 필터에 걸려 이 표정을 그리지 못했어요. [다시]를 누르거나 다른 사진으로 해보세요. (아이 사진·유명인 사진은 막힐 수 있어요)', { short: '안전 필터', detail: reason, retryable: reason === 'IMAGE_OTHER' });
    }
    throw makeError('AI가 이미지를 보내지 않았어요. 자동으로 다시 시도해요.', { short: '생성 안 됨', detail: reason, retryable: true });
  }
  return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
}

function b64ToBlob(base64, mime) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** OpenAI gpt-image 편집 엔드포인트 (참조 이미지 + 투명 배경) */
async function generateOpenAI({ apiKey, model, refs, prompt, size = '1024x1024', quality = 'medium', signal }) {
  const fd = new FormData();
  fd.append('model', model);
  fd.append('prompt', prompt);
  fd.append('size', size);
  fd.append('quality', quality);
  fd.append('background', 'transparent');
  fd.append('output_format', 'png');
  fd.append('n', '1');
  refs.forEach((r, i) => {
    const ext = r.mime.includes('png') ? 'png' : r.mime.includes('webp') ? 'webp' : 'jpg';
    fd.append('image[]', b64ToBlob(r.base64, r.mime), `ref${i}.${ext}`);
  });
  const res = await fetchWithTimeout('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  }, signal, 180000);
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw makeError('AI가 이미지를 보내지 않았어요. 자동으로 다시 시도해요.', { short: '생성 안 됨', retryable: true });
  return `data:image/png;base64,${b64}`;
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/**
 * 통합 호출 + 자동 재시도
 * 일시적 오류(분당 제한·서버 바쁨·연결 끊김·이미지 미생성)는 최대 4번까지 간격을 늘려가며 다시 시도
 * onWait(sec, err): 재시도 대기 중 화면에 알릴 때 사용
 */
export async function generateImage(args) {
  const { signal, onWait } = args;
  const maxTries = 4;
  for (let attempt = 1; ; attempt++) {
    try {
      return await generateOnce(args);
    } catch (e) {
      if (e?.name === 'AbortError' || signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!e?.retryable || attempt >= maxTries) throw e;
      const base = [0, 4000, 10000, 20000][attempt] || 20000;
      const wait = Math.max(e.retryAfter || 0, base) + Math.random() * 1500;
      onWait?.(Math.round(wait / 1000), e);
      await sleep(wait, signal);
    }
  }
}

/** 통합 호출 1회 — shape: 'square' | 'sheet' */
async function generateOnce({ settings, refs, prompt, shape = 'square', signal, meta = {} }) {
  const p = settings.provider;
  if (p === 'demo') {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return shape === 'sheet' ? demoSheet(meta) : demoSticker(meta);
  }
  if (p === 'server') {
    if (!settings.packToken) throw makeError('[새로 만들기]로 새 팩을 시작해 주세요.', { fatal: true, short: '팩 없음' });
    return generateGemini({
      model: settings.serverModel || PROVIDERS.server.models[0].id, refs, prompt,
      aspect: shape === 'sheet' ? '3:4' : '1:1', signal, server: { token: settings.packToken },
    });
  }
  if (p === 'gemini') {
    if (!settings.geminiKey) throw makeError('설정에서 Gemini API 키를 입력해 주세요.', { fatal: true, short: '키 없음' });
    return generateGemini({
      apiKey: settings.geminiKey, model: settings.geminiModel, refs, prompt,
      aspect: shape === 'sheet' ? '3:4' : '1:1', signal,
    });
  }
  if (!settings.openaiKey) throw makeError('설정에서 OpenAI API 키를 입력해 주세요.', { fatal: true, short: '키 없음' });
  return generateOpenAI({
    apiKey: settings.openaiKey, model: settings.openaiModel, refs, prompt,
    size: shape === 'sheet' ? '1024x1536' : '1024x1024', quality: settings.openaiQuality, signal,
  });
}

/** 간단한 동시 실행 풀 */
export async function runPool(items, limit, worker, signal) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length && !signal?.aborted) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}
