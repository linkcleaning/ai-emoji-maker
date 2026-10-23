import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import SlotReel from './SlotReel.jsx';

const TIPS = [
  '캐릭터 얼굴을 먼저 디자인하고 있어요…',
  '첫 장을 기준으로 나머지 표정을 똑같이 맞춰요',
  '헤어스타일·털 무늬를 꼼꼼히 옮기는 중',
  '흰 테두리를 오려 붙이는 중 ✂️',
  '어떤 표정이 먼저 나올까요? 🎰',
  '조금만 기다려 주세요, 거의 다 왔어요!',
];

/** 만드는 동안: 3줄 슬롯머신 + 진행률. 한 장씩 나올 때마다 '딩!' */
export default function ProgressPanel({ done, total, stage, onCancel, icons = ['😊'] }) {
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
  const pct = Math.round((done / total) * 100);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {/* 슬롯머신 */}
        <div className={`relative shrink-0 rounded-2xl bg-cocoa-800 p-1.5 pr-4 shadow-sticker transition ${ding ? 'jackpot' : ''}`}>
          <div className="flex gap-1">
            {[0, 1, 2].map((k) => (
              <SlotReel key={k} icons={icons} seed={k + 20} speed={0.45 + k * 0.15} className="slot-window w-10 h-10 rounded-lg bg-white" itemClass="text-2xl" />
            ))}
          </div>
          {/* 손잡이 */}
          <div className="lever absolute -right-1 top-1 flex flex-col items-center" aria-hidden>
            <span className="w-3 h-3 rounded-full bg-peach-500" />
            <span className="w-1 h-7 rounded-full bg-cocoa-400" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <p className="font-display text-base min-[400px]:text-lg leading-snug break-keep">{ding ? `딩! ${done}장 완성 🎉` : stage}</p>
            <p className="text-sm font-bold text-peach-600 tabular-nums shrink-0">{done}/{total}</p>
          </div>
          <p className="text-xs text-cocoa-400 truncate">{TIPS[tick % TIPS.length]}</p>
        </div>
      </div>
      <div className="mt-3 h-3 rounded-full bg-cream-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-peach-400 to-peach-500 transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <button onClick={onCancel} className="mt-2.5 text-xs text-cocoa-400 inline-flex items-center gap-1 hover:text-cocoa-600">
        <X size={13} /> 생성 중단
      </button>
    </div>
  );
}
