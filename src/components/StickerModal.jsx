import { useState } from 'react';
import { X, Download, Share2, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StickerModal({ sticker, index, total, onClose, onNav, onSave, onShare, onRegenerate, busy, allowRaw = true, displayUrl = null, motion = null }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!sticker) return null;
  const raw = showRaw && sticker.raw;
  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/50 grid place-items-center p-4 overflow-y-auto overscroll-contain" onClick={onClose}>
      <div className="card w-full max-w-sm p-4 sm:p-5 pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-cocoa-400">{index + 1} / {total}</span>
          <button onClick={onClose} aria-label="닫기" className="p-1"><X size={22} /></button>
        </div>

        <div className="relative">
          <div className="checker rounded-2xl aspect-square">
            <img src={raw || displayUrl || sticker.url} alt={sticker.label} className="w-full h-full object-contain" />
          </div>
          <button onClick={() => onNav(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow grid place-items-center" aria-label="이전">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => onNav(1)} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow grid place-items-center" aria-label="다음">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="text-center my-4">
          <p className="font-display text-2xl">{sticker.icon} {sticker.text}</p>
          <p className="text-xs text-cocoa-400">{sticker.label}{motion ? ` · 🎬 ${motion}` : ''}</p>
          {allowRaw && sticker.raw && (
            <button onClick={() => setShowRaw((v) => !v)} className="mt-1 text-[11px] text-cocoa-400 underline underline-offset-2">
              {showRaw ? '완성본 보기' : 'AI 원본 보기'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={onShare} className="btn-primary"><Share2 size={16} /> 카톡으로 보내기</button>
          <button onClick={onRegenerate} disabled={busy} className="btn-ghost !px-4"><RotateCw size={16} /> 다시</button>
        </div>
        <p className="mt-2.5 text-center text-[11px] text-cocoa-400">
          앱 보관함에 자동 저장돼요 ·{' '}
          <button onClick={onSave} className="underline underline-offset-2 inline-flex items-center gap-0.5"><Download size={11} /> 사진첩에도 저장</button>
        </p>
      </div>
    </div>
  );
}
