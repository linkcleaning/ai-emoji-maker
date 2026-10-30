import { dataUrlToBlob } from './imageTools.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadDataUrl(dataUrl, filename) {
  downloadBlob(dataUrlToBlob(dataUrl), filename);
}

export const safeName = (s) => String(s).replace(/^custom:/, '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

/**
 * 공유: Web Share API(파일) → 모바일에서 카카오톡/인스타 등 공유 시트가 열림
 * 미지원 브라우저에서는 false 반환 → 호출부에서 다운로드로 대체
 */
export async function shareImages(items) {
  const files = items.map(({ url, name }) => { const b = dataUrlToBlob(url); return new File([b], name, { type: b.type || 'image/png' }); });
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files }); // 이미지만 보냄(문구 말풍선 없이)
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  return 'unsupported';
}
