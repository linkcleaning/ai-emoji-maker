import { useEffect, useState } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted, onMuteChange } from '../lib/sound.js';
import SlotMachine from './SlotMachine.jsx';

const TIPS = [
  '릴이 돌아가는 중… 🎰',
  '캐릭터 얼굴을 디자인하는 중',
  '헤어스타일·털 무늬를 꼼꼼히 옮기는 중',
  '흰 테두리를 오려 붙이는 중 ✂️',
  '어떤 표정이 먼저 멈출까요?',
  '조금만 기다려 주세요!',
];

/** 만드는 동안: 슬롯머신 + 한마디 + 진행률. 한 장 완성될 때마다 릴이 하나씩 멈춤 */
export default function ProgressPanel({ total, stage, onCancel, icons = ['😊'], doneFlags = [], busy, onSettled }) {
  const [tick, setTick] = useState(0);
  const [n, setN] = useState(0);          // 멈춘 릴 수
  const [hitAt, setHitAt] = useState(0);  // 방금 멈춘 시각 (잠깐 '당첨!' 문구)
  const [muted, setM] = useState(isMuted());
  useEffect(() => onMuteChange(setM), []);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1100);
    return () => clearInterval(t);
  }, []);
  const onCount = (c) => { setN(c); if (c) setHitAt(Date.now()); };
  const fresh = Date.now() - hitAt < 1500;
  const pct = Math.round((n / total) * 100);

  let line;
  if (!busy && n >= doneFlags.filter(Boolean).length && n > 0) line = n === total ? 'JACKPOT! 🎉' : `${n}개 당첨!`;
  else if (n === total - 1) line = '마지막 하나.';
  else if (fresh && n > 0) line = `${n}번째 당첨!`;
  else if (n >= total - 3 && n > 0) line = '거의 다 왔어요…';
  else line = stage || '릴을 돌리는 중…';

  return (
    <div className="rounded-[28px] p-3.5 pb-3 relative bg-[#1A2030] shadow-sticker ring-1 ring-black/40">
      <SlotMachine icons={icons} doneFlags={doneFlags} busy={busy} onSettled={onSettled} onCount={onCount} />
      <p className="mt-4 text-center font-display text-[22px] leading-snug text-[#F7E2AE] break-keep" aria-live="polite">{line}</p>
      <p className="mt-0.5 text-center text-xs text-white/45 truncate">{busy ? TIPS[Math.floor(tick / 2) % TIPS.length] : '아래에서 완성된 이모티콘을 확인하세요'}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#B8862F] to-[#F7D88A] transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <span className="text-xs font-bold text-[#F7D88A] tabular-nums">{n}/{total}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        {busy ? (
          <button onClick={onCancel} className="text-xs text-white/45 inline-flex items-center gap-1 hover:text-white/70">
            <X size={13} /> 생성 중단
          </button>
        ) : <span />}
        <button
          onClick={() => setMuted(!muted)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-[#F7D88A] bg-white/5 ring-1 ring-[#B8862F]/60 active:scale-95"
          aria-pressed={!muted}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? '소리 꺼짐' : '소리 켜짐'}
        </button>
      </div>
    </div>
  );
}
