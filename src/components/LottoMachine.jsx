import { useEffect, useRef } from 'react';
import * as sfx from '../lib/sound.js';

/**
 * 로또 추첨기
 *  - 유리 돔(크롬 링·경선·반사광) 안에서 표정 공 12개가 송풍기 바람에 섞이며 튀어 다님
 *  - 스티커가 하나 완성될 때마다: 출구 뚜껑이 열리고 → 공이 빨려 나가 → 유리관을 굴러 → 받침대에 '딩'
 *  - 받침대 위 전광판 숫자, 받침 둘레 전구가 돌아가며 깜빡, 놓일 때 반짝이 터짐
 *  - 효과음(모터·딸깍·쑥·또르륵·딩·팡파레)은 Web Audio로 합성
 *  - 모두 놓이면 onSettled() 호출
 */
const W = 320, H = 276;
const C = { x: 118, y: 116 }, R = 86;            // 돔
const BR = 12;                                    // 공 반지름
const TRAY_Y = 256, TRAY_R = 10;                  // 받침대
const PIPE_X = 302, PIPE_TOP = 14;
const BASE_TOP = C.y + R - 6, BASE_BOT = 236;     // 받침 몸통
const COLORS = ['#FFC93C', '#FF7F66', '#6FB6F2', '#8BD17C', '#B98AF0', '#FF9EC4', '#FFB347', '#5ED3C4', '#F26D6D', '#7FA7FF', '#C5D86D', '#E0A96D'];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const slotX = (k) => 20 + k * 23.4;
const BULBS = 9;

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
    st.current = { balls, drawn: [], queue: [], seen: new Set(), traveler: null, lastPop: 0, t: 0, settledAt: 0, cap: 0, flash: 0, parts: [], fan: 0, cheered: false };
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
    let raf, stopHum = null;

    const path = (from, k) => {
      // 돔 안 위치 → 출구(돔 꼭대기) → 위쪽 관 → 오른쪽 관 → 받침대 → 자기 자리
      const pts = [[from.x, from.y], [C.x, C.y - R + BR], [C.x, PIPE_TOP], [PIPE_X, PIPE_TOP], [PIPE_X, TRAY_Y], [slotX(k), TRAY_Y]];
      const seg = []; let total = 0;
      for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(l); total += l; }
      return { pts, seg, total, exit: seg[0] };
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
      // ── 모터 소리: 돌아가는 동안만 ──
      const running = busy || s.traveler || s.queue.length;
      if (running && !stopHum) stopHum = sfx.hum();
      else if (!running && stopHum) { stopHum(); stopHum = null; }
      s.fan += running ? 0.45 : 0.04;

      // ── 돔 안 공 움직임 ──
      if (!reduce) {
        const blow = running ? 1 : 0.35;
        for (const b of s.balls) {
          b.vy += 0.2; // 중력
          // 바닥 송풍구에서 올라오는 바람
          if (b.y > C.y + R * 0.35 && Math.abs(b.x - C.x) < R * 0.55 && Math.random() < 0.35 * blow) {
            b.vy -= 1.1 + Math.random() * 1.6;
            b.vx += (Math.random() - 0.5) * 2.2;
          }
          b.vx += (Math.random() - 0.5) * 0.15;
          b.vx *= 0.995; b.vy *= 0.995;
          const sp = Math.hypot(b.vx, b.vy); if (sp > 9) { b.vx *= 9 / sp; b.vy *= 9 / sp; }
          b.x += b.vx; b.y += b.vy; b.rot += b.vx * 0.06;
          // 유리 벽 충돌
          const dx = b.x - C.x, dy = b.y - C.y, dist = Math.hypot(dx, dy), lim = R - BR - 3;
          if (dist > lim) {
            const nx = dx / dist, ny = dy / dist;
            b.x = C.x + nx * lim; b.y = C.y + ny * lim;
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              b.vx -= 1.85 * vn * nx; b.vy -= 1.85 * vn * ny;
              if (vn > 2.5 && Math.random() < 0.5) sfx.clack(Math.min(1, vn / 9) * 0.7);
            }
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
            if (rv < 0) {
              const j = -rv * 0.92; p.vx -= j * nx; p.vy -= j * ny; q.vx += j * nx; q.vy += j * ny;
              if (-rv > 2.5) sfx.clack(Math.min(1, -rv / 10));
            }
          }
        }
      }
      // ── 추첨: 대기열에서 하나씩 꺼내 관으로 보냄 ──
      if (!s.traveler && s.queue.length && s.t - s.lastPop > (s.queue.length > 2 ? 4 : 10)) {
        const idx = s.queue.shift();
        const bi = s.balls.findIndex((b) => b.i === idx);
        const ball = bi >= 0 ? s.balls.splice(bi, 1)[0] : { i: idx, icon: icons[idx], color: COLORS[idx % COLORS.length], x: C.x, y: C.y, rot: 0 };
        // 기다리는 공이 많을수록 빠르게 (시트 방식은 12개가 한꺼번에 완성됨)
        s.traveler = { ball, p: path(ball, s.drawn.length), d: 0, v: 5, max: Math.min(40, 16 + s.queue.length * 3), ticked: 0 };
        s.lastPop = s.t;
        sfx.whoosh();
      }
      // 출구 뚜껑: 공이 지나갈 때 열림
      const tr = s.traveler;
      const capTarget = tr && tr.d < tr.p.exit + 60 ? 1 : 0;
      s.cap += (capTarget - s.cap) * 0.3;
      if (tr) {
        tr.v = Math.min(tr.max, tr.v + 1.1); tr.d += tr.v; tr.ball.rot -= 0.25;
        // 관 속 또르륵 (출구를 지난 뒤부터, 일정 거리마다)
        if (tr.d > tr.p.exit + 20) {
          const n = Math.floor((tr.d - tr.p.exit) / 34);
          if (n > tr.ticked) { tr.ticked = n; sfx.tick(); }
        }
        if (tr.d >= tr.p.total) {
          const k = s.drawn.length;
          s.drawn.push({ ...tr.ball, bounce: 1 });
          s.traveler = null; s.lastPop = s.t; s.flash = 1;
          sfx.ding(k);
          if (!reduce) for (let m = 0; m < 12; m++) {
            const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5;
            s.parts.push({ x: slotX(k), y: TRAY_Y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, c: m % 3 ? tr.ball.color : '#FFE27A', star: m % 2 === 0 });
          }
        }
      }
      for (const d of s.drawn) d.bounce *= 0.86;
      s.flash *= 0.9;
      for (const p of s.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.03; }
      s.parts = s.parts.filter((p) => p.life > 0);
      // 모두 놓였고 만들기가 끝났으면 팡파레 + 알림
      if (!busy && !s.traveler && !s.queue.length) {
        if (!s.settledAt) {
          s.settledAt = s.t;
          if (!s.cheered && s.drawn.length) { s.cheered = true; sfx.fanfare(); }
        } else if (s.t - s.settledAt > 70) { s.settledAt = Infinity; settledCb.current?.(); }
      } else if (s.settledAt !== Infinity) s.settledAt = 0;
    };

    const drawBall = (b, x, y, r, rot = 0) => {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, b.color); g.addColorStop(1, shade(b.color));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r * 0.64, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.font = `${Math.round(r * 0.92)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, 0, r * 0.06);
      ctx.restore();
      // 광택
      ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.5, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
    };

    const pipePath = () => { ctx.beginPath(); ctx.moveTo(C.x, C.y - R + 4); ctx.lineTo(C.x, PIPE_TOP); ctx.lineTo(PIPE_X, PIPE_TOP); ctx.lineTo(PIPE_X, TRAY_Y); ctx.lineTo(slotX(11) + 8, TRAY_Y); };
    // 관 이음새(크롬 링) 위치
    const joints = [];
    for (let x = C.x + 40; x < PIPE_X - 20; x += 62) joints.push([x, PIPE_TOP, 'v']);
    for (let y = PIPE_TOP + 46; y < TRAY_Y - 20; y += 62) joints.push([PIPE_X, y, 'h']);
    joints.push([C.x, PIPE_TOP + 18, 'h'], [C.x, PIPE_TOP, 'c'], [PIPE_X, PIPE_TOP, 'c'], [PIPE_X, TRAY_Y, 'c']);

    const chrome = (x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#9AA3AB'); g.addColorStop(0.35, '#F4F7FA'); g.addColorStop(0.6, '#B7C0C8'); g.addColorStop(1, '#6E7880');
      return g;
    };

    const draw = () => {
      const s = st.current;
      ctx.clearRect(0, 0, W, H);
      // 무대 조명
      const spot = ctx.createRadialGradient(C.x, C.y + 10, 20, C.x, C.y + 10, R + 70);
      spot.addColorStop(0, `rgba(255,214,170,${0.35 + (s?.flash || 0) * 0.3})`); spot.addColorStop(1, 'rgba(255,214,170,0)');
      ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);

      // ── 받침대 레일 (나무) ──
      const wood = ctx.createLinearGradient(0, TRAY_Y - 14, 0, TRAY_Y + 14);
      wood.addColorStop(0, '#C79A6E'); wood.addColorStop(0.5, '#A97850'); wood.addColorStop(1, '#7D5537');
      roundRect(ctx, 6, TRAY_Y - 14, W - 12, 28, 14); ctx.fillStyle = wood; ctx.fill();
      ctx.strokeStyle = 'rgba(62,44,34,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18, TRAY_Y - 11); ctx.lineTo(W - 18, TRAY_Y - 11); ctx.stroke();
      for (let k = 0; k < 12; k++) {
        const cup = ctx.createRadialGradient(slotX(k), TRAY_Y - 3, 1, slotX(k), TRAY_Y, TRAY_R);
        cup.addColorStop(0, '#5A3D2A'); cup.addColorStop(1, '#8C6243');
        ctx.beginPath(); ctx.arc(slotX(k), TRAY_Y, TRAY_R - 1.5, 0, Math.PI * 2); ctx.fillStyle = cup; ctx.fill();
      }

      // ── 받침 몸통 + 전광판 + 전구 ──
      const body = ctx.createLinearGradient(C.x - 60, 0, C.x + 60, 0);
      body.addColorStop(0, '#5A3F30'); body.addColorStop(0.45, '#8A6650'); body.addColorStop(1, '#4A3226');
      ctx.beginPath(); ctx.moveTo(C.x - 40, BASE_TOP); ctx.lineTo(C.x + 40, BASE_TOP); ctx.lineTo(C.x + 60, BASE_BOT); ctx.lineTo(C.x - 60, BASE_BOT); ctx.closePath();
      ctx.fillStyle = body; ctx.fill();
      ctx.fillStyle = chrome(0, BASE_BOT - 4, 0, BASE_BOT + 4); roundRect(ctx, C.x - 66, BASE_BOT - 3, 132, 7, 3); ctx.fill();
      // 전광판
      const n = s ? s.drawn.length : 0;
      roundRect(ctx, C.x - 27, BASE_TOP + 9, 54, 18, 4); ctx.fillStyle = '#1E1410'; ctx.fill();
      ctx.strokeStyle = chrome(0, BASE_TOP + 9, 0, BASE_TOP + 27); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = 'bold 13px ui-monospace,"SF Mono",Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,90,60,.16)'; ctx.fillText('88/88', C.x, BASE_TOP + 18.5);
      ctx.save(); ctx.shadowColor = '#FF5A3C'; ctx.shadowBlur = 6; ctx.fillStyle = '#FF6A4A';
      ctx.fillText(`${String(n).padStart(2, '0')}/${String(icons.length).padStart(2, '0')}`, C.x, BASE_TOP + 18.5); ctx.restore();
      // 전구 (돌아가며 깜빡 / 놓일 때 전부 번쩍 / 끝나면 다 같이 깜빡)
      for (let k = 0; k < BULBS; k++) {
        const bx = C.x - 48 + k * 12, by = BASE_TOP + 33;
        const t = s ? s.t : 0;
        const on = !s ? false : s.flash > 0.25 ? true : busy || s.traveler ? (Math.floor(t / 5) + k) % 3 === 0 : Math.floor(t / 18) % 2 === 0;
        if (on) { ctx.save(); ctx.shadowColor = '#FFD25A'; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fillStyle = on ? '#FFE48A' : '#6B5040'; ctx.fill();
        if (on) ctx.restore();
      }

      // ── 관 (유리) ──
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      pipePath(); ctx.strokeStyle = 'rgba(120,165,195,.32)'; ctx.lineWidth = 29; ctx.stroke();
      pipePath(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 23; ctx.stroke();
      // 받침대에 놓인 공
      if (s) s.drawn.forEach((b, k) => drawBall(b, slotX(k), TRAY_Y - b.bounce * 12, TRAY_R));
      // 이동 중인 공
      if (s?.traveler) {
        const t2 = s.traveler; const [x, y] = along(t2.p, t2.d);
        const r = t2.d > t2.p.total - (t2.p.seg.at(-1) + t2.p.seg.at(-2)) ? TRAY_R + 1 : BR;
        // 빠를 때 잔상
        if (!reduce && t2.v > 12) { ctx.globalAlpha = 0.25; const [px, py] = along(t2.p, Math.max(0, t2.d - t2.v * 0.7)); drawBall(t2.ball, px, py, r, t2.ball.rot); ctx.globalAlpha = 1; }
        drawBall(t2.ball, x, y, r, t2.ball.rot);
      }
      // 관 반사광 + 이음새
      pipePath(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke();
      for (const [x, y, o] of joints) {
        if (o === 'c') { ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.strokeStyle = chrome(x - 15, y - 15, x + 15, y + 15); ctx.lineWidth = 3; ctx.stroke(); continue; }
        ctx.fillStyle = o === 'v' ? chrome(x - 3, 0, x + 3, 0) : chrome(0, y - 3, 0, y + 3);
        if (o === 'v') roundRect(ctx, x - 3, y - 16, 6, 32, 2); else roundRect(ctx, x - 16, y - 3, 32, 6, 2);
        ctx.fill();
      }

      // ── 돔 안 ──
      ctx.save(); ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, Math.PI * 2); ctx.clip();
      const bg = ctx.createRadialGradient(C.x - 20, C.y - 25, 10, C.x, C.y, R);
      bg.addColorStop(0, 'rgba(255,251,246,.95)'); bg.addColorStop(0.7, 'rgba(236,244,250,.92)'); bg.addColorStop(1, 'rgba(196,216,230,.95)');
      ctx.fillStyle = bg; ctx.fillRect(C.x - R, C.y - R, R * 2, R * 2);
      // 바람 줄기
      if (!reduce && s) {
        ctx.strokeStyle = 'rgba(140,185,215,.4)'; ctx.lineWidth = 2;
        for (let k = -2; k <= 2; k++) {
          const ph = ((s.t * 3 + k * 37) % 80);
          ctx.beginPath(); ctx.moveTo(C.x + k * 13, C.y + R - 8 - ph);
          ctx.quadraticCurveTo(C.x + k * 13 + Math.sin((s.t + k * 9) / 6) * 6, C.y + R - 16 - ph, C.x + k * 13, C.y + R - 26 - ph); ctx.stroke();
        }
      }
      // 공 그림자 → 공
      if (s) {
        for (const b of s.balls) { ctx.beginPath(); ctx.arc(b.x + 2, b.y + 3, BR, 0, Math.PI * 2); ctx.fillStyle = 'rgba(40,60,80,.12)'; ctx.fill(); }
        for (const b of s.balls) drawBall(b, b.x, b.y, BR, b.rot);
      }
      // 송풍기 팬 (돔 바닥)
      const fx = C.x, fy = C.y + R - 17;
      ctx.fillStyle = '#3E2C22'; ctx.beginPath(); ctx.ellipse(fx, fy, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,210,220,.8)'; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const a = (s ? s.fan : 0) + (k * Math.PI) / 2;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * 18, fy + Math.sin(a) * 5.5); ctx.stroke();
      }
      ctx.restore();

      // ── 유리 돔 ──
      // 경선·적도 (구 느낌)
      ctx.strokeStyle = 'rgba(120,150,175,.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(C.x, C.y, R * 0.42, R, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(C.x, C.y, R, R * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      // 테두리 + 반사광
      ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(100,135,160,.6)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(C.x, C.y, R - 3, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(C.x, C.y, R - 10, Math.PI * 1.08, Math.PI * 1.4); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 7; ctx.stroke();
      ctx.beginPath(); ctx.arc(C.x, C.y, R - 10, Math.PI * 1.47, Math.PI * 1.53); ctx.stroke();
      ctx.beginPath(); ctx.arc(C.x, C.y, R - 8, Math.PI * 0.1, Math.PI * 0.28); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 4; ctx.stroke();
      // 크롬 받침 링 (돔과 몸통 사이)
      ctx.fillStyle = chrome(C.x - 46, 0, C.x + 46, 0);
      ctx.beginPath(); ctx.ellipse(C.x, BASE_TOP, 46, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(70,80,90,.5)'; ctx.lineWidth = 1; ctx.stroke();

      // ── 출구: 크롬 목 + 열리는 뚜껑 ──
      ctx.fillStyle = chrome(C.x - 16, 0, C.x + 16, 0); roundRect(ctx, C.x - 16, C.y - R - 6, 32, 10, 3); ctx.fill();
      const cap = s ? s.cap : 0;
      ctx.save(); ctx.translate(C.x + 15, C.y - R - 6); ctx.rotate(-cap * 1.1);
      const cg = ctx.createLinearGradient(0, -5, 0, 4); cg.addColorStop(0, '#FF9A85'); cg.addColorStop(1, '#E85E45');
      ctx.fillStyle = cg; roundRect(ctx, -32, -5, 32, 8, 4); ctx.fill();
      ctx.restore();

      // 반짝이
      if (s) for (const p of s.parts) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        if (p.star) star(ctx, p.x, p.y, 3.2 * p.life + 1);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => { step(); draw(); raf = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(raf); if (stopHum) stopHum(); };
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
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.4 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
