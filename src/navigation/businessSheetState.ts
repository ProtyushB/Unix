import { useEffect, useState } from 'react';

// Module-level pub/sub for the business-switcher sheet. Mirrors
// groupSheetState so the sheet can be rendered at the navigator root (no
// Modal → no Android touch-attach delay) while being triggered from any
// screen via a plain function call.

let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function openBusinessSheet() {
  if (!open) { open = true; emit(); }
}

export function closeBusinessSheet() {
  if (open) { open = false; emit(); }
}

export function useBusinessSheetState(): boolean {
  const [snapshot, setSnapshot] = useState(open);
  useEffect(() => {
    const l = () => setSnapshot(open);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return snapshot;
}
