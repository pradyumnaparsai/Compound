// The assistant keeps its own dark "HUD" look in both light and dark mode.
export const hud = {
  bg: '#0A0A12',
  card: 'rgba(255,255,255,0.06)',
  cardStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F4F4FA',
  dim: '#9A9AB0',
  violet: '#7C5CFF',
  cyan: '#22D3EE',
  pink: '#FF5CC8',
  ok: '#22D3A6',
  danger: '#FF5C7A',
};

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export const orbPalette: Record<OrbMode, { base: string; a: string; b: string }> = {
  idle: { base: '#5B3DF5', a: '#22D3EE', b: '#FF5CC8' },
  listening: { base: '#0EA5C6', a: '#22D3A6', b: '#7C5CFF' },
  thinking: { base: '#6D28D9', a: '#FF5CC8', b: '#22D3EE' },
  speaking: { base: '#5B3DF5', a: '#22D3EE', b: '#22D3A6' },
};

export const statusLabel: Record<OrbMode, string> = {
  idle: 'Tap the orb and speak',
  listening: 'Listening… tap to send',
  thinking: 'Thinking…',
  speaking: 'Speaking… tap to interrupt',
};
