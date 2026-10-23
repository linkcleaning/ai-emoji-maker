import { useMemo } from 'react';

/**
 * 슬롯머신 릴: 이모지들이 위로 계속 돌아감
 * icons: 돌릴 이모지 목록 / speed: 한 바퀴 시간(초) / seed: 칸마다 다른 순서
 */
export default function SlotReel({ icons, speed = 0.9, seed = 0, className = '', itemClass = 'text-4xl' }) {
  const list = useMemo(() => {
    const base = icons.length ? icons : ['😊'];
    // 칸마다 섞인 순서 (seed 기반이라 다시 그려도 순서 유지)
    const arr = base.map((x, i) => [x, (Math.sin((i + 1) * (seed + 3) * 12.9898) * 43758.5453) % 1]);
    arr.sort((a, b) => a[1] - b[1]);
    const one = arr.map((a) => a[0]);
    return [...one, ...one]; // 두 번 이어 붙여 끊김 없이 반복
  }, [icons, seed]);

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      <div className="reel" style={{ '--spd': `${speed}s` }}>
        {list.map((ic, i) => (
          <div key={i} className={`aspect-square grid place-items-center ${itemClass}`}>{ic}</div>
        ))}
      </div>
      {/* 위아래 흐림 → 돌아가는 느낌 */}
      <div className="pointer-events-none absolute inset-0 reel-fade" />
    </div>
  );
}
