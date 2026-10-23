import { AlertCircle, RotateCw, Loader2 } from 'lucide-react';

export default function Gallery({ stickers, onOpen, onRetry, busy }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {stickers.map((s, i) => (
        <div key={`${i}-${s.id}`} className="relative min-w-0">
          {s.status === 'done' ? (
            <button
              onClick={() => onOpen(i)}
              className="pop block w-full aspect-square rounded-2xl bg-white/50 hover:bg-white transition active:scale-95"
              style={{ animationDelay: `${(i % 3) * 60}ms` }}
              aria-label={`${s.label} 크게 보기`}
            >
              <img src={s.url} alt={s.label} className="w-full h-full object-contain" draggable={false} />
            </button>
          ) : s.status === 'error' ? (
            <div className="w-full aspect-square rounded-2xl bg-white border-2 border-dashed border-peach-300 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
              <div className="w-full min-w-0">
                <AlertCircle className="mx-auto text-peach-500 mb-1" size={20} />
                <p className="text-[11px] font-bold text-cocoa-600 break-words line-clamp-2 mb-1" title={s.detail || s.error}>{s.error || '실패'}</p>
                <button disabled={busy} onClick={() => onRetry(i)} className="text-[11px] font-bold text-peach-600 inline-flex items-center gap-0.5">
                  <RotateCw size={11} /> 다시
                </button>
              </div>
            </div>
          ) : (
            <div className={`w-full aspect-square rounded-2xl grid place-items-center ${s.status === 'loading' ? 'shimmer' : 'bg-white/40'}`}>
              {s.status === 'loading'
                ? <Loader2 className="animate-spin text-peach-400" size={22} />
                : <span className="text-2xl opacity-30">{s.icon}</span>}
            </div>
          )}
          <p className="mt-1 text-center text-[11px] font-bold text-cocoa-600 truncate">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
