import JSZip from 'jszip';
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

export async function downloadZip(stickers, filename = 'my-emoji-pack.zip', sheetUrl, originals) {
  const zip = new JSZip();
  const folder = zip.folder('stickers');
  stickers.forEach((s, i) => {
    if (s.url) folder.file(`${String(i + 1).padStart(2, '0')}_${s.id}.png`, dataUrlToBlob(s.url));
  });
  if (originals) {
    const big = zip.folder('original_768');
    originals.forEach((s, i) => { if (s.url) big.file(`${String(i + 1).padStart(2, '0')}_${s.id}.png`, dataUrlToBlob(s.url)); });
  }
  if (sheetUrl) zip.file('sticker-sheet.png', dataUrlToBlob(sheetUrl));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, filename);
}

/**
 * 공유: Web Share API(파일) → 모바일에서 카카오톡/인스타 등 공유 시트가 열림
 * 미지원 브라우저에서는 false 반환 → 호출부에서 다운로드로 대체
 */
export async function shareImages(items, text = '내 사진으로 만든 AI 이모티콘 🎨') {
  const files = items.map(({ url, name }) => new File([dataUrlToBlob(url)], name, { type: 'image/png' }));
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: 'AI 이모티콘', text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  return 'unsupported';
}
