import { AlertCircle, RotateCw } from 'lucide-react';

const BALL_COLORS = ['#FFC93C', '#FF7F66', '#6FB6F2', '#8BD17C', '#B98AF0', '#FF9EC4', '#FFB347', '#5ED3C4', '#F26D6D', '#7FA7FF', '#C5D86D', '#E0A96D'];

export default function Gallery({ stickers, onOpen, onRetry, busy, display = (s) => s.url }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {stickers.map((s, i) => (
        <div key={`${i}-${s.id}`} className="relative min-w-0">
          {s.status === 'done' ? (
            <button
              onClick={() => onOpen(i)}
              className="jackpot block w-full aspect-square rounded-2xl bg-white/50 hover:bg-white transition active:scale-95"
              aria-label={`${s.label} 크게 보기`}
            >
              <img src={display(s)} alt={s.label} className="w-full h-full object-contain" draggable={false} />
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
            s.status === 'loading' ? (
              // 만드는 중: 추첨 공이 굴러다님
              <div className="w-full aspect-square rounded-2xl bg-cream-50 ring-2 ring-peach-300/50 grid place-items-center overflow-hidden">
                <span className="lotto-ball" style={{ '--c': BALL_COLORS[i % BALL_COLORS.length], animationDelay: `${(i % 5) * -0.37}s` }}>
                  <span>{s.icon}</span>
                </span>
              </div>
            ) : (
              <div className="w-full aspect-square rounded-2xl grid place-items-center bg-white/40">
                <span className="text-2xl opacity-30">{s.icon}</span>
              </div>
            )
          )}
          <p className="mt-1 text-center text-[11px] font-bold text-cocoa-600 truncate">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
