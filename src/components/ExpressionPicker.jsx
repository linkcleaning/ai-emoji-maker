import { useState } from 'react';
import { X, RotateCw } from 'lucide-react';
import { LIBRARY_GROUPS, PACKS, packSet, customExpression, matchPack } from '../lib/expressions.js';

// 기본 12표정은 실제 예시 그림이 있음 (스타일별)
const SAMPLE_IDS = new Set(['hello', 'love', 'fighting', 'panic', 'angry', 'sad', 'tired', 'question', 'party', 'sleep', 'cool', 'ok']);

/** 표정 미리보기 한 칸: 예시 그림(있으면) 또는 아이콘 + 이름 */
export function ExpressionThumb({ item, style = '3d', small = false }) {
  const hasSample = SAMPLE_IDS.has(item.id);
  return (
    <span className="block min-w-0">
      <span className={`grid place-items-center aspect-square rounded-xl bg-white ${small ? '' : 'border border-cream-200'} overflow-hidden`}>
        {hasSample
          ? <img src={`./samples/${style}/${item.id}.webp`} alt="" loading="lazy" className="w-full h-full object-contain p-0.5" draggable={false} />
          : <span className={small ? 'text-lg' : 'text-[22px]'} aria-hidden>{item.icon}</span>}
      </span>
      <span className="block mt-0.5 text-[9.5px] leading-tight font-bold text-cocoa-600 truncate text-center">{item.label.split('/')[0]}</span>
    </span>
  );
}

/** 옵션 카드 안: 테마 팩 고르기 + '표정 바꾸기' 버튼 + 12칸 미리보기 */
export function ExpressionBar({ set, onChange, onOpen, disabled, style = '3d' }) {
  const current = matchPack(set);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label !mb-0">표정 구성</span>
        <button disabled={disabled} onClick={onOpen} className="text-xs font-bold text-peach-600 disabled:opacity-40">
          표정 바꾸기 ›
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PACKS.map((p) => (
          <button
            key={p.id}
            disabled={disabled}
            onClick={() => onChange(packSet(p.id))}
            aria-pressed={current === p.id}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
              current === p.id ? 'bg-peach-500 border-peach-500 text-white' : 'bg-cream-50 border-cream-200 text-cocoa-600'
            }`}
          >
            {p.emoji} {p.label}
          </button>
        ))}
        {!current && (
          <span className="rounded-full px-3 py-1.5 text-xs font-bold bg-peach-500 text-white">✏️ 내 구성</span>
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="mt-2.5 w-full grid grid-cols-6 gap-1.5 rounded-2xl bg-cream-50 p-2 text-left disabled:opacity-60"
        aria-label="표정 12개 미리보기 — 눌러서 바꾸기"
      >
        {set.map((x, i) => <ExpressionThumb key={`${i}-${x.id}`} item={x} style={style} small />)}
      </button>
    </div>
  );
}

/** 12칸 표정 편집 창 */
export default function ExpressionPicker({ set, onSave, onClose, style = '3d' }) {
  const [draft, setDraft] = useState(set);
  const [slot, setSlot] = useState(0);
  const [tab, setTab] = useState(LIBRARY_GROUPS[0].id);
  const [custom, setCustom] = useState('');

  const assign = (item) => {
    setDraft((d) => d.map((x, i) => (i === slot ? item : x)));
    setSlot((s) => (s + 1) % 12); // 다음 칸으로 자동 이동
  };
  const addCustom = () => {
    if (!custom.trim()) return;
    assign(customExpression(custom));
    setCustom('');
  };
  const used = new Set(draft.map((x) => x.id));
  const group = LIBRARY_GROUPS.find((g) => g.id === tab);

  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/40 grid place-items-end sm:place-items-center" onClick={onClose}>
      <div
        className="card w-full sm:max-w-md rounded-b-none sm:rounded-3xl p-4 max-h-[92dvh] overflow-y-auto overscroll-contain pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl">표정 고르기</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1"><X size={22} /></button>
        </div>
        <p className="text-xs text-cocoa-400 mb-3">바꿀 칸을 누르고, 아래에서 표정을 고르세요.</p>

        {/* 12칸 */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {draft.map((x, i) => (
            <button
              key={i}
              onClick={() => setSlot(i)}
              aria-pressed={slot === i}
              className={`min-w-0 rounded-xl p-1 text-center border-2 transition ${
                slot === i ? 'border-peach-500 bg-peach-300/20' : 'border-cream-200 bg-cream-50'
              }`}
            >
              <ExpressionThumb item={x} style={style} small />
            </button>
          ))}
        </div>

        {/* 라이브러리 탭 */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
          {LIBRARY_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setTab(g.id)}
              aria-pressed={tab === g.id}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${tab === g.id ? 'bg-cocoa-800 text-white' : 'bg-cream-100 text-cocoa-600'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {group.items.map((item) => (
            <button
              key={item.id}
              onClick={() => assign(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition active:scale-95 ${
                used.has(item.id) ? 'bg-cream-100 border-cream-200 text-cocoa-400' : 'bg-white border-cream-300 text-cocoa-800'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* 직접 입력 */}
        <label className="label" htmlFor="custom-exp">직접 입력 ({slot + 1}번 칸에 넣기)</label>
        <div className="flex gap-2 mb-4">
          <input
            id="custom-exp"
            className="input flex-1"
            placeholder="예: 월급날 신남, 다이어트 실패, 청소 끝!"
            maxLength={40}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
          />
          <button onClick={addCustom} disabled={!custom.trim()} className="btn-ghost shrink-0 !px-4">넣기</button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setDraft(packSet('basic'))} className="btn-ghost"><RotateCw size={15} /> 기본으로</button>
          <button onClick={() => onSave(draft)} className="btn-primary flex-1">이 구성으로 하기</button>
        </div>
      </div>
    </div>
  );
}
