import { useEffect, useState } from "react";
import { Smartphone, Share } from "lucide-react";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

export const InstallAppButton = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPromptEvent(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (isStandalone() || (!promptEvent && !isIos)) return null;

  const handleClick = async () => {
    if (promptEvent) {
      promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
    } else {
      setShowIosHint((v) => !v);
    }
  };

  return (
    <div className="px-4 pt-3">
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
        data-testid="install-app-button"
      >
        <Smartphone className="w-4 h-4" />
        <span className="font-medium">Dodaj do ekranu głównego</span>
      </button>
      {showIosHint && (
        <p className="mt-2 text-xs text-slate-500 flex items-start gap-1.5" data-testid="install-ios-hint">
          <Share className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          W Safari dotknij „Udostępnij”, a potem „Do ekranu początkowego”.
        </p>
      )}
    </div>
  );
};
