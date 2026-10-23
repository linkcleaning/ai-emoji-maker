import { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';

const TITLES = {
  limit: (n) => `오늘 무료 ${n}팩을 다 썼어요`,
  ip_limit: () => '이 인터넷에서 오늘 무료 이용이 끝났어요',
  daily_cap: () => '오늘 준비된 이모티콘이 모두 나갔어요',
};

/** 무료 한도 도달 → 이용 코드 + 입금 안내 + 충전 확인 */
export default function LimitModal({ info, onClose, onRecheck }) {
  const [copied, setCopied] = useState('');
  const [checking, setChecking] = useState(false);
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500); } catch { /* 복사 불가 → 사용자가 직접 선택 */ }
  };
  const capped = info.reason === 'daily_cap';

  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/40 grid place-items-end sm:place-items-center" onClick={onClose}>
      <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-3xl p-5 max-h-[92dvh] overflow-y-auto overscroll-contain pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-display text-xl break-keep">{(TITLES[info.reason] || TITLES.limit)(info.freePerDay)}</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 shrink-0"><X size={22} /></button>
        </div>

        {capped ? (
          <p className="text-sm text-cocoa-600 leading-relaxed">하루에 만들 수 있는 전체 수량이 정해져 있어요. 내일 다시 이용해 주세요. 🙏</p>
        ) : (
          <>
            <p className="text-sm text-cocoa-600 leading-relaxed mb-4 break-keep">
              {info.reason === 'ip_limit'
                ? '같은 와이파이에서 여러 분이 이용해 오늘 무료분이 끝났어요. 추가 이용은 아래 방법으로 신청해 주세요.'
                : '더 만들고 싶으시면 아래 방법으로 신청해 주세요. 확인되는 대로 바로 풀어드려요.'}
            </p>

            <div className="rounded-2xl bg-cream-100 p-4 mb-3 text-center">
              <p className="text-xs font-bold text-cocoa-400 mb-1">내 이용 코드</p>
              <p className="font-mono text-3xl font-bold tracking-[0.25em] text-cocoa-800 select-all">{info.code}</p>
              <button onClick={() => copy(info.code, 'code')} className="mt-2 text-xs font-bold text-peach-600">
                {copied === 'code' ? '복사했어요 ✓' : '코드 복사'}
              </button>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-cream-300 p-4 mb-3">
              <p className="text-xs font-bold text-cocoa-400 mb-1">입금 안내</p>
              <p className="text-sm text-cocoa-800 whitespace-pre-wrap break-words select-all">{info.payInfo}</p>
              <button onClick={() => copy(info.payInfo, 'pay')} className="mt-2 text-xs font-bold text-peach-600">
                {copied === 'pay' ? '복사했어요 ✓' : '안내 복사'}
              </button>
            </div>

            <ol className="text-xs text-cocoa-600 space-y-1 list-decimal pl-5 mb-4 leading-relaxed">
              <li>위 안내대로 입금해 주세요.</li>
              <li><b>입금자명이나 문자·카톡으로 이용 코드({info.code})</b>를 알려주세요.</li>
              <li>충전되면 아래 <b>충전 확인</b>을 누르세요.</li>
            </ol>

            <button
              onClick={async () => { setChecking(true); await onRecheck(); setChecking(false); }}
              disabled={checking}
              className="btn-primary w-full"
            >
              <RefreshCw size={16} className={checking ? 'animate-spin' : ''} /> 충전 확인
            </button>
          </>
        )}
      </div>
    </div>
  );
}
