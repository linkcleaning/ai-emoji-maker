import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { listPacks, deletePack } from '../lib/vault.js';

const fmt = (ms) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 내 보관함: 휴대폰 안에 저장된 팩 목록 → 눌러서 다시 보내기 */
export default function VaultModal({ onClose, onOpen, currentId }) {
  const [packs, setPacks] = useState(null);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { listPacks().then(setPacks); }, []);

  const remove = async (id) => {
    await deletePack(id);
    setConfirm(null);
    setPacks((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/40 grid place-items-end sm:place-items-center" onClick={onClose}>
      <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-3xl p-4 max-h-[88dvh] overflow-y-auto overscroll-contain pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl">📁 내 보관함</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1"><X size={22} /></button>
        </div>
        <p className="text-xs text-cocoa-400 mb-3 break-keep">만든 이모티콘은 사진첩이 아니라 이 앱 안에 자동으로 보관돼요. 팩을 누르면 다시 카톡으로 보낼 수 있어요.</p>

        {packs === null ? (
          <p className="text-sm text-cocoa-400 py-6 text-center">불러오는 중…</p>
        ) : !packs.length ? (
          <p className="text-sm text-cocoa-400 py-8 text-center">아직 보관된 이모티콘이 없어요.<br />만들면 여기에 자동으로 모여요.</p>
        ) : (
          <ul className="space-y-2">
            {packs.map((p) => (
              <li key={p.id} className={`rounded-2xl border-2 p-2.5 ${p.id === currentId ? 'border-peach-400 bg-peach-300/10' : 'border-cream-200 bg-cream-50'}`}>
                <button onClick={() => onOpen(p)} className="w-full text-left">
                  <div className="grid grid-cols-6 gap-1">
                    {p.stickers.slice(0, 12).map((s) => (
                      <img key={s.id} src={s.url} alt={s.label} className="w-full aspect-square object-contain" loading="lazy" draggable={false} />
                    ))}
                  </div>
                </button>
                <div className="flex items-center gap-2 mt-1.5 text-xs">
                  <span className="flex-1 min-w-0 truncate text-cocoa-600"><b>{p.title || '내 이모티콘'}</b> · {p.stickers.length}장 · {fmt(p.createdAt)}</span>
                  {confirm === p.id ? (
                    <>
                      <button onClick={() => remove(p.id)} className="font-bold text-peach-600">지우기</button>
                      <button onClick={() => setConfirm(null)} className="text-cocoa-400">취소</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirm(p.id)} className="text-cocoa-400 p-1" aria-label="이 팩 지우기"><Trash2 size={15} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-cocoa-400 mt-3 text-center break-keep">이 휴대폰에만 저장돼요. 앱을 지우거나 사파리 기록을 지우면 함께 지워져요.</p>
      </div>
    </div>
  );
}
