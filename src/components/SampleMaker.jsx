import { useMemo, useState } from 'react';
import { PACKS, packSet } from '../lib/expressions.js';
import { buildSheetPrompt } from '../lib/prompts.js';
import { generateImage } from '../lib/api.js';
import { sliceSheet, pieceToSticker, loadImage } from '../lib/imageTools.js';
import { startPack, adminSamples, adminDeleteSamples } from '../lib/server.js';
import { hasOwnSample, setServerSamples, useServerSamples } from '../lib/samples.js';
import { ExpressionThumb } from './ExpressionPicker.jsx';

// 기준 캐릭터: 사장님이 보내주신 3D 그림들 (얼굴·머리·옷 느낌을 맞추는 용도)
const REF_FILES = ['./samples/3d/love/love.webp', './samples/3d/love/ok.webp', './samples/3d/office/fighting.webp', './samples/3d/lc_done.webp'];

async function fileToRef(url) {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = img.width * 2; c.height = img.height * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { mime: 'image/jpeg', base64: c.toDataURL('image/jpeg', 0.92).split(',')[1] };
}
async function toThumb(dataUrl) {
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, 128, 128);
  const webp = c.toDataURL('image/webp', 0.88);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
}

/** 관리자: 그림이 없는 표정을 같은 캐릭터로 AI가 그려서 표정 구성 미리보기에 넣기 */
export default function SampleMaker({ notify }) {
  useServerSamples();
  const [style, setStyle] = useState('3d');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState({}); // packId → 상태 문구

  const packs = useMemo(() => PACKS.filter((p) => p.id !== 'basic').map((p) => {
    const set = packSet(p.id);
    const missing = set.filter((x) => !hasOwnSample(x.id, style, p.id)).length;
    return { ...p, set, missing };
  }), [style, busy]); // eslint-disable-line react-hooks/exhaustive-deps
  const todo = packs.filter((p) => p.missing > 0);

  const run = async (list) => {
    if (busy || !list.length) return;
    setBusy(true);
    try {
      const r = await startPack();
      if (!r?.ok) throw new Error('관리자 팩을 시작하지 못했어요. 관리자 비밀번호를 다시 넣어 주세요.');
      const settings = { provider: 'server', packToken: r.token };
      const refs = await Promise.all(REF_FILES.map(fileToRef));
      await Promise.all(list.map(async (p) => {
        const say = (t) => setLog((m) => ({ ...m, [p.id]: t }));
        try {
          say('그리는 중… (30초쯤)');
          const prompt = buildSheetPrompt({ category: 'person', style, bgMode: 'chroma', emotions: p.set })
            + '\nCHARACTER: draw exactly the same character as in ALL the reference images — same face, eyes, hairstyle and hair color, same body proportions. Keep a plain simple outfit unless the pose mentions one.';
          const raw = await generateImage({ settings, refs, prompt, shape: 'sheet', hedgeMs: 40000, onWait: (sec) => say(`잠시 대기 · ${sec}초 뒤 다시`) });
          say('오려내는 중…');
          const pieces = await sliceSheet(raw, 3, 4);
          const items = [];
          for (let i = 0; i < pieces.length; i++) {
            await new Promise((res) => setTimeout(res, 0));
            items.push({ k: `${style}/${p.id}/${p.set[i].id}`, data: await toThumb(pieceToSticker(pieces[i], true, 384)) });
          }
          say('저장하는 중…');
          const s = await adminSamples(items);
          if (!s.ok) throw new Error(s.data?.message || '저장 실패');
          setServerSamples(s.data);
          say(`완료 ✓ ${s.data.saved}장`);
        } catch (e) {
          say(`실패: ${e.short || e.message}`);
        }
      }));
      notify('표정 그림을 만들었어요. 마음에 안 드는 팩은 [다시]를 누르세요.');
    } catch (e) {
      notify(e.message);
    }
    setBusy(false);
  };

  const reset = async (p) => {
    if (busy) return;
    const r = await adminDeleteSamples(`${style}/${p.id}/`);
    if (r.ok) { setServerSamples(r.data); setLog((m) => ({ ...m, [p.id]: '지웠어요' })); }
  };

  return (
    <section>
      <h3 className="font-bold text-sm mb-1">표정 그림 만들기</h3>
      <p className="text-[11px] text-cocoa-400 mb-2 break-keep">
        표정 구성에 그림이 없는 표정을, 보내주신 캐릭터 얼굴로 AI가 그려서 넣어요. 팩 하나에 AI 1회(약 100원)예요. 만든 그림은 손님 화면에도 바로 보여요.
      </p>
      <div className="seg mb-2">
        {['3d', '2d'].map((s) => (
          <button key={s} className="seg-btn !py-1.5" aria-pressed={style === s} disabled={busy} onClick={() => setStyle(s)}>{s.toUpperCase()}</button>
        ))}
      </div>
      <ul className="space-y-1.5 mb-2">
        {packs.map((p) => (
          <li key={p.id} className="rounded-xl bg-cream-100 p-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold flex-1 min-w-0 truncate">{p.emoji} {p.label}</span>
              <span className={p.missing ? 'text-peach-600 font-bold' : 'text-cocoa-400'}>{p.missing ? `${p.missing}개 없음` : '그림 있음'}</span>
              <button disabled={busy} onClick={() => run([p])} className="font-bold text-peach-600 disabled:opacity-40">{p.missing ? '만들기' : '다시'}</button>
              <button disabled={busy} onClick={() => reset(p)} className="text-cocoa-400 disabled:opacity-40" aria-label={`${p.label} 만든 그림 지우기`}>지우기</button>
            </div>
            {log[p.id] && <p className="text-[11px] text-cocoa-600 mt-1">{log[p.id]}</p>}
            {log[p.id]?.startsWith('완료') && (
              <div className="grid grid-cols-6 gap-1 mt-1.5">
                {p.set.map((x) => <ExpressionThumb key={x.id} item={x} style={style} pack={p.id} small />)}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button onClick={() => run(todo)} disabled={busy || !todo.length} className="btn-primary w-full">
        {busy ? '그리는 중… 화면을 켜 두세요' : todo.length ? `빠진 그림 모두 만들기 (${todo.length}팩)` : '모든 팩에 그림이 있어요'}
      </button>
    </section>
  );
}

