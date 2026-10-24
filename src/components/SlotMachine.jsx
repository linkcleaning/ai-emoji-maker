import { useEffect, useMemo, useRef, useState } from 'react';
import * as sfx from '../lib/sound.js';

/**
 * LUCKY 12 JACKPOT 슬롯머신
 *  - 금테 + 빨간 판 + 위아래 전구, 검은 창 안에 12칸 릴(4×3)
 *  - 아직 안 나온 칸은 표정 공이 흐릿하게 빙글빙글 돌아감
 *  - 스티커가 하나 완성될 때마다 그 칸 릴이 '탁' 멈추며 공이 떨어지고, 금테로 반짝 + '딩'
 *  - 12칸이 다 멈추면 전구가 한꺼번에 깜빡 + 팡파레 → onSettled()
 */
const COLORS = ['#F5B82E', '#3F8FE0', '#E8473E', '#4CB86B', '#9B6BE0', '#F27AAE', '#F28C28', '#2FB8A8', '#D94B4B', '#5B7FE8', '#9CBF3B', '#C98A4B'];

export default function SlotMachine({ icons, doneFlags, busy, onSettled, onCount }) {
  const total = icons.length;
  const key = icons.join('|');
  const [shown, setShown] = useState([]);       // 멈춘 칸(나온 순서)
  const st = useRef({ queue: [], seen: new Set(), last: 0, settled: false, cheered: false });
  const cbs = useRef({ onSettled, onCount });
  cbs.current = { onSettled, onCount };

  // 팩이 바뀌면 처음부터
  useEffect(() => { st.current = { queue: [], seen: new Set(), last: 0, settled: false, cheered: false, shown: [] }; setShown([]); cbs.current.onCount?.(0); }, [key]);

  // 새로 완성된 스티커 → 멈출 차례 대기열
  useEffect(() => {
    const s = st.current;
    doneFlags.forEach((d, i) => { if (d && !s.seen.has(i)) { s.seen.add(i); s.queue.push(i); } });
  }, [doneFlags]);

  const doneCount = doneFlags.filter(Boolean).length;
  // 아직 안 멈춘 칸 = 만드는 중이거나, 완성됐지만 멈출 차례를 기다리는 칸
  const spinning = icons.filter((_, i) => !shown.includes(i) && (busy || doneFlags[i])).length;

  // 한 칸씩 멈추기 (기다리는 칸이 많으면 빠르게: 시트 방식은 12개가 한꺼번에 완성됨)
  useEffect(() => {
    const id = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      if (s.queue.length && now - s.last >= (s.queue.length > 2 ? 170 : 450)) {
        const i = s.queue.shift();
        s.last = now;
        s.shown = [...(s.shown || []), i];
        setShown(s.shown);
        sfx.ding(s.shown.length - 1);
        cbs.current.onCount?.(s.shown.length);
      }
    }, 60);
    return () => clearInterval(id);
  }, []);

  // 돌아가는 소리: 릴이 도는 동안 따다닥
  useEffect(() => {
    if (!spinning) return undefined;
    const id = setInterval(() => sfx.tick(0.014), 105);
    return () => clearInterval(id);
  }, [spinning > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // 다 멈췄으면 잭팟 → 잠시 뒤 닫기
  const allIn = !busy && !st.current.queue.length && shown.length === doneCount;
  useEffect(() => {
    if (!allIn || st.current.settled) return undefined;
    const s = st.current;
    if (!s.cheered && shown.length) { s.cheered = true; sfx.fanfare(); }
    const t = setTimeout(() => { s.settled = true; cbs.current.onSettled?.(); }, 1300);
    return () => clearTimeout(t);
  }, [allIn, shown.length]);

  // 칸마다 도는 띠(무작위 표정 6개)
  const strips = useMemo(
    () => icons.map((_, i) => Array.from({ length: 6 }, (_, k) => (i * 5 + k * 7 + 3) % total)),
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const last = shown[shown.length - 1];
  const jackpot = allIn && shown.length > 0;

  return (
    <div className={`slot-frame ${jackpot ? 'is-jackpot' : ''}`} role="img" aria-label={`이모티콘 슬롯머신 ${shown.length}/${total}`}>
      <div className="slot-board">
        <Bulbs />
        <p className="slot-title">LUCKY <b>12</b> JACKPOT</p>
        <div className="slot-window">
          <span className="slot-pointer left" aria-hidden />
          <div className="grid grid-cols-4 gap-1.5">
            {icons.map((icon, i) => {
              const landed = shown.includes(i);
              const spin = !landed && (busy || doneFlags[i]);
              return (
                <div key={i} className={`slot-cell ${landed && i === last ? 'is-hit' : ''} ${!landed && !spin ? 'is-miss' : ''}`}>
                  {landed ? (
                    <span className="slot-land"><Ball icon={icon} color={COLORS[i % COLORS.length]} /></span>
                  ) : spin ? (
                    <span className="slot-reel" style={{ '--spd': `${0.32 + (i % 4) * 0.05}s` }}>
                      {[...strips[i], ...strips[i]].map((k, j) => <Ball key={j} icon={icons[k]} color={COLORS[k % COLORS.length]} />)}
                    </span>
                  ) : (
                    <span className="text-lg text-white/40">✕</span>
                  )}
                </div>
              );
            })}
          </div>
          <span className="slot-pointer right" aria-hidden />
        </div>
        <Bulbs />
      </div>
    </div>
  );
}

function Ball({ icon, color }) {
  return (
    <span className="slot-ball" style={{ '--c': color }}>
      <span>{icon}</span>
    </span>
  );
}

function Bulbs() {
  return (
    <div className="slot-bulbs" aria-hidden>
      {Array.from({ length: 11 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 2) * 0.45}s` }} />)}
    </div>
  );
}
