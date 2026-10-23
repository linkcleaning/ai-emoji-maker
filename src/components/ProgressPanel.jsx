import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const TIPS = [
  '캐릭터 얼굴을 먼저 디자인하고 있어요…',
  '첫 번째 스티커를 기준으로 나머지를 똑같이 맞춰요',
  '털 무늬, 헤어스타일을 꼼꼼히 옮기는 중',
  '흰 테두리를 오려 붙이는 중 ✂️',
  '조금만 기다려 주세요, 거의 다 왔어요!',
];

export default function ProgressPanel({ done, total, stage, onCancel, icons = ['😊'] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1600);
    return () => clearInterval(t);
  }, []);
  const pct = Math.round((done / total) * 100);
  const face = icons[tick % icons.length];

  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-cream-100 grid place-items-center text-3xl bob" aria-hidden>{face}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <p className="font-display text-lg">{stage}</p>
            <p className="text-sm font-bold text-peach-600 tabular-nums">{done}/{total}</p>
          </div>
          <p className="text-xs text-cocoa-400 truncate">{TIPS[tick % TIPS.length]}</p>
        </div>
      </div>
      <div className="mt-4 h-3 rounded-full bg-cream-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-peach-400 to-peach-500 transition-all duration-500"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <button onClick={onCancel} className="mt-3 text-xs text-cocoa-400 inline-flex items-center gap-1 hover:text-cocoa-600">
        <X size={13} /> 생성 중단
      </button>
    </div>
  );
}
