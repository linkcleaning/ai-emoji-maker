import { X, Download, Share2, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StickerModal({ sticker, index, total, onClose, onNav, onSave, onShare, onRegenerate, busy }) {
  if (!sticker) return null;
  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/50 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5 pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-cocoa-400">{index + 1} / {total}</span>
          <button onClick={onClose} aria-label="닫기" className="p-1"><X size={22} /></button>
        </div>

        <div className="relative">
          <div className="checker rounded-2xl aspect-square">
            <img src={sticker.url} alt={sticker.label} className="w-full h-full object-contain" />
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
          <p className="text-xs text-cocoa-400">{sticker.label}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={onSave} className="btn-primary !px-2"><Download size={16} /> 저장</button>
          <button onClick={onShare} className="btn-ghost !px-2"><Share2 size={16} /> 공유</button>
          <button onClick={onRegenerate} disabled={busy} className="btn-ghost !px-2"><RotateCw size={16} /> 다시</button>
        </div>
      </div>
    </div>
  );
}
