import { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, PackageOpen, Share2, LayoutGrid, Info } from 'lucide-react';
import Header from './components/Header.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Uploader from './components/Uploader.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import Gallery from './components/Gallery.jsx';
import StickerModal from './components/StickerModal.jsx';
import { CATEGORIES, STYLES, EMOTIONS, buildStickerPrompt, buildSheetPrompt } from './lib/prompts.js';
import { PROVIDERS, generateImage, runPool } from './lib/api.js';
import { prepareUpload, processSticker, dataUrlToRef, sliceSheet, pieceToSticker, composeSheet } from './lib/imageTools.js';
import { downloadDataUrl, downloadZip, shareImages } from './lib/share.js';

const STORE_KEY = 'emoji-maker-settings-v1';
const DEFAULT_SETTINGS = {
  provider: 'gemini',
  geminiKey: '',
  openaiKey: '',
  geminiModel: PROVIDERS.gemini.models[0].id,
  openaiModel: PROVIDERS.openai.models[0].id,
  openaiQuality: 'medium',
  mode: 'individual',
  postprocess: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function saveSettings(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경 */ }
}

const emptyStickers = () => EMOTIONS.map((e) => ({ ...e, status: 'idle', url: null, error: null }));

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [category, setCategory] = useState('person');
  const [style, setStyle] = useState('3d');
  const [stickers, setStickers] = useState(emptyStickers);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [viewIdx, setViewIdx] = useState(null);
  const [toast, setToast] = useState(null);

  const abortRef = useRef(null);
  const anchorRef = useRef(null); // 일관성 유지를 위한 기준 캐릭터 이미지
  const optsRef = useRef({ category, style }); // 마지막 생성에 쓴 옵션 (개별 재생성용)

  const hasKey = settings.provider === 'gemini' ? !!settings.geminiKey : !!settings.openaiKey;
  const doneCount = stickers.filter((s) => s.status === 'done').length;
  const settledCount = stickers.filter((s) => s.status === 'done' || s.status === 'error').length;
  const hasResults = stickers.some((s) => s.status !== 'idle');

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(notify.t);
    notify.t = setTimeout(() => setToast(null), 2600);
  }, []);

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
    const refs = [{ mime: photo.mime, base64: photo.base64 }];
    if (anchorRef.current) refs.push(anchorRef.current);
    const prompt = buildStickerPrompt({
      category: opts.category, style: opts.style, emotion: EMOTIONS[i], bgMode, hasAnchor: !!anchorRef.current,
    });
    patch(i, { status: 'loading', error: null });
    try {
      const raw = await generateImage({ settings, refs, prompt, shape: 'square', signal });
      const url = await processSticker(raw, { postprocess: settings.postprocess });
      patch(i, { status: 'done', url });
      return raw;
    } catch (e) {
      if (e.name === 'AbortError') { patch(i, { status: 'idle' }); throw e; }
      patch(i, { status: 'error', error: e.message });
      return null;
    }
  };

  const start = async () => {
    if (!photo) return notify('먼저 사진을 올려주세요.');
    if (!hasKey) { setShowSettings(true); return notify('API 키를 먼저 입력해 주세요.'); }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    anchorRef.current = null;
    optsRef.current = { category, style };
    const opts = optsRef.current;
    setStickers(emptyStickers());
    setBusy(true);

    try {
      if (settings.mode === 'sheet') {
        setStage('스티커 시트 그리는 중');
        setStickers((arr) => arr.map((s) => ({ ...s, status: 'loading' })));
        const bgMode = settings.postprocess ? PROVIDERS[settings.provider].bgMode : 'baked';
        const raw = await generateImage({
          settings,
          refs: [{ mime: photo.mime, base64: photo.base64 }],
          prompt: buildSheetPrompt({ ...opts, bgMode }),
          shape: 'sheet',
          signal: ctrl.signal,
        });
        anchorRef.current = dataUrlToRef(raw);
        setStage('스티커 오려내는 중');
        const pieces = await sliceSheet(raw, 3, 4);
        setStickers((arr) => arr.map((s, i) => ({ ...s, status: 'done', url: pieceToSticker(pieces[i], settings.postprocess) })));
      } else {
        // 1) 기준 캐릭터(첫 스티커) — 실패 시 1회 재시도
        setStage('캐릭터 디자인 중');
        let raw0 = await generateOne(0, { signal: ctrl.signal, opts });
        if (!raw0) raw0 = await generateOne(0, { signal: ctrl.signal, opts });
        if (raw0) anchorRef.current = dataUrlToRef(raw0);

        // 2) 나머지 11종을 기준 캐릭터와 함께 3개씩 동시 생성
        setStage('표정 만드는 중');
        const rest = EMOTIONS.map((_, i) => i).slice(1);
        await runPool(rest, 3, (i) => generateOne(i, { signal: ctrl.signal, opts }));
      }
      setStage('완성!');
      notify('이모티콘 팩이 완성됐어요 🎉');
    } catch (e) {
      if (e.name === 'AbortError') {
        notify('생성을 중단했어요.');
        setStickers((arr) => arr.map((s) => (s.status === 'loading' ? { ...s, status: 'idle' } : s)));
      } else {
        setStickers((arr) => arr.map((s) => (s.status === 'loading' ? { ...s, status: 'error', error: e.message } : s)));
        notify(e.message);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const retry = async (i) => {
    if (!photo || busy) return;
    if (!hasKey) return setShowSettings(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setStage(`${EMOTIONS[i].label} 다시 그리는 중`);
    try {
      const raw = await generateOne(i, { signal: ctrl.signal, opts: optsRef.current });
      if (raw && !anchorRef.current) anchorRef.current = dataUrlToRef(raw);
    } catch { /* 중단 */ }
    setBusy(false);
    abortRef.current = null;
  };

  // ── 내보내기 ─────────────────────────────
  const fileName = (s, i) => `emoji_${String(i + 1).padStart(2, '0')}_${s.id}.png`;
  const saveOne = (i) => downloadDataUrl(stickers[i].url, fileName(stickers[i], i));
  const shareOne = async (i) => {
    const r = await shareImages([{ url: stickers[i].url, name: fileName(stickers[i], i) }]);
    if (r === 'unsupported') { saveOne(i); notify('이 브라우저는 공유를 지원하지 않아 저장했어요.'); }
  };
  const zipAll = async () => {
    const urls = stickers.map((s) => s.url);
    const sheet = await composeSheet(urls);
    await downloadZip(stickers, 'ai-emoji-pack.zip', sheet);
    notify('ZIP 다운로드를 시작했어요.');
  };
  const saveSheet = async () => {
    downloadDataUrl(await composeSheet(stickers.map((s) => s.url)), 'ai-emoji-sheet.png');
  };
  const shareAll = async () => {
    const items = stickers.map((s, i) => (s.url ? { url: s.url, name: fileName(s, i) } : null)).filter(Boolean);
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
    <div className="min-h-screen">
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

          <button onClick={start} disabled={busy || !photo} className="btn-primary w-full !py-4 !text-base">
            <Wand2 size={19} /> {hasResults ? '새로 만들기' : '이모티콘 12종 만들기'}
          </button>
          <p className="text-[11px] text-center text-cocoa-400 -mt-2">
            {PROVIDERS[settings.provider].label} · {settings.mode === 'individual' ? '개별 12장 생성' : '시트 1장 생성'}
          </p>
        </section>

        {busy && <ProgressPanel done={settledCount} total={12} stage={stage} onCancel={cancel} />}

        {/* 결과 갤러리 */}
        {hasResults && (
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl">내 이모티콘 팩</h2>
              <span className="text-xs font-bold text-cocoa-400">{doneCount}/12 완성</span>
            </div>
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

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => { setSettings(s); saveSettings(s); setShowSettings(false); notify('설정을 저장했어요.'); }}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 rounded-full bg-cocoa-800 text-white text-sm shadow-lg pop max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
