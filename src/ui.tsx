import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import type { Theme } from './theme';

export const MONO = Platform.select({ android: 'monospace', default: 'Courier' });

export function Card({ t, children, style }: { t: Theme; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.line }, style]}>{children}</View>;
}

export function Label({ t, children, style }: { t: Theme; children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, { color: t.muted }, style]}>{children}</Text>;
}

export function Btn({
  t, label, onPress, kind = 'primary', style, disabled,
}: {
  t: Theme; label: string; onPress: () => void; kind?: 'primary' | 'ghost'; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: 'rgba(127,127,127,0.25)' }}
      style={[s.btn, { backgroundColor: primary ? t.accent : t.surface2, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Text style={[s.btnText, { color: primary ? t.onAccent : t.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  t, label, onPress, selected, pressed, a11y,
}: {
  t: Theme; label: string; onPress: () => void; selected?: boolean; pressed?: boolean; a11y?: string;
}) {
  const on = selected ?? pressed ?? false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      android_ripple={{ color: 'rgba(127,127,127,0.25)' }}
      style={[s.pill, { backgroundColor: on ? t.fg : t.surface, borderColor: on ? t.fg : t.line }]}
    >
      <Text style={[s.pillText, { color: on ? t.bg : t.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Bar({ t, pct, color }: { t: Theme; pct: number; color?: string }) {
  return (
    <View style={[s.bar, { backgroundColor: t.surface2 }]}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color ?? t.accent, borderRadius: 99 }} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  btn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  pill: { minHeight: 44, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 14, fontWeight: '700' },
  bar: { height: 6, borderRadius: 99, overflow: 'hidden' },
});
