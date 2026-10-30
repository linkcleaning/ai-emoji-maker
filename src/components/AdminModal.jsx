import { useEffect, useState } from 'react';
import { X, RefreshCw, KeyRound } from 'lucide-react';
import SampleMaker from './SampleMaker.jsx';
import { adminStats, adminCredit, adminConfig, getAdminPw, setAdminPw } from '../lib/server.js';

const fmtTime = (ms) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 관리자: 오늘 현황 · 이용 코드 충전 · 입금 안내/한도 설정 */
export default function AdminModal({ onClose, notify, onOpenSettings }) {
  const [pw, setPw] = useState(getAdminPw());
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [code, setCode] = useState('');
  const [packs, setPacks] = useState(2);
  const [memo, setMemo] = useState('');
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (password = pw) => {
    setBusy(true); setErr('');
    const r = await adminStats(password).catch(() => ({ ok: false, data: { message: '서버에 연결하지 못했어요.' } }));
    setBusy(false);
    if (!r.ok) { setAuthed(false); setErr(r.data.message || '불러오지 못했어요.'); return; }
    setAdminPw(password); setAuthed(true); setData(r.data); setCfg(r.data.config);
  };
  useEffect(() => { if (getAdminPw()) load(getAdminPw()); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const charge = async (c = code, n = packs, m = memo) => {
    const cc = c.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cc)) { setErr('이용 코드 6자리를 입력해 주세요.'); return; }
    setBusy(true); setErr('');
    const r = await adminCredit(cc, n, m);
    setBusy(false);
    if (!r.ok) { setErr(r.data.message || '충전하지 못했어요.'); return; }
    notify(`${cc}에 ${n > 0 ? '+' : ''}${n}팩 → 남은 충전 ${r.data.credit}팩`);
    setCode(''); setMemo('');
    load();
  };

  const saveCfg = async () => {
    setBusy(true);
    const r = await adminConfig(cfg);
    setBusy(false);
    if (r.ok) { notify('설정을 저장했어요.'); setCfg(r.data); } else setErr(r.data.message || '저장하지 못했어요.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/40 grid place-items-end sm:place-items-center" onClick={onClose}>
      <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-3xl p-5 max-h-[92dvh] overflow-y-auto overscroll-contain pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">관리자</h2>
          <div className="flex items-center gap-1">
            {authed && <button onClick={() => load()} aria-label="새로고침" className="p-1.5"><RefreshCw size={18} className={busy ? 'animate-spin' : ''} /></button>}
            <button onClick={onClose} aria-label="닫기" className="p-1"><X size={22} /></button>
          </div>
        </div>

        {!authed ? (
          <form onSubmit={(e) => { e.preventDefault(); load(pw); }}>
            <label className="label" htmlFor="admin-pw">관리자 비밀번호</label>
            <input id="admin-pw" type="password" className="input mb-3" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            {err && <p className="text-xs text-peach-600 mb-3">{err}</p>}
            <button type="submit" className="btn-primary w-full" disabled={!pw || busy}><KeyRound size={16} /> 들어가기</button>
          </form>
        ) : data && (
          <div className="space-y-5">
            {/* 오늘 현황 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-cream-100 p-3">
                <p className="text-[11px] font-bold text-cocoa-400">오늘 만든 팩 ({data.day})</p>
                <p className="text-2xl font-bold tabular-nums">{data.total}<span className="text-sm text-cocoa-400"> / {data.config.dailyCap}</span></p>
              </div>
              <div className="rounded-2xl bg-cream-100 p-3">
                <p className="text-[11px] font-bold text-cocoa-400">AI 비용 오늘 (호출 {data.calls ?? 0}회)</p>
                <p className="text-2xl font-bold tabular-nums">약 {(data.cost?.today ?? (data.calls ?? 0) * 95).toLocaleString()}<span className="text-sm text-cocoa-400">원</span></p>
              </div>
              {data.cost && <CostCard cost={data.cost} />}
              <div className="col-span-2 rounded-2xl bg-cream-100 p-3">
                <p className="text-[11px] font-bold text-cocoa-400">AI가 한 번 그리는 데 걸린 시간 (오늘)</p>
                <p className="text-lg font-bold tabular-nums">
                  {data.timing ? <>평균 {data.timing.avg}초 <span className="text-sm text-cocoa-400">· 가장 느림 {data.timing.max}초 · {data.timing.n}회</span></> : <span className="text-sm text-cocoa-400">아직 기록 없음</span>}
                </p>
              </div>
            </div>

            {/* 충전 */}
            <section>
              <h3 className="font-bold text-sm mb-2">이용 코드 충전 (입금 확인 후)</h3>
              <div className="flex gap-2 mb-2">
                <input
                  className="input flex-1 font-mono uppercase tracking-widest"
                  placeholder="코드 6자리"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  aria-label="이용 코드"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[1, 2, 5, 10].map((n) => (
                  <button key={n} onClick={() => setPacks(n)} aria-pressed={packs === n}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border ${packs === n ? 'bg-peach-500 border-peach-500 text-white' : 'bg-cream-50 border-cream-200 text-cocoa-600'}`}>
                    +{n}팩
                  </button>
                ))}
                <button onClick={() => setPacks(-1)} aria-pressed={packs === -1}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border ${packs === -1 ? 'bg-cocoa-800 border-cocoa-800 text-white' : 'bg-cream-50 border-cream-200 text-cocoa-600'}`}>
                  -1 (취소)
                </button>
              </div>
              <input className="input mb-2" placeholder="메모 (예: 홍길동 3,000원 입금)" value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="메모" />
              {err && <p className="text-xs text-peach-600 mb-2">{err}</p>}
              <button onClick={() => charge()} disabled={busy || code.length !== 6} className="btn-primary w-full">
                {code || '코드'}에 {packs > 0 ? `+${packs}` : packs}팩 {packs > 0 ? '충전' : '차감'}
              </button>
            </section>

            {/* 오늘 이용자 */}
            <section>
              <h3 className="font-bold text-sm mb-2">오늘 이용한 코드</h3>
              {data.users.length === 0 ? <p className="text-xs text-cocoa-400">아직 없어요.</p> : (
                <div className="rounded-2xl border border-cream-200 divide-y divide-cream-200 overflow-hidden">
                  {data.users.map((u) => (
                    <div key={u.code} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-mono font-bold tracking-wider">{u.code}</span>
                      <span className="flex-1 text-xs text-cocoa-400 tabular-nums">무료 {u.free_used} · 충전사용 {u.paid_used} · 남은충전 {u.credit}</span>
                      <button onClick={() => setCode(u.code)} className="text-xs font-bold text-peach-600 shrink-0">선택</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 충전 기록 */}
            {data.log.length > 0 && (
              <section>
                <h3 className="font-bold text-sm mb-2">최근 충전 기록</h3>
                <ul className="text-xs text-cocoa-600 space-y-1">
                  {data.log.map((l, i) => (
                    <li key={i} className="flex gap-2"><span className="text-cocoa-400 tabular-nums shrink-0">{fmtTime(l.at)}</span><span className="font-mono">{l.code}</span><span className="tabular-nums">{l.packs > 0 ? '+' : ''}{l.packs}팩</span><span className="truncate text-cocoa-400">{l.memo}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {/* 설정 */}
            {cfg && (
              <section>
                <h3 className="font-bold text-sm mb-2">설정</h3>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[['freePerDay', '1인 하루 무료'], ['ipFreePerDay', '같은 와이파이 무료'], ['dailyCap', '하루 전체 상한']].map(([k, l]) => (
                    <label key={k} className="block">
                      <span className="label !text-[10px]">{l}</span>
                      <input type="number" min="0" inputMode="numeric" className="input !px-2 text-center" value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} />
                    </label>
                  ))}
                </div>
                <label className="label" htmlFor="srvmodel">손님 AI 모델 (모든 손님에게 적용)</label>
                <select id="srvmodel" className="input mb-2" value={cfg.model || 'gemini-3.1-flash-image'} onChange={(e) => setCfg({ ...cfg, model: e.target.value })}>
                  <option value="gemini-3.1-flash-image">나노바나나 2 — 기본 (그림 품질 우선)</option>
                  <option value="gemini-3.1-flash-lite-image">나노바나나 2 라이트 — 더 빠르고 저렴</option>
                </select>
                <label className="label" htmlFor="payinfo">입금 안내 (한도 도달 시 손님에게 보여요)</label>
                <textarea id="payinfo" rows={4} className="input mb-2 resize-none" value={cfg.payInfo} onChange={(e) => setCfg({ ...cfg, payInfo: e.target.value })}
                  placeholder={'예)\n1팩 1,000원 / 3팩 2,500원\n카카오뱅크 3333-00-0000000 (예금주)\n입금자명에 이용 코드를 적어주세요'} />
                <button onClick={saveCfg} disabled={busy} className="btn-ghost w-full">설정 저장</button>
              </section>
            )}

            <div className="border-t border-cream-200 pt-4"><SampleMaker notify={notify} /></div>

            <section className="border-t border-cream-200 pt-4">
              <button onClick={onOpenSettings} className="btn-ghost w-full">⚙️ 고급 설정 (AI 엔진·생성 방식·배경 처리)</button>
              <p className="text-[11px] text-cocoa-400 mt-1.5 text-center">손님 화면에는 안 보이는 설정이에요. 이 기기에서만 적용돼요.</p>
            </section>

            <section className="rounded-2xl bg-cream-100 p-3 text-xs text-cocoa-600 leading-relaxed">
              👑 이 기기는 <b>관리자(무제한)</b>로 기억돼요. 이모티콘을 만들어도 무료 횟수·충전이 줄지 않아요. (AI 비용은 위 예상 비용에 포함)
              <button onClick={() => { setAdminPw(''); setAuthed(false); setPw(''); notify('이 기기에서 관리자를 해제했어요.'); onClose(); }} className="block mt-2 text-peach-600 font-bold underline underline-offset-2">
                이 기기에서 관리자 해제
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** 이번 달 AI 비용 + 날짜별 내역 */
function CostCard({ cost }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...cost.history.map((h) => h.won));
  const label = (m) => (m.includes('lite') ? '라이트' : '기본');
  return (
    <div className="col-span-2 rounded-2xl bg-cream-100 p-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left" aria-expanded={open}>
        <span>
          <span className="block text-[11px] font-bold text-cocoa-400">AI 비용 이번 달 ({new Date().getMonth() + 1}월)</span>
          <span className="block text-2xl font-bold tabular-nums">약 {cost.month.toLocaleString()}<span className="text-sm text-cocoa-400">원</span></span>
        </span>
        <span className="text-xs font-bold text-peach-600">{open ? '접기 ▲' : '날짜별 보기 ▼'}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {cost.history.length ? cost.history.map((h) => (
            <li key={h.day} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 tabular-nums text-cocoa-600">{h.day.slice(5).replace('-', '/')}</span>
                <span className="flex-1 h-2 rounded-full bg-white overflow-hidden"><span className="block h-full bg-peach-400 rounded-full" style={{ width: `${(h.won / max) * 100}%` }} /></span>
                <span className="w-16 shrink-0 text-right font-bold tabular-nums">{h.won.toLocaleString()}원</span>
              </div>
              <p className="pl-14 text-[10px] text-cocoa-400">
                {h.calls}회{h.models ? ' · ' + h.models.map((m) => `${label(m.model)} ${m.calls}`).join(', ') : ''}{h.estimated ? ' · 추정' : ''}
              </p>
            </li>
          )) : <li className="text-xs text-cocoa-400">아직 기록이 없어요</li>}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-cocoa-400 leading-relaxed break-keep">
        구글 요금표 기준 추정이에요 (1회: 기본 약 95원, 라이트 약 49원). 실제 청구액은 Google AI Studio → 사용량·결제에서 확인할 수 있어요.
      </p>
    </div>
  );
}
