import React, { createContext, useContext, type RefObject, type ReactNode } from 'react';
import { View } from 'react-native';

// ─── Blur Target Context ─────────────────────────────────────────────────────
// expo-blur's Dimezis V3 BlurView requires a `blurTarget` ref pointing at a
// <BlurTargetView>. Only content INSIDE that view is captured into the blur
// — everything else in the app is excluded. This prevents the ghost-glow
// halos that @react-native-community/blur (V2) produced because it captured
// the entire app content root.
//
// We maintain two targets:
//   • gradientTarget  — wraps ONLY the page gradient. Card BlurViews use this
//                       so their own sibling content (text, emojis) isn't
//                       captured and doesn't halo.
//   • contentTarget   — wraps the tab navigator's content. Sheet BlurViews
//                       use this so the dashboard shows blurred behind them
//                       when they slide up.

export interface BlurTargetContextValue {
  gradientTarget: RefObject<View | null> | null;
  contentTarget: RefObject<View | null> | null;
}

const BlurTargetContext = createContext<BlurTargetContextValue>({
  gradientTarget: null,
  contentTarget: null,
});

export function BlurTargetProvider({
  gradientTarget,
  contentTarget,
  children,
}: BlurTargetContextValue & { children: ReactNode }) {
  return (
    <BlurTargetContext.Provider value={{ gradientTarget, contentTarget }}>
      {children}
    </BlurTargetContext.Provider>
  );
}

export function useBlurTargets(): BlurTargetContextValue {
  return useContext(BlurTargetContext);
}
