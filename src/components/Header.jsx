import { useEffect, useState } from 'react';
import { Download, Settings, Sparkles, X, Share } from 'lucide-react';

export default function Header({ onOpenSettings, hasKey }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

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

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else {
      setIosHint(true);
    }
  };

  const showInstall = !standalone && !installed && (deferred || isIOS);

  return (
    <>
      <header className="sticky top-0 z-30 bg-cream-100/85 backdrop-blur-md border-b border-cream-200/70">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-peach-400 grid place-items-center text-white shadow-sticker">
              <Sparkles size={18} />
            </div>
            <h1 className="font-display text-xl text-cocoa-800 truncate">AI 이모티콘 메이커</h1>
          </div>
          {showInstall && (
            <button onClick={install} className="btn-ghost !px-3 !py-2 !text-xs" aria-label="앱 설치">
              <Download size={15} /> 설치
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="relative btn-ghost !px-2.5 !py-2"
            aria-label="API 설정"
          >
            <Settings size={18} />
            {!hasKey && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-peach-500 ring-2 ring-cream-100" />}
          </button>
        </div>
      </header>

      {iosHint && (
        <div className="fixed inset-0 z-50 bg-cocoa-800/40 grid place-items-end sm:place-items-center p-4" onClick={() => setIosHint(false)}>
          <div className="card w-full max-w-sm p-5 pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg">홈 화면에 추가하기</h3>
              <button onClick={() => setIosHint(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <ol className="text-sm text-cocoa-600 space-y-2 list-decimal pl-5">
              <li>Safari 하단의 <Share size={14} className="inline -mt-0.5" /> <b>공유</b> 버튼을 누르세요.</li>
              <li><b>홈 화면에 추가</b>를 선택하세요.</li>
              <li>오른쪽 위 <b>추가</b>를 누르면 앱처럼 실행돼요.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
