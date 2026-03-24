import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { darkPalette, themes } from '../../theme/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  // DEV ONLY: remove before production
  onStepPress?: (step: number) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StepProgress({ currentStep, totalSteps, onStepPress }: StepProgressProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const isActive = isCompleted || isCurrent;

        return (
          <React.Fragment key={step}>
            <Pressable
              onPress={() => onStepPress?.(step)}
              disabled={!onStepPress || isCurrent}
              hitSlop={16}
              style={({ pressed }) => [
                styles.circle,
                isActive ? styles.circleActive : styles.circleInactive,
                pressed && styles.circlePressed,
              ]}
            >
              <Text
                style={[
                  styles.circleText,
                  isActive ? styles.circleTextActive : styles.circleTextInactive,
                ]}
              >
                {step}
              </Text>
            </Pressable>

            {index < steps.length - 1 ? (
              <View
                style={[
                  styles.line,
                  isCompleted ? styles.lineActive : styles.lineInactive,
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  circleActive: {
    backgroundColor: themes.default.primary,
    borderColor: themes.default.primary,
  },
  circleInactive: {
    backgroundColor: 'transparent',
    borderColor: darkPalette.border,
  },
  circlePressed: {
    opacity: 0.6,
  },
  circleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  circleTextActive: {
    color: '#ffffff',
  },
  circleTextInactive: {
    color: darkPalette.muted,
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
  },
  lineActive: {
    backgroundColor: themes.default.primary,
  },
  lineInactive: {
    backgroundColor: darkPalette.border,
  },
});
