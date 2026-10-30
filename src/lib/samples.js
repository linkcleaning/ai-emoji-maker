// ─────────────────────────────────────────────────────────────
// 표정 미리보기 그림 찾기
//  1) 관리자가 앱에서 만든 그림(서버 저장, 팩별)  2) 앱에 들어 있는 그림(팩 전용 → 공용)
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

const BASIC_IDS = ['hello', 'love', 'fighting', 'panic', 'angry', 'sad', 'tired', 'question', 'party', 'sleep', 'cool', 'ok'];
const STATIC = {
  '3d': new Set([
    ...BASIC_IDS,
    'jealous', 'good_morning', 'good_night', 'hug_me', 'shy', 'finger_heart', 'kiss', 'miss_you',
    'commute', 'coffee', 'yes_sir', 'thanks_bow', 'sorry_bow', 'report', 'lunch', 'overtime', 'payday', 'leave_work', 'headache',
    'lc_booking', 'lc_go', 'lc_arrive', 'lc_working', 'lc_sparkle', 'lc_done', 'lc_mold', 'lc_dust', 'lc_check', 'lc_movein', 'lc_thanks', 'lc_again',
  ]),
  '2d': new Set(BASIC_IDS),
};
// 기본 팩과 같은 표정이라도 그 팩을 고르면 그 팩 캐릭터로 (팩 안에서 그림이 섞이지 않게)
const STATIC_PACK = { '3d': { love: ['love', 'sad', 'angry', 'ok'], office: ['fighting'] } };

let server = { keys: new Set(), v: 0 };
const subs = new Set();
let loaded = false;

export async function loadServerSamples() {
  try {
    const res = await fetch('/api/samples', { cache: 'no-store' });
    if (!(res.headers.get('content-type') || '').includes('application/json')) return;
    const d = await res.json();
    server = { keys: new Set(d.keys || []), v: d.v || 0 };
    subs.forEach((f) => f(server));
  } catch { /* 서버 없음(깃허브 페이지 등) */ }
}
export function setServerSamples(d) {
  server = { keys: new Set(d.keys || []), v: d.v || 0 };
  subs.forEach((f) => f(server));
}

/** 서버 그림 목록이 바뀌면 다시 그리기 */
export function useServerSamples() {
  const [s, set] = useState(server);
  useEffect(() => {
    subs.add(set);
    if (!loaded) { loaded = true; loadServerSamples(); }
    return () => subs.delete(set);
  }, []);
  return s;
}

const srv = (k) => `/api/samples/${k}.img?v=${server.v}`;

/** 이 표정의 미리보기 그림 주소 (없으면 null → 아이콘) */
export function sampleSrc(id, style = '3d', pack = null) {
  if (pack && server.keys.has(`${style}/${pack}/${id}`)) return srv(`${style}/${pack}/${id}`);
  if (pack && STATIC_PACK[style]?.[pack]?.includes(id)) return `./samples/${style}/${pack}/${id}.webp`;
  if (STATIC[style]?.has(id)) return `./samples/${style}/${id}.webp`;
  for (const k of server.keys) if (k.startsWith(`${style}/`) && k.endsWith(`/${id}`)) return srv(k);
  return null;
}

/** 이 팩에서 그림이 없는 표정 수 (관리자 '표정 그림 만들기'용) */
export function hasOwnSample(id, style, pack) {
  return server.keys.has(`${style}/${pack}/${id}`) || !!STATIC_PACK[style]?.[pack]?.includes(id) || (STATIC[style]?.has(id) && (pack === 'basic' || !BASIC_IDS.includes(id)));
}
