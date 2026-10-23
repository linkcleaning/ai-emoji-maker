import { useEffect, useState } from 'react';
import { Download, Share, MoreVertical, PlusSquare } from 'lucide-react';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
const isAndroid = /android/i.test(ua);
const isKakao = /kakaotalk/i.test(ua);
const isInApp = isKakao || /naver\(inapp|instagram|fban|fbav|line\//i.test(ua);

/** 맨 아래 '홈 화면에 앱으로 설치하기' 안내 — 아이폰 / 안드로이드 구분 */
export default function InstallGuide() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [tab, setTab] = useState(isAndroid ? 'android' : 'ios');
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

  if (standalone || installed) return null; // 이미 앱으로 설치해서 여는 중

  const installNow = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <section className="card p-4" aria-labelledby="install-title">
      <h2 id="install-title" className="font-display text-lg mb-1 flex items-center gap-2">📲 홈 화면에 앱으로 설치하기</h2>
      <p className="text-xs text-cocoa-400 mb-3">설치하면 다음부터 앱처럼 바로 열 수 있어요.</p>

      {isInApp && (
        <div className="rounded-2xl bg-peach-300/20 border border-peach-300 p-3 mb-3 text-xs text-cocoa-800 leading-relaxed break-keep">
          <b>{isKakao ? '카카오톡' : '앱'} 안에서 열려 있어서 설치가 안 돼요.</b><br />
          {isIOS
            ? <>오른쪽 아래 <b>공유(↗) 또는 ⋯</b> → <b>Safari로 열기</b>를 누른 뒤 아래 방법대로 해주세요.</>
            : <>오른쪽 위 <b>⋮</b> → <b>다른 브라우저로 열기</b>(Chrome)를 누른 뒤 아래 방법대로 해주세요.</>}
        </div>
      )}

      <div className="seg mb-3" role="tablist">
        <button role="tab" className="seg-btn" aria-pressed={tab === 'ios'} onClick={() => setTab('ios')}>🍎 아이폰</button>
        <button role="tab" className="seg-btn" aria-pressed={tab === 'android'} onClick={() => setTab('android')}>🤖 안드로이드</button>
      </div>

      {tab === 'ios' ? (
        <ol className="space-y-2 text-sm text-cocoa-800">
          <li className="flex gap-3 items-start"><Step n={1} /><span><b>Safari</b>로 이 페이지를 열어주세요. (크롬·카톡에서는 안 돼요)</span></li>
          <li className="flex gap-3 items-start"><Step n={2} /><span>화면 아래 <Share size={15} className="inline -mt-0.5" /> <b>공유</b> 버튼을 누르세요.</span></li>
          <li className="flex gap-3 items-start"><Step n={3} /><span>목록을 내려서 <PlusSquare size={15} className="inline -mt-0.5" /> <b>홈 화면에 추가</b>를 누르세요.</span></li>
          <li className="flex gap-3 items-start"><Step n={4} /><span>오른쪽 위 <b>추가</b>를 누르면 끝!</span></li>
        </ol>
      ) : (
        <div>
          {deferred && (
            <button onClick={installNow} className="btn-primary w-full mb-3"><Download size={17} /> 바로 설치하기</button>
          )}
          <ol className="space-y-2 text-sm text-cocoa-800">
            <li className="flex gap-3 items-start"><Step n={1} /><span><b>Chrome</b>(크롬)으로 이 페이지를 열어주세요.</span></li>
            <li className="flex gap-3 items-start"><Step n={2} /><span>오른쪽 위 <MoreVertical size={15} className="inline -mt-0.5" /> <b>메뉴</b>를 누르세요.</span></li>
            <li className="flex gap-3 items-start"><Step n={3} /><span><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요.</span></li>
            <li className="flex gap-3 items-start"><Step n={4} /><span><b>설치</b>를 누르면 끝!</span></li>
          </ol>
        </div>
      )}
    </section>
  );
}

function Step({ n }) {
  return <span className="shrink-0 w-6 h-6 rounded-full bg-peach-500 text-white text-xs font-bold grid place-items-center">{n}</span>;
}
