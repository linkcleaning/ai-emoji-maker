// ─────────────────────────────────────────────────────────────
// 사용량·충전 기록 (Durable Object 안의 SQLite에서 실행)
// sql(query, ...bindings) → 결과 행 배열
// ─────────────────────────────────────────────────────────────

export const DEFAULTS = {
  freePerDay: 2,        // 1인당 하루 무료 팩
  ipFreePerDay: 6,      // 같은 인터넷 주소(IP)에서 하루 무료 팩 합계 상한
  dailyCap: 100,        // 하루 전체 팩 상한(요금 폭주 방지)
  callsPerPack: 24,     // 한 팩에서 쓸 수 있는 AI 호출 수(12장 + 다시 그리기 여유)
  payInfo: '추가 이용은 입금 후 이용 코드를 알려주시면 바로 풀어드려요.\n(입금 계좌와 연락처는 관리자 화면에서 입력하세요)',
};

const TOKEN_HOURS = 6;

export function kstDay(now = Date.now()) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function createStore(sql) {
  const one = (q, ...b) => sql(q, ...b)[0] || null;

  const init = () => {
    sql(`CREATE TABLE IF NOT EXISTS usage (day TEXT, code TEXT, free_used INTEGER DEFAULT 0, paid_used INTEGER DEFAULT 0, PRIMARY KEY (day, code))`);
    sql(`CREATE TABLE IF NOT EXISTS ipuse (day TEXT, ip TEXT, n INTEGER DEFAULT 0, PRIMARY KEY (day, ip))`);
    sql(`CREATE TABLE IF NOT EXISTS credit (code TEXT PRIMARY KEY, packs INTEGER DEFAULT 0, updated INTEGER)`);
    sql(`CREATE TABLE IF NOT EXISTS credit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, packs INTEGER, memo TEXT, at INTEGER)`);
    sql(`CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, code TEXT, remaining INTEGER, expires INTEGER)`);
    sql(`CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT)`);
    sql(`CREATE TABLE IF NOT EXISTS admin_fail (at INTEGER)`);
    sql(`CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, calls INTEGER DEFAULT 0)`);
  };
  init();

  const getConfig = () => {
    const cfg = { ...DEFAULTS };
    for (const r of sql(`SELECT k, v FROM config`)) {
      try { cfg[r.k] = JSON.parse(r.v); } catch { /* ignore */ }
    }
    return cfg;
  };

  const setConfig = (patch) => {
    const allowed = ['freePerDay', 'ipFreePerDay', 'dailyCap', 'callsPerPack', 'payInfo'];
    for (const k of allowed) {
      if (!(k in patch)) continue;
      let v = patch[k];
      if (k === 'payInfo') v = String(v).slice(0, 500);
      else v = Math.max(0, Math.min(10000, Math.round(Number(v) || 0)));
      sql(`INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(v));
    }
    return getConfig();
  };

  const status = (code, now = Date.now()) => {
    const day = kstDay(now);
    const cfg = getConfig();
    const u = one(`SELECT free_used, paid_used FROM usage WHERE day = ? AND code = ?`, day, code) || { free_used: 0, paid_used: 0 };
    const c = one(`SELECT packs FROM credit WHERE code = ?`, code);
    return {
      code,
      freePerDay: cfg.freePerDay,
      freeLeft: Math.max(0, cfg.freePerDay - u.free_used),
      credit: c ? c.packs : 0,
      payInfo: cfg.payInfo,
    };
  };

  /** 팩 시작: 무료 → 충전분 순서로 차감하고, AI 호출용 일회성 토큰 발급 */
  const startPack = ({ code, ip, token, now = Date.now() }) => {
    const day = kstDay(now);
    const cfg = getConfig();
    // 오래된 기록 정리
    sql(`DELETE FROM tokens WHERE expires < ?`, now);

    const total = one(`SELECT COALESCE(SUM(free_used + paid_used), 0) AS n FROM usage WHERE day = ?`, day).n;
    if (total >= cfg.dailyCap) return { ok: false, reason: 'daily_cap', ...status(code, now) };

    const u = one(`SELECT free_used FROM usage WHERE day = ? AND code = ?`, day, code) || { free_used: 0 };
    const ipn = (one(`SELECT n FROM ipuse WHERE day = ? AND ip = ?`, day, ip) || { n: 0 }).n;
    let kind = null;
    if (u.free_used < cfg.freePerDay && ipn < cfg.ipFreePerDay) {
      kind = 'free';
      sql(`INSERT INTO usage (day, code, free_used) VALUES (?, ?, 1) ON CONFLICT(day, code) DO UPDATE SET free_used = free_used + 1`, day, code);
      sql(`INSERT INTO ipuse (day, ip, n) VALUES (?, ?, 1) ON CONFLICT(day, ip) DO UPDATE SET n = n + 1`, day, ip);
    } else {
      const paid = sql(`UPDATE credit SET packs = packs - 1, updated = ? WHERE code = ? AND packs > 0 RETURNING packs`, now, code);
      if (paid.length) {
        kind = 'paid';
        sql(`INSERT INTO usage (day, code, paid_used) VALUES (?, ?, 1) ON CONFLICT(day, code) DO UPDATE SET paid_used = paid_used + 1`, day, code);
      }
    }
    if (!kind) {
      const reason = u.free_used < cfg.freePerDay ? 'ip_limit' : 'limit';
      return { ok: false, reason, ...status(code, now) };
    }
    sql(`INSERT INTO tokens (token, code, remaining, expires) VALUES (?, ?, ?, ?)`, token, code, cfg.callsPerPack, now + TOKEN_HOURS * 3600 * 1000);
    return { ok: true, kind, token, calls: cfg.callsPerPack, ...status(code, now) };
  };

  /** AI 호출 1회 사용 (토큰의 남은 횟수 차감). 실패하면 refund로 되돌림 */
  const useCall = (token, now = Date.now()) => {
    const r = sql(`UPDATE tokens SET remaining = remaining - 1 WHERE token = ? AND remaining > 0 AND expires > ? RETURNING remaining, code`, token, now);
    if (!r.length) return { ok: false };
    sql(`INSERT INTO daily (day, calls) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET calls = calls + 1`, kstDay(now));
    return { ok: true, remaining: r[0].remaining, code: r[0].code };
  };
  const refundCall = (token, now = Date.now()) => {
    sql(`UPDATE tokens SET remaining = remaining + 1 WHERE token = ?`, token);
    sql(`UPDATE daily SET calls = MAX(calls - 1, 0) WHERE day = ?`, kstDay(now));
  };

  /** 관리자: 코드에 팩 충전(음수면 차감) */
  const addCredit = (code, packs, memo = '', now = Date.now()) => {
    packs = Math.max(-1000, Math.min(1000, Math.round(Number(packs) || 0)));
    sql(`INSERT INTO credit (code, packs, updated) VALUES (?, MAX(?, 0), ?) ON CONFLICT(code) DO UPDATE SET packs = MAX(packs + ?, 0), updated = excluded.updated`, code, packs, now, packs);
    sql(`INSERT INTO credit_log (code, packs, memo, at) VALUES (?, ?, ?, ?)`, code, packs, String(memo).slice(0, 100), now);
    return status(code, now);
  };

  /** 관리자: 오늘 현황 */
  const stats = (now = Date.now()) => {
    const day = kstDay(now);
    const rows = sql(`SELECT u.code, u.free_used, u.paid_used, COALESCE(c.packs, 0) AS credit FROM usage u LEFT JOIN credit c ON c.code = u.code WHERE u.day = ? ORDER BY (u.free_used + u.paid_used) DESC LIMIT 200`, day);
    const total = rows.reduce((s, r) => s + r.free_used + r.paid_used, 0);
    const log = sql(`SELECT code, packs, memo, at FROM credit_log ORDER BY id DESC LIMIT 30`);
    const credits = sql(`SELECT code, packs FROM credit WHERE packs > 0 ORDER BY updated DESC LIMIT 100`);
    const calls = (one(`SELECT calls FROM daily WHERE day = ?`, day) || { calls: 0 }).calls;
    return { day, total, calls, users: rows, log, credits, config: getConfig() };
  };

  /** 관리자 비밀번호 무차별 대입 방지: 1시간에 10회 실패하면 잠금 */
  const adminLocked = (now = Date.now()) => {
    sql(`DELETE FROM admin_fail WHERE at < ?`, now - 3600 * 1000);
    return one(`SELECT COUNT(*) AS n FROM admin_fail`).n >= 10;
  };
  const adminFail = (now = Date.now()) => { sql(`INSERT INTO admin_fail (at) VALUES (?)`, now); };

  return { getConfig, setConfig, status, startPack, useCall, refundCall, addCredit, stats, adminLocked, adminFail };
}
