import { useEffect, useRef } from "react";

function isTypingTarget(el: EventTarget | null) {
  const tag = (el as HTMLElement)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement)?.isContentEditable;
}

export function useKeyboardShortcuts(opts: { onPalette: () => void; onShortcutsHelp: () => void }) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        optsRef.current.onPalette();
        return;
      }
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        optsRef.current.onShortcutsHelp();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
