import { Settings, Sparkles } from 'lucide-react';

/** 상단 바: 손님용(무료 이용 주소)에서는 설정 버튼을 숨김 */
export default function Header({ onOpenSettings, hasKey, showSettings = true }) {
  return (
    <header className="sticky top-0 z-30 bg-cream-100/85 backdrop-blur-md border-b border-cream-200/70">
      <div className="mx-auto max-w-xl px-4 h-14 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-peach-400 grid place-items-center text-white shadow-sticker">
            <Sparkles size={18} />
          </div>
          <h1 className="font-display text-lg min-[380px]:text-xl text-cocoa-800 truncate">AI 이모티콘 메이커</h1>
        </div>
        {showSettings && (
          <button onClick={onOpenSettings} className="relative btn-ghost !px-2.5 !py-2" aria-label="설정">
            <Settings size={18} />
            {!hasKey && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-peach-500 ring-2 ring-cream-100" />}
          </button>
        )}
      </div>
    </header>
  );
}
