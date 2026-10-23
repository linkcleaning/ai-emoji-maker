// ─────────────────────────────────────────────────────────────
// AI 이모티콘 메이커 서버 (Cloudflare Worker)
//  - 앱 화면(dist) 제공 + /api/* 중계
//  - 사장님 Gemini 키는 비밀 값 GEMINI_API_KEY 에만 존재 (손님에게 절대 노출 안 됨)
//  - 관리자 비밀번호는 비밀 값 ADMIN_PASSWORD
// ─────────────────────────────────────────────────────────────
import { DurableObject } from 'cloudflare:workers';
import { createStore } from './store.js';

const ALLOWED_MODELS = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'];
const DEFAULT_MODEL = 'gemini-3.1-flash-image';
const MAX_BODY = 8 * 1024 * 1024;

/** 사용량 기록을 한곳에서 처리하는 저장소 (항상 한 개 인스턴스 → 동시 요청에도 숫자가 정확함) */
export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = (q, ...b) => [...ctx.storage.sql.exec(q, ...b)];
    this.s = createStore(sql);
  }
  status(code) { return this.s.status(code); }
  startPack(args) { return this.s.startPack(args); }
  useCall(token) { return this.s.useCall(token); }
  refundCall(token) { return this.s.refundCall(token); }
  addCredit(code, packs, memo) { return this.s.addCredit(code, packs, memo); }
  stats() { return this.s.stats(); }
  setConfig(patch) { return this.s.setConfig(patch); }
  getConfig() { return this.s.getConfig(); }
  adminLocked() { return this.s.adminLocked(); }
  adminFail() { return this.s.adminFail(); }
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// 기기 ID → 사람이 읽기 쉬운 6자리 이용 코드 (헷갈리는 0/O/1/I 제외)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function codeOf(deviceId) {
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`emoji:${deviceId}`)));
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}
const validDevice = (d) => typeof d === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(d);
const validCode = (c) => typeof c === 'string' && new RegExp(`^[${ALPHABET}]{6}$`).test(c);

function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

export async function handleApi(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const store = env.STORE.get(env.STORE.idFromName('main'));

  if (!env.GEMINI_API_KEY) return json({ error: 'not_configured', message: '서버에 GEMINI_API_KEY가 설정되지 않았어요.' }, 503);

  // 앱이 서버 모드인지 확인
  if (path === '/api/config' && req.method === 'GET') {
    const cfg = await store.getConfig();
    return json({ server: true, freePerDay: cfg.freePerDay, payInfo: cfg.payInfo, models: ALLOWED_MODELS });
  }

  // 내 이용 현황
  if (path === '/api/me' && req.method === 'POST') {
    const { deviceId } = await readJson(req);
    if (!validDevice(deviceId)) return json({ error: 'bad_device' }, 400);
    return json(await store.status(await codeOf(deviceId)));
  }

  // 팩 시작 (무료 또는 충전분 1팩 차감 → 토큰 발급)
  if (path === '/api/pack/start' && req.method === 'POST') {
    const { deviceId } = await readJson(req);
    if (!validDevice(deviceId)) return json({ error: 'bad_device' }, 400);
    const code = await codeOf(deviceId);
    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    const r = await store.startPack({ code, ip, token: randomToken() });
    return json(r, r.ok ? 200 : 402);
  }

  // AI 이미지 생성 중계 (본문은 손대지 않고 그대로 Gemini로 전달 → 서버 부담 최소)
  if (path === '/api/generate' && req.method === 'POST') {
    const token = req.headers.get('x-pack-token') || '';
    const model = ALLOWED_MODELS.includes(req.headers.get('x-model')) ? req.headers.get('x-model') : DEFAULT_MODEL;
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_BODY) return json({ error: { code: 413, message: '사진이 너무 커요.' } }, 413);
    if (!/^[a-f0-9]{48}$/.test(token)) return json({ error: { code: 403, message: 'pack_token' } }, 403);
    const use = await store.useCall(token);
    if (!use.ok) return json({ error: { code: 403, message: 'pack_token' } }, 403);
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: req.body,
      });
    } catch (e) {
      await store.refundCall(token);
      return json({ error: { code: 502, message: 'AI 서버에 연결하지 못했어요.' } }, 502);
    }
    if (!res.ok) await store.refundCall(token); // 실패한 호출은 횟수에서 빼지 않음
    return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-calls-left': String(use.ok ? use.remaining : 0) } });
  }

  // ── 관리자 ──
  if (path.startsWith('/api/admin/')) {
    if (!env.ADMIN_PASSWORD) return json({ error: 'no_admin', message: '서버에 ADMIN_PASSWORD가 설정되지 않았어요.' }, 503);
    if (await store.adminLocked()) return json({ error: 'locked', message: '비밀번호를 여러 번 틀려서 1시간 동안 잠겼어요.' }, 429);
    if (!safeEqual(req.headers.get('x-admin-password'), env.ADMIN_PASSWORD)) {
      await store.adminFail();
      return json({ error: 'auth', message: '관리자 비밀번호가 틀렸어요.' }, 401);
    }
    if (path === '/api/admin/stats' && req.method === 'GET') return json(await store.stats());
    if (path === '/api/admin/credit' && req.method === 'POST') {
      const { code, packs, memo } = await readJson(req);
      const c = String(code || '').trim().toUpperCase();
      if (!validCode(c)) return json({ error: 'bad_code', message: '이용 코드는 6자리예요 (예: K7Q2MX).' }, 400);
      return json(await store.addCredit(c, packs, memo));
    }
    if (path === '/api/admin/config' && req.method === 'POST') return json(await store.setConfig(await readJson(req)));
    return json({ error: 'not_found' }, 404);
  }

  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env);
      } catch (e) {
        return json({ error: 'server', message: '서버 오류가 났어요. 잠시 후 다시 해주세요.' }, 500);
      }
    }
    return env.ASSETS.fetch(req); // 앱 화면
  },
};
