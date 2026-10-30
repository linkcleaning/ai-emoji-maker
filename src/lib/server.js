// ─────────────────────────────────────────────────────────────
// 서버(무료 이용) 모드: Cloudflare Worker의 /api 와 통신
// 깃허브 페이지처럼 서버가 없는 곳에서는 자동으로 '내 API 키' 방식으로 동작
// ─────────────────────────────────────────────────────────────

const DEVICE_KEY = 'emoji-maker-device-v1';

/** 이 기기 고유 ID (처음 한 번 만들어 저장). 서버는 이걸로 6자리 이용 코드를 만듦 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      id = [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // 저장이 막힌 환경(시크릿 모드 등): 이번 접속 동안만 쓰는 ID
    if (!window.__emojiDevice) window.__emojiDevice = Math.random().toString(36).slice(2).padEnd(20, '0');
    return window.__emojiDevice;
  }
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

/**
 * 서버 모드인지 확인
 *  - 정상: { server: true, ... }
 *  - 서버는 있는데 비밀 값(GEMINI_API_KEY)이 없음: { server: false, problem: 'not_configured' }
 *  - 서버 없음(깃허브 페이지 등): null
 */
export async function fetchServerConfig() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null; // 앱 화면(HTML)이 돌아옴 = 서버 없음
    const data = await res.json();
    if (res.ok && data.server) return data;
    if (data.error === 'not_configured') return { server: false, problem: 'not_configured' };
    return null;
  } catch {
    return null;
  }
}

export const fetchMe = () => call('/api/me', { method: 'POST', body: { deviceId: getDeviceId() } }).then((r) => (r.ok ? r.data : null));

/** 팩 시작: 성공하면 {ok:true, token,...}, 한도면 {ok:false, reason, code, payInfo} */
export async function startPack() {
  const pw = getAdminPw();
  const r = await call('/api/pack/start', { method: 'POST', body: { deviceId: getDeviceId() }, ...(pw ? { headers: { 'x-admin-password': pw } } : {}) });
  if (r.status === 402 || r.ok) return r.data;
  throw new Error(r.data?.message || '서버에 연결하지 못했어요. 잠시 후 다시 해주세요.');
}

// ── 관리자 ──
const ADMIN_KEY = 'emoji-maker-admin';
// 사장님 휴대폰에서는 한 번 들어가면 계속 관리자(무제한)로 유지. [이 기기에서 관리자 해제]로 지움
export const getAdminPw = () => {
  try {
    const old = sessionStorage.getItem(ADMIN_KEY);
    if (old && !localStorage.getItem(ADMIN_KEY)) { localStorage.setItem(ADMIN_KEY, old); sessionStorage.removeItem(ADMIN_KEY); }
    return localStorage.getItem(ADMIN_KEY) || '';
  } catch { return ''; }
};
export const setAdminPw = (pw) => { try { if (pw) localStorage.setItem(ADMIN_KEY, pw); else localStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ } };

const admin = (path, opts = {}) => call(`/api/admin/${path}`, { ...opts, headers: { 'x-admin-password': opts.pw ?? getAdminPw() } });
export const adminStats = (pw) => admin('stats', { pw });
export const adminCredit = (code, packs, memo) => admin('credit', { method: 'POST', body: { code, packs, memo } });
export const adminSamples = (items) => admin('samples', { method: 'POST', body: { items } });
export const adminDeleteSamples = (prefix) => admin('samples', { method: 'POST', body: { deletePrefix: prefix } });
export const adminConfig = (patch) => admin('config', { method: 'POST', body: patch });
