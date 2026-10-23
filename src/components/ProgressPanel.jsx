import { useEffect, useRef, useState } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted, onMuteChange } from '../lib/sound.js';
import LottoMachine from './LottoMachine.jsx';

const TIPS = [
  '표정 공을 섞고 있어요… 🎱',
  '캐릭터 얼굴을 디자인하는 중',
  '헤어스타일·털 무늬를 꼼꼼히 옮기는 중',
  '흰 테두리를 오려 붙이는 중 ✂️',
  '어떤 표정이 먼저 뽑힐까요?',
  '조금만 기다려 주세요, 거의 다 왔어요!',
];

/** 만드는 동안: 로또 추첨기 + 진행률. 한 장 완성될 때마다 공이 하나씩 뽑혀 나옴 */
export default function ProgressPanel({ done, total, stage, onCancel, icons = ['😊'], doneFlags = [], busy, onSettled }) {
  const [tick, setTick] = useState(0);
  const [ding, setDing] = useState(false);
  const prev = useRef(done);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 2200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (done > prev.current) {
      setDing(true);
      const t = setTimeout(() => setDing(false), 900);
      prev.current = done;
      return () => clearTimeout(t);
    }
    prev.current = done;
  }, [done]);
  const [muted, setM] = useState(isMuted());
  useEffect(() => onMuteChange(setM), []);
  const pct = Math.round((done / total) * 100);

  return (
    <div className="card p-4 relative">
      <button
        onClick={() => setMuted(!muted)}
        className="absolute top-3 left-3 z-10 grid place-items-center w-9 h-9 rounded-full bg-cream-100 text-cocoa-600 active:scale-95"
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
      <LottoMachine icons={icons} doneFlags={doneFlags} busy={busy} onSettled={onSettled} />
      <div className="flex items-baseline justify-between gap-2 mt-2 mb-0.5">
        <p className="font-display text-base min-[400px]:text-lg leading-snug break-keep">
          {!busy ? '추첨 완료! 🎉' : ding ? `딩! ${done}번째 표정 뽑혔어요 🎉` : stage}
        </p>
        <p className="text-sm font-bold text-peach-600 tabular-nums shrink-0">{done}/{total}</p>
      </div>
      <p className="text-xs text-cocoa-400 truncate">{busy ? TIPS[tick % TIPS.length] : '아래에서 완성된 이모티콘을 확인하세요'}</p>
      <div className="mt-3 h-3 rounded-full bg-cream-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-peach-400 to-peach-500 transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      {busy && (
        <button onClick={onCancel} className="mt-2.5 text-xs text-cocoa-400 inline-flex items-center gap-1 hover:text-cocoa-600">
          <X size={13} /> 생성 중단
        </button>
      )}
    </div>
  );
}
