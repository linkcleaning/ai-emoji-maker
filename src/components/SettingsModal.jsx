import { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';
import { PROVIDERS } from '../lib/api.js';

export default function SettingsModal({ settings, onSave, onClose, serverInfo, onAdmin }) {
  const [s, setS] = useState(settings);
  const [show, setShow] = useState(false);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const prov = PROVIDERS[s.provider];
  const keyField = s.provider === 'gemini' ? 'geminiKey' : 'openaiKey';
  const modelField = s.provider === 'gemini' ? 'geminiModel' : s.provider === 'server' ? 'serverModel' : 'openaiModel';
  const SHORT = { server: '무료 이용', demo: '데모', gemini: 'Gemini 키', openai: 'OpenAI 키' };

  return (
    <div className="fixed inset-0 z-50 bg-cocoa-800/40 grid place-items-end sm:place-items-center" onClick={onClose}>
      <div
        className="card w-full sm:max-w-md rounded-b-none sm:rounded-3xl p-5 max-h-[90dvh] overflow-y-auto overscroll-contain pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl flex items-center gap-2"><KeyRound size={20} className="text-peach-500" /> API 설정</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1"><X size={22} /></button>
        </div>

        <span className="label">AI 엔진</span>
        <div className="seg mb-4 flex-wrap">
          {Object.entries(PROVIDERS).filter(([, p]) => !p.serverOnly || serverInfo).map(([id]) => (
            <button key={id} className="seg-btn min-w-[44%] sm:min-w-0" aria-pressed={s.provider === id} onClick={() => set('provider', id)}>
              {SHORT[id]}
            </button>
          ))}
        </div>

        {s.provider === 'server' ? (
          <>
            <p className="text-xs text-cocoa-600 bg-cream-50 rounded-xl p-3 mb-4 leading-relaxed break-keep">
              API 키 없이 바로 만들어요. <b>하루 {serverInfo?.freePerDay ?? 2}팩 무료</b>이고, 더 만들려면 입금 후 이용 코드를 알려주시면 풀어드려요.
            </p>
            <label className="label" htmlFor="model">모델</label>
            <select id="model" className="input mb-4" value={s.serverModel || prov.models[0].id} onChange={(e) => set('serverModel', e.target.value)}>
              {prov.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </>
        ) : prov.noKey ? (
          <p className="text-xs text-cocoa-600 bg-cream-50 rounded-xl p-3 mb-4">데모 모드는 API 키 없이 예시 캐릭터로 화면을 체험해요. 실제 사진으로 만들려면 Gemini 또는 OpenAI를 고르세요.</p>
        ) : (<>
        <label className="label" htmlFor="apikey">{prov.label} API Key</label>
        <div className="relative mb-1">
          <input
            id="apikey"
            className="input pr-10 font-mono"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            placeholder={s.provider === 'gemini' ? 'AIza...' : 'sk-...'}
            value={s[keyField]}
            onChange={(e) => set(keyField, e.target.value.trim())}
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-cocoa-400" onClick={() => setShow((v) => !v)} aria-label="키 보기">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <a href={prov.keyUrl} target="_blank" rel="noreferrer" className="text-xs text-peach-600 inline-flex items-center gap-1 mb-4">
          API 키 발급받기 <ExternalLink size={12} />
        </a>

        <label className="label" htmlFor="model">모델</label>
        <select id="model" className="input mb-4" value={s[modelField] || ''} onChange={(e) => set(modelField, e.target.value)}>
          {prov.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        </>)}

        {s.provider === 'openai' && (
          <>
            <span className="label">품질</span>
            <div className="seg mb-4">
              {[['low', '낮음'], ['medium', '보통'], ['high', '높음']].map(([v, l]) => (
                <button key={v} className="seg-btn" aria-pressed={s.openaiQuality === v} onClick={() => set('openaiQuality', v)}>{l}</button>
              ))}
            </div>
          </>
        )}

        <span className="label">생성 방식</span>
        <div className="seg mb-1">
          <button className="seg-btn" aria-pressed={s.mode === 'sheet'} onClick={() => set('mode', 'sheet')}>시트 1장 · 빠름(추천)</button>
          <button className="seg-btn" aria-pressed={s.mode === 'individual'} onClick={() => set('mode', 'individual')}>개별 12장 · 고화질</button>
        </div>
        <p className="text-[11px] text-cocoa-400 mb-4 leading-relaxed">
          {s.mode === 'individual'
            ? '감정마다 따로 그려 화질이 좋지만 1~2분 걸려요. AI 호출 12회 이상(팩당 약 1,100원).'
            : '한 장에 12개를 그린 뒤 자동으로 오려내요. 20~40초면 끝나고 AI 호출 1회(팩당 약 100원). 카톡용 작은 크기엔 충분해요.'}
        </p>

        <label className="flex items-start gap-3 rounded-2xl bg-cream-50 p-3 mb-4 cursor-pointer">
          <input type="checkbox" className="mt-1 accent-peach-500 w-4 h-4" checked={s.postprocess} onChange={(e) => set('postprocess', e.target.checked)} />
          <span className="text-sm">
            <b>투명 배경 + 흰 다이컷 테두리 자동 처리</b>
            <span className="block text-xs text-cocoa-400 mt-0.5">배경을 지우고 굵은 흰 테두리와 은은한 그림자를 앱에서 균일하게 입혀요. (권장)</span>
          </span>
        </label>

        <p className="text-[11px] text-cocoa-400 mb-4 leading-relaxed">
          🔒 키는 이 기기의 브라우저(localStorage)에만 저장되고, 이미지 생성 시 {prov.label} 서버로만 직접 전송돼요. 공용 기기에서는 사용 후 삭제하세요.
        </p>

        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => setS((p) => ({ ...p, geminiKey: '', openaiKey: '' }))}
          >
            <Trash2 size={16} /> 키 삭제
          </button>
          <button className="btn-primary flex-1" onClick={() => onSave(s)}>저장</button>
        </div>
        {serverInfo && (
          <button onClick={onAdmin} className="mt-4 w-full text-center text-xs text-cocoa-400 underline underline-offset-2">관리자</button>
        )}
      </div>
    </div>
  );
}
