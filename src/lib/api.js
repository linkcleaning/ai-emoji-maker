// ─────────────────────────────────────────────────────────────
// AI 이미지 생성 API (브라우저에서 사용자 키로 직접 호출)
// ─────────────────────────────────────────────────────────────
import { demoSticker, demoSheet } from './demo.js';

export const PROVIDERS = {
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
      { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2 · gemini-3.1-flash-image (추천)' },
      { id: 'gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite (저렴·빠름)' },
      { id: 'gemini-3-pro-image', label: 'Nano Banana Pro · gemini-3-pro-image (고품질·비쌈)' },
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

// 사용자에게 보여줄 짧은 오류 + 더 시도해도 소용없는 오류(fatal) 구분
async function readError(res) {
  let raw = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    raw = j?.error?.message || j?.message || raw;
  } catch { /* ignore */ }
  const low = raw.toLowerCase();
  let msg = raw, short = '생성 실패', fatal = false, help = null;
  if (res.status === 429 && (low.includes('quota') || low.includes('billing') || low.includes('limit: 0'))) {
    fatal = true; short = '할당량 없음';
    msg = 'Gemini 이미지 생성은 무료로 쓸 수 없어요. Google AI Studio에서 결제(빌링)를 연결해야 해요.';
    help = { label: 'AI Studio에서 결제 연결하기', url: 'https://aistudio.google.com/usage' };
  } else if (res.status === 429) {
    short = '잠시 후 다시'; msg = '요청이 너무 몰렸어요. 잠시 후 [다시]를 눌러주세요.';
  } else if (res.status === 401 || res.status === 403 || (res.status === 400 && low.includes('api key'))) {
    fatal = true; short = 'API 키 오류';
    msg = 'API 키가 올바르지 않거나 권한이 없어요. 설정에서 키를 다시 확인해 주세요.';
  } else if (res.status === 404 || low.includes('not found') || low.includes('no longer available') || low.includes('deprecated')) {
    fatal = true; short = '모델 없음';
    msg = '선택한 AI 모델을 쓸 수 없어요. 설정에서 다른 모델을 골라주세요.';
  } else if (low.includes('billing') || low.includes('payment')) {
    fatal = true; short = '결제 필요';
    msg = '이 모델은 결제(빌링)가 연결된 계정에서만 쓸 수 있어요.';
    help = { label: '결제 연결하기', url: 'https://aistudio.google.com/usage' };
  }
  if (res.status === 401 && raw.includes('platform.openai')) help = null;
  const err = new Error(msg);
  Object.assign(err, { short, fatal, help, detail: raw, status: res.status });
  return err;
}

/**
 * Gemini 이미지 생성
 * @param refs [{mime, base64}] 참조 이미지(원본 사진, 기준 캐릭터)
 */
async function generateGemini({ apiKey, model, refs, prompt, aspect = '1:1', signal }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const parts = [
    ...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })),
    { text: prompt },
  ];
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
    }),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  const cand = data?.candidates?.[0];
  const img = cand?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const inline = img?.inlineData || img?.inline_data;
  if (!inline?.data) {
    const reason = cand?.finishReason || data?.promptFeedback?.blockReason || '알 수 없음';
    const e = new Error(`이미지가 만들어지지 않았어요 (사유: ${reason}). [다시]를 누르거나 다른 사진으로 해보세요.`);
    e.short = reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT' ? '안전 필터' : '생성 안 됨';
    throw e;
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
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('이미지가 생성되지 않았어요. 다시 시도해 주세요.');
  return `data:image/png;base64,${b64}`;
}

/** 통합 호출 — shape: 'square' | 'sheet' */
export async function generateImage({ settings, refs, prompt, shape = 'square', signal, meta = {} }) {
  const p = settings.provider;
  if (p === 'demo') {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return shape === 'sheet' ? demoSheet(meta) : demoSticker(meta);
  }
  if (p === 'gemini') {
    if (!settings.geminiKey) throw new Error('설정에서 Gemini API 키를 입력해 주세요.');
    return generateGemini({
      apiKey: settings.geminiKey, model: settings.geminiModel, refs, prompt,
      aspect: shape === 'sheet' ? '3:4' : '1:1', signal,
    });
  }
  if (!settings.openaiKey) throw new Error('설정에서 OpenAI API 키를 입력해 주세요.');
  return generateOpenAI({
    apiKey: settings.openaiKey, model: settings.openaiModel, refs, prompt,
    size: shape === 'sheet' ? '1024x1536' : '1024x1024', quality: settings.openaiQuality, signal,
  });
}

/** 간단한 동시 실행 풀 */
export async function runPool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}
