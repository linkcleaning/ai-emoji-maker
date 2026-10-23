import { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, PackageOpen, Share2, LayoutGrid, Info } from 'lucide-react';
import Header from './components/Header.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Uploader from './components/Uploader.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import Gallery from './components/Gallery.jsx';
import StickerModal from './components/StickerModal.jsx';
import { CATEGORIES, STYLES, buildStickerPrompt, buildSheetPrompt } from './lib/prompts.js';
import { packSet, serializeSet, deserializeSet } from './lib/expressions.js';
import ExpressionPicker, { ExpressionBar } from './components/ExpressionPicker.jsx';
import LimitModal from './components/LimitModal.jsx';
import AdminModal from './components/AdminModal.jsx';
import { fetchServerConfig, fetchMe, startPack } from './lib/server.js';
import { PROVIDERS, generateImage, runPool } from './lib/api.js';
import { prepareUpload, processSticker, checkBackground, dataUrlToRef, toJpegRef, sliceSheet, pieceToSticker, composeSheet, resizeSticker } from './lib/imageTools.js';
import { downloadDataUrl, downloadZip, shareImages, safeName } from './lib/share.js';

const STORE_KEY = 'emoji-maker-settings-v1';
// 미리보기 빌드에서는 데모 모드로 시작 (빌드 시 __DEMO_DEFAULT__ 정의)
const IS_PREVIEW = typeof __DEMO_DEFAULT__ !== 'undefined';
const DEFAULT_SETTINGS = {
  provider: IS_PREVIEW ? 'demo' : 'gemini',
  geminiKey: '',
  openaiKey: '',
  geminiModel: PROVIDERS.gemini.models[0].id,
  openaiModel: PROVIDERS.openai.models[0].id,
  openaiQuality: 'medium',
  mode: 'individual',
  postprocess: true,
  sendSize: 200, // 카톡·문자로 보낼 크기(px). 0 = 원본
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // 종료/변경된 모델 ID는 현재 기본 모델로 교체
    if (!PROVIDERS.gemini.models.some((m) => m.id === s.geminiModel)) s.geminiModel = DEFAULT_SETTINGS.geminiModel;
    if (!PROVIDERS.openai.models.some((m) => m.id === s.openaiModel)) s.openaiModel = DEFAULT_SETTINGS.openaiModel;
    if (!PROVIDERS[s.provider]) s.provider = DEFAULT_SETTINGS.provider;
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function saveSettings(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경 */ }
}

const emptyStickers = (set) => set.map((e) => ({ ...e, status: 'idle', url: null, error: null }));

// 표정 구성 저장/불러오기 (이 기기에만)
const SET_KEY = 'emoji-maker-expressions-v1';
function loadSet() {
  try { return deserializeSet(JSON.parse(localStorage.getItem(SET_KEY))) || packSet('basic'); } catch { return packSet('basic'); }
}
function storeSet(set) {
  try { localStorage.setItem(SET_KEY, JSON.stringify(serializeSet(set))); } catch { /* 저장 불가 환경 */ }
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [category, setCategory] = useState('person');
  const [style, setStyle] = useState('3d');
  const [expSet, setExpSet] = useState(loadSet);
  const [showPicker, setShowPicker] = useState(false);
  const [stickers, setStickers] = useState(() => emptyStickers(loadSet()));
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [viewIdx, setViewIdx] = useState(null);
  const [toast, setToast] = useState(null);
  const [fatal, setFatal] = useState(null); // 키·할당량·모델 문제처럼 다시 해도 안 되는 오류
  // 서버(무료 이용) 모드
  const [serverCfg, setServerCfg] = useState(null); // 서버에서 열었으면 설정, 아니면 null
  const [me, setMe] = useState(null);                // 내 이용 코드·남은 무료·충전
  const [limit, setLimit] = useState(null);          // 한도 도달 안내
  const [showAdmin, setShowAdmin] = useState(false);
  const [serverProblem, setServerProblem] = useState(null); // 서버는 있는데 설정 미완료
  const packTokenRef = useRef(null);
  const [starting, setStarting] = useState(false);

  const abortRef = useRef(null);
  const anchorRef = useRef(null); // 일관성 유지를 위한 기준 캐릭터 이미지
  const optsRef = useRef({ category, style, set: expSet }); // 마지막 생성에 쓴 옵션 (개별 재생성용)
  const fatalRef = useRef(null); // 이번 실행에서 난 치명적 오류
  const wakeRef = useRef(null);

  const hasKey = PROVIDERS[settings.provider]?.noKey
    || (settings.provider === 'gemini' ? !!settings.geminiKey : !!settings.openaiKey);
  const isDemo = settings.provider === 'demo';
  const doneCount = stickers.filter((s) => s.status === 'done').length;
  const settledCount = stickers.filter((s) => s.status === 'done' || s.status === 'error').length;
  const hasResults = stickers.some((s) => s.status !== 'idle');

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(notify.t);
    notify.t = setTimeout(() => setToast(null), 2600);
  }, []);

  // 생성 중에는 화면이 꺼지지 않게 (화면 꺼지면 요청이 끊김)
  useEffect(() => {
    let cancelled = false;
    if (busy && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((l) => { if (cancelled) l.release(); else wakeRef.current = l; }).catch(() => {});
    }
    return () => { cancelled = true; wakeRef.current?.release?.().catch?.(() => {}); wakeRef.current = null; };
  }, [busy]);

  // 서버에서 열렸는지 확인 → 무료 이용 모드로 전환
  useEffect(() => {
    let alive = true;
    fetchServerConfig().then(async (res) => {
      let cfg = res;
      if (!alive) return;
      if (cfg && cfg.problem) { setServerProblem(cfg.problem); cfg = null; }
      setServerCfg(cfg);
      if (cfg) {
        setSettings((s) => (s.provider === 'gemini' && !s.geminiKey) || s.provider === 'demo' && !IS_PREVIEW ? { ...s, provider: 'server' } : s);
        fetchMe().then((m) => alive && m && setMe(m)).catch(() => {});
        if (location.hash === '#admin') setShowAdmin(true);
      } else {
        setSettings((s) => (s.provider === 'server' ? { ...s, provider: 'gemini' } : s));
      }
    });
    return () => { alive = false; };
  }, []);
  const isServer = settings.provider === 'server';
  const runSettings = () => ({ ...settings, packToken: packTokenRef.current });

  const patch = (i, obj) => setStickers((arr) => arr.map((s, k) => (k === i ? { ...s, ...obj } : s)));

  const onFile = async (file) => {
    try {
      setPhoto(await prepareUpload(file));
    } catch (e) {
      notify(e.message);
    }
  };

  /** 감정 1개 생성 */
  const generateOne = async (i, { signal, opts }) => {
    const bgMode = settings.postprocess ? PROVIDERS[settings.provider].bgMode : 'baked';
    const refs = photo ? [{ mime: photo.mime, base64: photo.base64 }] : [];
    if (anchorRef.current) refs.push(anchorRef.current);
    const makePrompt = (fixFrame) => buildStickerPrompt({
      category: opts.category, style: opts.style, emotion: opts.set[i], bgMode, hasAnchor: !!anchorRef.current, fixFrame,
    });
    patch(i, { status: 'loading', error: null });
    try {
      const gen = (fixFrame) => generateImage({
        settings: runSettings(), refs, prompt: makePrompt(fixFrame), shape: 'square', signal, meta: { ...opts, index: opts.set[i].demo ?? i },
        onWait: (sec, e) => setStage(`${e.short || '잠시 대기'} · ${sec}초 뒤 자동 재시도`),
      });
      let raw = await gen(false);
      // AI가 액자·카드를 그렸으면 최대 2번 다시 그리게 함 (그래도 남으면 앱이 벗겨냄)
      if (settings.postprocess && settings.provider !== 'demo') {
        for (let t = 0; t < 2; t++) {
          const chk = await checkBackground(raw);
          if (chk.ok) break;
          setStage(`${opts.set[i].label}: 배경에 테두리가 생겨 다시 그리는 중`);
          raw = await gen(true);
        }
      }
      const url = await processSticker(raw, { postprocess: settings.postprocess });
      patch(i, { status: 'done', url, raw });
      return raw;
    } catch (e) {
      if (e.name === 'AbortError') { patch(i, { status: 'idle' }); throw e; }
      patch(i, { status: 'error', error: e.short || '생성 실패', detail: e.message });
      if (e.fatal) { // 나머지 요청도 즉시 중단
        fatalRef.current = e;
        abortRef.current?.abort();
        throw e;
      }
      return null;
    }
  };

  const start = async () => {
    if (!photo && !isDemo) return notify('먼저 사진을 올려주세요.');
    if (!hasKey) { setShowSettings(true); return notify('API 키를 먼저 입력해 주세요.'); }

    // 무료 이용: 서버에서 1팩 차감하고 이번 팩 전용 토큰을 받음 (한도면 입금 안내)
    if (isServer) {
      if (starting) return;
      setStarting(true);
      let r;
      try { r = await startPack(); } catch (e) { setStarting(false); return notify(e.message); }
      setStarting(false);
      setMe(r);
      if (!r.ok) { setLimit(r); return; }
      packTokenRef.current = r.token;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    anchorRef.current = null;
    optsRef.current = { category, style, set: expSet };
    const opts = optsRef.current;
    setStickers(emptyStickers(expSet));
    setFatal(null);
    fatalRef.current = null;
    setBusy(true);

    try {
      if (settings.mode === 'sheet') {
        setStage('스티커 시트 그리는 중');
        setStickers((arr) => arr.map((s) => ({ ...s, status: 'loading' })));
        const bgMode = settings.postprocess ? PROVIDERS[settings.provider].bgMode : 'baked';
        const raw = await generateImage({
          settings: runSettings(),
          refs: photo ? [{ mime: photo.mime, base64: photo.base64 }] : [],
          prompt: buildSheetPrompt({ ...opts, bgMode, emotions: opts.set }),
          shape: 'sheet',
          signal: ctrl.signal,
          meta: opts,
          onWait: (sec, e) => setStage(`${e.short || '잠시 대기'} · ${sec}초 뒤 자동 재시도`),
        });
        anchorRef.current = await toJpegRef(raw);
        setStage('스티커 오려내는 중');
        const pieces = await sliceSheet(raw, 3, 4);
        setStickers((arr) => arr.map((s, i) => ({ ...s, status: 'done', url: pieceToSticker(pieces[i], settings.postprocess) })));
      } else {
        // 1) 기준 캐릭터(첫 스티커) — 실패 시 1회 재시도
        setStage('캐릭터 디자인 중');
        let raw0 = await generateOne(0, { signal: ctrl.signal, opts });
        if (!raw0) raw0 = await generateOne(0, { signal: ctrl.signal, opts });
        if (raw0) anchorRef.current = await toJpegRef(raw0);

        // 2) 나머지 11종을 기준 캐릭터와 함께 2개씩 동시 생성 (요청 몰림 방지)
        setStage('표정 만드는 중');
        const rest = opts.set.map((_, i) => i).slice(1);
        await runPool(rest, settings.provider === 'demo' ? 3 : 2, (i) => generateOne(i, { signal: ctrl.signal, opts }), ctrl.signal);
        if (ctrl.signal.aborted) throw fatalRef.current || new DOMException('Aborted', 'AbortError');
      }
      setStage('완성!');
      setStickers((arr) => {
        const failed = arr.filter((x) => x.status === 'error').length;
        notify(failed ? `${12 - failed}장 완성, ${failed}장은 실패했어요. [실패한 것만 다시]를 눌러주세요.` : '이모티콘 팩이 완성됐어요 🎉');
        return arr;
      });
    } catch (err) {
      const e = fatalRef.current || err;
      if (e.name === 'AbortError') {
        notify('생성을 중단했어요.');
        setStickers((arr) => arr.map((s) => (s.status === 'loading' ? { ...s, status: 'idle' } : s)));
      } else {
        if (e.fatal) {
          // 이미 완성된 스티커는 그대로 두고, 진행 중이던 칸만 비움
          setFatal({ message: e.message, help: e.help, detail: e.detail });
          setStickers((arr) => arr.map((s) => (s.status === 'loading' ? { ...s, status: 'idle' } : s)));
        } else {
          setStickers((arr) => arr.map((s) => (s.status === 'loading' ? { ...s, status: 'error', error: e.short || '생성 실패', detail: e.message } : s)));
          notify(e.message);
        }
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  // 미리보기: 열자마자 예시 팩이 보이도록 자동 생성
  useEffect(() => {
    if (IS_PREVIEW && isDemo) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = async (i) => {
    if ((!photo && !isDemo) || busy) return;
    if (isServer && !packTokenRef.current) return notify('[새로 만들기]로 새 팩을 시작해 주세요.');
    if (!hasKey) return setShowSettings(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setStage(`${optsRef.current.set[i].label} 다시 그리는 중`);
    try {
      const raw = await generateOne(i, { signal: ctrl.signal, opts: optsRef.current });
      if (raw && !anchorRef.current) anchorRef.current = await toJpegRef(raw);
      if (raw) setFatal(null);
    } catch (e) {
      if (e?.fatal) setFatal({ message: e.message, help: e.help, detail: e.detail });
    }
    setBusy(false);
    abortRef.current = null;
  };

  /** 실패한 칸만 모아서 다시 생성 */
  const retryFailed = async () => {
    if (busy) return;
    if (isServer && !packTokenRef.current) return notify('[새로 만들기]로 새 팩을 시작해 주세요.');
    const idx = stickers.map((x, i) => (x.status === 'error' ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fatalRef.current = null;
    setFatal(null);
    setBusy(true);
    setStage('실패한 것 다시 만드는 중');
    try {
      if (!anchorRef.current && idx.includes(0)) {
        const raw0 = await generateOne(0, { signal: ctrl.signal, opts: optsRef.current });
        if (raw0) anchorRef.current = await toJpegRef(raw0);
      }
      await runPool(idx.filter((i) => i !== 0 || !anchorRef.current), 2, (i) => generateOne(i, { signal: ctrl.signal, opts: optsRef.current }), ctrl.signal);
    } catch { /* 아래에서 처리 */ }
    const fe = fatalRef.current;
    if (fe) setFatal({ message: fe.message, help: fe.help, detail: fe.detail });
    setStickers((arr) => arr.map((x) => (x.status === 'loading' ? { ...x, status: 'idle' } : x)));
    setBusy(false);
    abortRef.current = null;
  };
  const failedCount = stickers.filter((x) => x.status === 'error').length;

  // ── 내보내기 ─────────────────────────────
  const fileName = (s, i) => `emoji_${String(i + 1).padStart(2, '0')}_${safeName(s.id)}.png`;
  const sendSize = settings.sendSize ?? 200;
  const setSendSize = (v) => { const s = { ...settings, sendSize: v }; setSettings(s); saveSettings(s); };
  // 공유 버튼을 누른 순간 바로 보낼 수 있게(아이폰은 지연되면 공유가 막힘) 미리 줄여둠
  const [sizedMap, setSizedMap] = useState({});
  useEffect(() => {
    let alive = true;
    const urls = stickers.map((s) => s.url).filter(Boolean);
    Promise.all(urls.map(async (u) => [u, await resizeSticker(u, sendSize)])).then((pairs) => {
      if (alive) setSizedMap(Object.fromEntries(pairs.map(([u, v]) => [`${sendSize}|${u}`, v])));
    });
    return () => { alive = false; };
  }, [stickers, sendSize]);
  const sized = async (url) => sizedMap[`${sendSize}|${url}`] || resizeSticker(url, sendSize); // 보낼 크기로 줄인 PNG
  const saveOne = async (i) => downloadDataUrl(await sized(stickers[i].url), fileName(stickers[i], i));
  const shareOne = async (i) => {
    const r = await shareImages([{ url: await sized(stickers[i].url), name: fileName(stickers[i], i) }]);
    if (r === 'unsupported') { await saveOne(i); notify('이 브라우저는 공유를 지원하지 않아 저장했어요.'); }
  };
  const zipAll = async () => {
    const urls = stickers.map((s) => s.url);
    const sheet = await composeSheet(urls);
    const small = await Promise.all(stickers.map(async (s) => ({ ...s, url: s.url ? await sized(s.url) : null })));
    // ZIP: 보낼 크기 + 원본(768px) 둘 다 담음
    await downloadZip(small, 'ai-emoji-pack.zip', sheet, sendSize ? stickers : null);
    notify('ZIP 다운로드를 시작했어요.');
  };
  const saveSheet = async () => {
    downloadDataUrl(await composeSheet(stickers.map((s) => s.url)), 'ai-emoji-sheet.png');
  };
  const shareAll = async () => {
    const items = (await Promise.all(stickers.map(async (s, i) => (s.url ? { url: await sized(s.url), name: fileName(s, i) } : null)))).filter(Boolean);
    const r = await shareImages(items);
    if (r === 'unsupported') { await zipAll(); notify('공유 미지원 브라우저라 ZIP으로 저장했어요.'); }
  };

  const nav = (d) => {
    const done = stickers.map((s, i) => (s.status === 'done' ? i : -1)).filter((i) => i >= 0);
    const pos = done.indexOf(viewIdx);
    setViewIdx(done[(pos + d + done.length) % done.length]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (viewIdx === null) return;
      if (e.key === 'Escape') setViewIdx(null);
      if (e.key === 'ArrowRight') nav(1);
      if (e.key === 'ArrowLeft') nav(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="min-h-[100dvh] w-full overflow-x-clip">
      <Header onOpenSettings={() => setShowSettings(true)} hasKey={hasKey} />

      <main className="mx-auto max-w-xl px-4 pt-5 pb-28 space-y-5">
        {!hasKey && (
          <button onClick={() => setShowSettings(true)} className="w-full card p-4 flex items-center gap-3 text-left">
            <span className="w-10 h-10 rounded-xl bg-peach-300/40 grid place-items-center text-xl">🔑</span>
            <span className="flex-1">
              <span className="block font-bold text-sm">API 키를 먼저 등록해 주세요</span>
              <span className="block text-xs text-cocoa-400">Gemini 또는 OpenAI 키 — 내 기기에만 저장돼요</span>
            </span>
          </button>
        )}

        {serverProblem === 'not_configured' && (
          <div className="rounded-3xl border-2 border-peach-300 bg-white p-4 text-sm leading-relaxed" role="alert">
            <p className="font-bold mb-1">⚙️ 서버 설정이 아직 안 끝났어요</p>
            <p className="text-xs text-cocoa-600 break-keep">
              Cloudflare → ai-emoji-maker → Settings → Variables and Secrets 에 <b>GEMINI_API_KEY</b>(Secret)가 없어요.
              넣고 배포하면 이 안내가 사라지고 무료 이용이 시작돼요. (그 전까지는 각자 API 키로만 쓸 수 있어요)
            </p>
          </div>
        )}

        {isDemo && (
          <div className="rounded-3xl bg-white/70 border border-cream-200 p-4 text-sm leading-relaxed">
            <p className="font-bold mb-1">🧪 데모 모드로 보고 있어요</p>
            <p className="text-xs text-cocoa-600">
              AI 대신 앱이 그린 예시 캐릭터로 화면과 흐름을 보여줘요. 배경 제거와 흰 테두리 처리는 실제와 같아요.
              {IS_PREVIEW ? ' 미리보기 화면에서는 저장·공유가 막혀 있어요. 실제 사진으로 만들려면 배포 주소에서 API 키를 넣어주세요.' : ' ⚙️ 설정에서 Gemini 또는 OpenAI를 고르면 진짜 내 사진으로 만들어져요.'}
            </p>
          </div>
        )}

        {/* 업로드 & 옵션 */}
        <section className="card p-4 space-y-4">
          <Uploader photo={photo} onFile={onFile} disabled={busy} />

          <div>
            <span className="label">누구를 그릴까요?</span>
            <div className="seg">
              {CATEGORIES.map((c) => (
                <button key={c.id} disabled={busy} className="seg-btn" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                  <span className="mr-1">{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">스타일</span>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  onClick={() => setStyle(s.id)}
                  aria-pressed={style === s.id}
                  className={`rounded-2xl p-3 text-left border-2 transition ${
                    style === s.id ? 'border-peach-400 bg-peach-300/15' : 'border-cream-200 bg-cream-50'
                  }`}
                >
                  <span className="text-2xl block mb-1">{s.id === '3d' ? '🧸' : '🎨'}</span>
                  <span className="block font-bold text-sm">{s.label}</span>
                  <span className="block text-[11px] text-cocoa-400">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <ExpressionBar
            set={expSet}
            disabled={busy}
            onOpen={() => setShowPicker(true)}
            onChange={(set) => { setExpSet(set); storeSet(set); if (!hasResults) setStickers(emptyStickers(set)); }}
          />

          <button onClick={start} disabled={busy || starting || (!photo && !isDemo)} className="btn-primary w-full !py-4 !text-base">
            <Wand2 size={19} /> {hasResults ? '새로 만들기' : '이모티콘 12종 만들기'}
          </button>
          <p className="text-[11px] text-center text-cocoa-400 -mt-2">
            {isServer && me
              ? <>오늘 무료 <b className="text-cocoa-600">{me.freeLeft}/{me.freePerDay}팩</b> 남음{me.credit > 0 && <> · 충전 <b className="text-cocoa-600">{me.credit}팩</b></>} · 내 코드 <span className="font-mono">{me.code}</span></>
              : <>{PROVIDERS[settings.provider].label}{isDemo && !photo ? ' · 사진 없이도 체험 가능' : ''} · {settings.mode === 'individual' ? '개별 12장 생성' : '시트 1장 생성'}</>}
          </p>
        </section>

        {fatal && !busy && (
          <section className="rounded-3xl border-2 border-peach-300 bg-white p-4" role="alert">
            <p className="font-bold text-sm mb-1">⚠️ 이모티콘을 만들 수 없어요</p>
            <p className="text-sm text-cocoa-600 leading-relaxed">{fatal.message}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {fatal.help && (
                <a href={fatal.help.url} target="_blank" rel="noreferrer" className="btn-primary !py-2.5">{fatal.help.label}</a>
              )}
              <button onClick={() => setShowSettings(true)} className="btn-ghost !py-2.5">설정 열기</button>
            </div>
            {fatal.detail && (
              <details className="mt-3 text-[11px] text-cocoa-400">
                <summary className="cursor-pointer">자세한 오류 내용</summary>
                <p className="mt-1 break-words">{fatal.detail}</p>
              </details>
            )}
          </section>
        )}

        {busy && <ProgressPanel done={settledCount} total={12} stage={stage} onCancel={cancel} icons={stickers.map((x) => x.icon)} />}

        {/* 결과 갤러리 */}
        {hasResults && (
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl">내 이모티콘 팩</h2>
              <span className="text-xs font-bold text-cocoa-400">{doneCount}/12 완성</span>
            </div>
            {doneCount > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-cocoa-400 shrink-0">보낼 크기</span>
                <div className="seg flex-1 !p-0.5">
                  {[[160, '아주 작게'], [200, '작게'], [360, '보통'], [0, '원본']].map(([v, l]) => (
                    <button key={v} className="seg-btn !py-1.5 !text-xs" aria-pressed={sendSize === v} onClick={() => setSendSize(v)}>{l}</button>
                  ))}
                </div>
              </div>
            )}
            {failedCount > 0 && !busy && (
              <button onClick={retryFailed} className="btn-ghost w-full mb-3 !border-2 !border-peach-300">
                실패한 것만 다시 ({failedCount}장)
              </button>
            )}
            <div className="rounded-2xl bg-cream-100 p-3">
              <Gallery stickers={stickers} onOpen={setViewIdx} onRetry={retry} busy={busy} />
            </div>
            {doneCount > 0 && (
              <p className="text-[11px] text-cocoa-400 mt-3 flex items-center gap-1">
                <Info size={12} /> 스티커를 누르면 크게 보고 개별 저장·공유·재생성할 수 있어요.
              </p>
            )}
          </section>
        )}

        <footer className="text-center text-[11px] text-cocoa-400 pt-2">
          업로드한 사진은 이미지 생성을 위해 선택한 AI 서비스로만 전송돼요.
        </footer>
      </main>

      {/* 하단 고정 액션바 */}
      {doneCount > 0 && !busy && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-cream-100/90 backdrop-blur-md border-t border-cream-200 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-xl px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-2">
            <button onClick={zipAll} className="btn-primary"><PackageOpen size={17} /> 전체 ZIP</button>
            <button onClick={saveSheet} className="btn-ghost" aria-label="시트 이미지 저장"><LayoutGrid size={17} /> 시트</button>
            <button onClick={shareAll} className="btn-ghost" aria-label="공유"><Share2 size={17} /> 공유</button>
          </div>
        </div>
      )}

      {viewIdx !== null && stickers[viewIdx]?.url && (
        <StickerModal
          sticker={stickers[viewIdx]}
          index={viewIdx}
          total={12}
          busy={busy}
          onClose={() => setViewIdx(null)}
          onNav={nav}
          onSave={() => saveOne(viewIdx)}
          onShare={() => shareOne(viewIdx)}
          onRegenerate={() => { const i = viewIdx; setViewIdx(null); retry(i); }}
        />
      )}

      {limit && (
        <LimitModal
          info={limit}
          onClose={() => setLimit(null)}
          onRecheck={async () => {
            const m = await fetchMe().catch(() => null);
            if (!m) return notify('서버에 연결하지 못했어요.');
            setMe(m);
            if (m.credit > 0 || m.freeLeft > 0) { setLimit(null); notify(m.credit > 0 ? `충전 확인! ${m.credit}팩 사용할 수 있어요.` : '다시 만들 수 있어요.'); }
            else notify('아직 충전 전이에요. 입금 확인 후 다시 눌러주세요.');
          }}
        />
      )}

      {showAdmin && <AdminModal onClose={() => { setShowAdmin(false); if (location.hash === '#admin') history.replaceState(null, '', location.pathname); }} notify={notify} />}

      {showPicker && (
        <ExpressionPicker
          set={expSet}
          onClose={() => setShowPicker(false)}
          onSave={(set) => { setExpSet(set); storeSet(set); if (!hasResults) setStickers(emptyStickers(set)); setShowPicker(false); notify('표정 구성을 바꿨어요. [새로 만들기]를 누르면 적용돼요.'); }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          serverInfo={serverCfg}
          onAdmin={() => { setShowSettings(false); setShowAdmin(true); }}
          onClose={() => setShowSettings(false)}
          onSave={(s) => { setSettings(s); saveSettings(s); setShowSettings(false); notify('설정을 저장했어요.'); }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="px-4 py-2.5 rounded-2xl bg-cocoa-800 text-white text-sm shadow-lg pop max-w-full text-center break-keep">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
