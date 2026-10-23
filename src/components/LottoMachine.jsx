import { useEffect, useRef } from 'react';

/**
 * 로또 추첨기
 *  - 유리 돔 안에서 표정 공 12개가 바람(에어)에 섞이며 튀어 다님 (중력·벽·공끼리 충돌)
 *  - 스티커가 하나 완성될 때마다 그 표정 공이 돔 위 출구로 빨려 나가 관을 타고 내려와 받침대에 순서대로 놓임
 *  - 모두 놓이면 onSettled() 호출
 */
const W = 320, H = 252;
const C = { x: 118, y: 122 }, R = 88;          // 돔
const BR = 12;                                  // 돔 안 공 반지름
const TRAY_Y = 234, TRAY_R = 10;                 // 받침대
const PIPE_X = 304, PIPE_TOP = 14;
const COLORS = ['#FFC93C', '#FF7F66', '#6FB6F2', '#8BD17C', '#B98AF0', '#FF9EC4', '#FFB347', '#5ED3C4', '#F26D6D', '#7FA7FF', '#C5D86D', '#E0A96D'];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const slotX = (k) => 20 + k * 23.5;

export default function LottoMachine({ icons, doneFlags, busy, onSettled }) {
  const ref = useRef(null);
  const st = useRef(null);
  const settledCb = useRef(onSettled);
  settledCb.current = onSettled;

  // 공 초기화 (팩이 바뀌면 다시)
  const key = icons.join('|');
  useEffect(() => {
    const balls = icons.map((icon, i) => {
      const a = (i / icons.length) * Math.PI * 2;
      return { i, icon, color: COLORS[i % COLORS.length], x: C.x + Math.cos(a) * 40, y: C.y + 30 + Math.sin(a) * 25, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, rot: 0 };
    });
    st.current = { balls, drawn: [], queue: [], seen: new Set(), traveler: null, lastPop: 0, t: 0, settledAt: 0 };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새로 완성된 스티커 → 추첨 대기열
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    doneFlags.forEach((d, i) => { if (d && !s.seen.has(i)) { s.seen.add(i); s.queue.push(i); } });
  }, [doneFlags]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf;

    const path = (from, k) => {
      // 돔 안 위치 → 출구(돔 꼭대기) → 위쪽 관 → 오른쪽 관 → 받침대 → 자기 자리
      const pts = [[from.x, from.y], [C.x, C.y - R + BR], [C.x, PIPE_TOP], [PIPE_X, PIPE_TOP], [PIPE_X, TRAY_Y], [slotX(k), TRAY_Y]];
      const seg = []; let total = 0;
      for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(l); total += l; }
      return { pts, seg, total };
    };
    const along = (p, d) => {
      let j = 0;
      while (j < p.seg.length - 1 && d > p.seg[j]) { d -= p.seg[j]; j++; }
      const t = Math.min(1, d / (p.seg[j] || 1));
      return [p.pts[j][0] + (p.pts[j + 1][0] - p.pts[j][0]) * t, p.pts[j][1] + (p.pts[j + 1][1] - p.pts[j][1]) * t];
    };

    const step = () => {
      const s = st.current;
      if (!s) return;
      s.t++;
      // ── 돔 안 공 움직임 ──
      if (!reduce) {
        for (const b of s.balls) {
          b.vy += 0.2; // 중력
          // 바닥 송풍구에서 올라오는 바람
          if (b.y > C.y + R * 0.35 && Math.abs(b.x - C.x) < R * 0.55 && Math.random() < 0.35) {
            b.vy -= 1.1 + Math.random() * 1.6;
            b.vx += (Math.random() - 0.5) * 2.2;
          }
          b.vx += (Math.random() - 0.5) * 0.15;
          b.vx *= 0.995; b.vy *= 0.995;
          const sp = Math.hypot(b.vx, b.vy); if (sp > 9) { b.vx *= 9 / sp; b.vy *= 9 / sp; }
          b.x += b.vx; b.y += b.vy; b.rot += b.vx * 0.06;
          // 유리 벽 충돌
          const dx = b.x - C.x, dy = b.y - C.y, dist = Math.hypot(dx, dy), lim = R - BR - 2;
          if (dist > lim) {
            const nx = dx / dist, ny = dy / dist;
            b.x = C.x + nx * lim; b.y = C.y + ny * lim;
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) { b.vx -= 1.85 * vn * nx; b.vy -= 1.85 * vn * ny; }
          }
        }
        // 공끼리 충돌
        for (let a = 0; a < s.balls.length; a++) for (let c = a + 1; c < s.balls.length; c++) {
          const p = s.balls[a], q = s.balls[c];
          const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 0.01;
          if (d < BR * 2) {
            const nx = dx / d, ny = dy / d, push = (BR * 2 - d) / 2;
            p.x -= nx * push; p.y -= ny * push; q.x += nx * push; q.y += ny * push;
            const rv = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
            if (rv < 0) { const j = -rv * 0.92; p.vx -= j * nx; p.vy -= j * ny; q.vx += j * nx; q.vy += j * ny; }
          }
        }
      }
      // ── 추첨: 대기열에서 하나씩 꺼내 관으로 보냄 ──
      if (!s.traveler && s.queue.length && s.t - s.lastPop > (s.queue.length > 2 ? 3 : 8)) {
        const idx = s.queue.shift();
        const bi = s.balls.findIndex((b) => b.i === idx);
        const ball = bi >= 0 ? s.balls.splice(bi, 1)[0] : { i: idx, icon: icons[idx], color: COLORS[idx % COLORS.length], x: C.x, y: C.y, rot: 0 };
        // 기다리는 공이 많을수록 빠르게 (시트 방식은 12개가 한꺼번에 완성됨)
        s.traveler = { ball, p: path(ball, s.drawn.length), d: 0, v: 6, max: Math.min(42, 18 + s.queue.length * 3) };
        s.lastPop = s.t;
      }
      if (s.traveler) {
        const tr = s.traveler;
        tr.v = Math.min(tr.max, tr.v + 1.2); tr.d += tr.v; tr.ball.rot -= 0.25;
        if (tr.d >= tr.p.total) {
          s.drawn.push({ ...tr.ball, bounce: 1 });
          s.traveler = null; s.lastPop = s.t;
        }
      }
      for (const d of s.drawn) d.bounce *= 0.86;
      // 모두 놓였고 만들기가 끝났으면 알림
      if (!busy && !s.traveler && !s.queue.length) {
        if (!s.settledAt) s.settledAt = s.t;
        else if (s.t - s.settledAt > 50) { s.settledAt = Infinity; settledCb.current?.(); }
      } else if (s.settledAt !== Infinity) s.settledAt = 0;
    };

    const drawBall = (b, x, y, r, rot = 0) => {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, b.color); g.addColorStop(1, shade(b.color));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.font = `${Math.round(r * 0.95)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, 0, r * 0.06);
      ctx.restore();
    };

    const draw = () => {
      const s = st.current;
      ctx.clearRect(0, 0, W, H);
      // 받침대 레일
      ctx.fillStyle = '#F4EEE5'; roundRect(ctx, 6, TRAY_Y - 14, W - 12, 28, 14); ctx.fill();
      ctx.strokeStyle = '#E9DFD0'; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.arc(slotX(k), TRAY_Y, TRAY_R - 2, 0, Math.PI * 2); ctx.fillStyle = '#E9DFD0'; ctx.fill(); }
      // 다리·받침
      ctx.fillStyle = '#6B4F3E';
      ctx.beginPath(); ctx.moveTo(C.x - 34, C.y + R - 6); ctx.lineTo(C.x + 34, C.y + R - 6); ctx.lineTo(C.x + 46, TRAY_Y - 16); ctx.lineTo(C.x - 46, TRAY_Y - 16); ctx.closePath(); ctx.fill();
      // 관 (유리)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pipe = () => { ctx.beginPath(); ctx.moveTo(C.x, C.y - R + 4); ctx.lineTo(C.x, PIPE_TOP); ctx.lineTo(PIPE_X, PIPE_TOP); ctx.lineTo(PIPE_X, TRAY_Y); ctx.lineTo(slotX(11) + 8, TRAY_Y); };
      pipe(); ctx.strokeStyle = 'rgba(150,190,215,.35)'; ctx.lineWidth = 28; ctx.stroke();
      pipe(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 22; ctx.stroke();
      // 받침대에 놓인 공
      if (s) s.drawn.forEach((b, k) => drawBall(b, slotX(k), TRAY_Y - b.bounce * 10, TRAY_R));
      // 이동 중인 공
      if (s?.traveler) { const tr = s.traveler; const [x, y] = along(tr.p, tr.d); const r = tr.d > tr.p.total - (tr.p.seg.at(-1) + tr.p.seg.at(-2)) ? TRAY_R + 1 : BR; drawBall(tr.ball, x, y, r, tr.ball.rot); }
      pipe(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke();
      // 돔 안: 바람 줄기
      ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, Math.PI * 2); ctx.clip();
      const bg = ctx.createRadialGradient(C.x, C.y + 20, 10, C.x, C.y, R);
      bg.addColorStop(0, 'rgba(255,248,240,.9)'); bg.addColorStop(1, 'rgba(230,240,248,.9)');
      ctx.fillStyle = bg; ctx.fillRect(C.x - R, C.y - R, R * 2, R * 2);
      if (!reduce && s) {
        ctx.strokeStyle = 'rgba(150,190,215,.35)'; ctx.lineWidth = 2;
        for (let k = -2; k <= 2; k++) {
          const ph = ((s.t * 3 + k * 37) % 70);
          ctx.beginPath(); ctx.moveTo(C.x + k * 14, C.y + R - ph); ctx.lineTo(C.x + k * 14 + Math.sin((s.t + k * 9) / 6) * 4, C.y + R - ph - 14); ctx.stroke();
        }
      }
      if (s) for (const b of s.balls) drawBall(b, b.x, b.y, BR, b.rot);
      ctx.restore();
      // 유리 돔
      ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(110,140,165,.55)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(C.x, C.y, R - 9, Math.PI * 1.08, Math.PI * 1.42); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath(); ctx.arc(C.x, C.y, R - 9, Math.PI * 1.5, Math.PI * 1.56); ctx.stroke();
      // 송풍구
      ctx.fillStyle = '#3E2C22'; roundRect(ctx, C.x - 16, C.y + R - 8, 32, 8, 3); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px "Noto Sans KR",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('찍어찍어!', C.x, TRAY_Y - 18);
      // 출구 뚜껑
      ctx.fillStyle = '#FF7F66'; roundRect(ctx, C.x - 15, C.y - R - 4, 30, 9, 4); ctx.fill();
    };

    const loop = () => { step(); draw(); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [busy, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} className="block w-full h-auto max-w-[360px] mx-auto" style={{ aspectRatio: `${W} / ${H}` }} aria-label="이모티콘 추첨기" role="img" />;
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.72));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
