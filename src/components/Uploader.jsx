import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw } from 'lucide-react';

export default function Uploader({ photo, onFile, disabled }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handle = (files) => {
    const f = files?.[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) handle(e.dataTransfer.files); }}
      className={`relative rounded-3xl border-2 border-dashed transition overflow-hidden ${
        drag ? 'border-peach-500 bg-peach-300/20' : 'border-cream-300 bg-cream-50'
      }`}
    >
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />

      {photo ? (
        <div className="flex items-center gap-4 p-4">
          <img src={photo.dataUrl} alt="업로드한 사진" className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-sticker" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm mb-1">사진 준비 완료!</p>
            <p className="text-xs text-cocoa-400 mb-3">얼굴이나 털 무늬가 잘 보일수록 닮게 나와요.</p>
            <button disabled={disabled} onClick={() => fileRef.current.click()} className="btn-ghost !py-2 !text-xs">
              <RefreshCw size={14} /> 다른 사진
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <div className="mx-auto mb-3 w-16 h-16 rounded-2xl bg-white shadow-sticker grid place-items-center text-3xl bob">📸</div>
          <p className="font-display text-lg mb-1">사진을 올려주세요</p>
          <p className="text-xs text-cocoa-400 mb-4">내 얼굴 · 우리 집 고양이 · 강아지 사진<br className="sm:hidden" /> (드래그 앤 드롭도 돼요)</p>
          <button disabled={disabled} onClick={() => fileRef.current.click()} className="btn-primary !px-6">
            <ImagePlus size={17} /> 사진 선택 · 촬영
          </button>
        </div>
      )}
    </div>
  );
}
