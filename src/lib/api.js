// ─────────────────────────────────────────────────────────────
// AI 이미지 생성 API (브라우저에서 사용자 키로 직접 호출)
// ─────────────────────────────────────────────────────────────

export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (나노바나나 · 추천)' },
      { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (나노바나나 Pro · 고품질)' },
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

async function readError(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    msg = j?.error?.message || j?.message || msg;
  } catch { /* ignore */ }
  if (res.status === 401 || res.status === 403) msg = `API 키가 올바르지 않거나 권한이 없어요. (${msg})`;
  if (res.status === 429) msg = `요청 한도를 초과했어요. 잠시 후 다시 시도해 주세요. (${msg})`;
  return new Error(msg);
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
    throw new Error(`이미지가 생성되지 않았어요 (사유: ${reason}). 다른 사진으로 시도하거나 다시 생성해 보세요.`);
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
export async function generateImage({ settings, refs, prompt, shape = 'square', signal }) {
  const p = settings.provider;
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
