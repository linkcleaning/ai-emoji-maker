// ─────────────────────────────────────────────────────────────
// 내 이모티콘 보관함: 만든 팩을 이 휴대폰(앱) 안에 저장 — 사진첩에 쌓이지 않음
// IndexedDB 사용 (서버로 보내지 않음). 막힌 환경에서는 조용히 동작 안 함
// ─────────────────────────────────────────────────────────────
const DB = 'jjigeo-vault', STORE = 'packs';

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

/** 팩 저장(같은 id면 덮어씀). stickers: [{id,label,text,icon,url}] */
export async function savePack(pack) {
  const clean = {
    ...pack,
    stickers: pack.stickers.filter((s) => s.url).map(({ id, label, text, icon, url }) => ({ id, label, text, icon, url })),
  };
  if (!clean.stickers.length) return;
  try { await tx('readwrite', (s) => s.put(clean)); } catch { /* 저장 불가 환경 */ }
}
export async function listPacks() {
  try {
    const all = (await tx('readonly', (s) => s.getAll())) || [];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch { return []; }
}
export async function deletePack(id) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch { /* 무시 */ }
}
export const newPackId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
