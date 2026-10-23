import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
const isAndroid = /android/i.test(ua);
const isKakao = /kakaotalk/i.test(ua);
const isInApp = isKakao || /naver\(inapp|instagram|fban|fbav|line\//i.test(ua);

const STEPS = {
  ios: ['Safari로 열기', '아래 공유 버튼(↑) 누르기', '홈 화면에 추가 → 추가'],
  android: ['Chrome으로 열기', '오른쪽 위 ⋮ 메뉴', '홈 화면에 추가(앱 설치) → 설치'],
};

/** 맨 아래 작은 '홈 화면에 추가' — 누르면 그 폰에 맞는 방법만 짧게 펼침 */
export default function InstallGuide() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [os, setOs] = useState(isAndroid ? 'android' : 'ios');
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone || installed) return null;

  const onTap = async () => {
    if (deferred && !isInApp) { // 안드로이드 크롬: 바로 설치 창
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <div className="text-center">
      <button onClick={onTap} className="inline-flex items-center gap-1 rounded-full bg-white/70 border border-cream-200 px-3 py-1.5 text-xs font-bold text-cocoa-600" aria-expanded={open}>
        📲 홈 화면에 추가하기 <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 mx-auto max-w-xs rounded-2xl bg-white/80 border border-cream-200 px-3 py-2.5 text-[11px] text-cocoa-600 text-left leading-relaxed">
          {isInApp && (
            <p className="text-peach-600 font-bold mb-1 break-keep">
              {isKakao ? '카카오톡' : '앱'} 안에서는 설치가 안 돼요. 먼저 {isIOS ? '⋯ → Safari로 열기' : '⋮ → 다른 브라우저로 열기'}를 눌러주세요.
            </p>
          )}
          <p className="break-keep">
            <b>{os === 'ios' ? '아이폰' : '안드로이드'}</b> : {STEPS[os].join(' → ')}
          </p>
          <button onClick={() => setOs(os === 'ios' ? 'android' : 'ios')} className="mt-1 text-cocoa-400 underline underline-offset-2">
            {os === 'ios' ? '안드로이드' : '아이폰'} 방법 보기
          </button>
        </div>
      )}
    </div>
  );
}
