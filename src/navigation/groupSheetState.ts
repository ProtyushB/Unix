import { useEffect, useState } from 'react';

// Module-level pub/sub that lets the bottom tab bar (BottomGroupNav) and the
// sheet overlay (GroupSheetOverlay) share state without lifting it through
// React context or the navigation tree. Replaces the RN `Modal` that was
// causing a 50–150 ms touch-attach delay on Android.

type GroupSheetState = {
  openGroupId:   string | null;
  activeTabName: string;
  navigate:      ((tab: string) => void) | null;
};

let state: GroupSheetState = {
  openGroupId:   null,
  activeTabName: '',
  navigate:      null,
};

const listeners = new Set<() => void>();

function update(partial: Partial<GroupSheetState>) {
  state = { ...state, ...partial };
  listeners.forEach(l => l());
}

export function openGroupSheet(groupId: string) {
  update({ openGroupId: groupId });
}

export function closeGroupSheet() {
  update({ openGroupId: null });
}

export function setActiveTabName(name: string) {
  if (state.activeTabName !== name) update({ activeTabName: name });
}

export function setGroupSheetNavigator(fn: ((tab: string) => void) | null) {
  update({ navigate: fn });
}

export function useGroupSheetState(): GroupSheetState {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const l = () => setSnapshot(state);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return snapshot;
}
