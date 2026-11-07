import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  danger: string;
};

export const darkTheme: Theme = {
  dark: true,
  bg: '#09090B',
  surface: '#121215',
  surfaceAlt: '#1B1B20',
  border: '#222228',
  text: '#F5F5F7',
  textDim: '#8C8C96',
  accent: '#7C5CFF',
  accentSoft: 'rgba(124,92,255,0.18)',
  success: '#22D3A6',
  successSoft: 'rgba(34,211,166,0.18)',
  danger: '#FF5C7A',
};

export const lightTheme: Theme = {
  dark: false,
  bg: '#F6F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFF3',
  border: '#E6E6EB',
  text: '#111114',
  textDim: '#6E6E7A',
  accent: '#6A48F5',
  accentSoft: 'rgba(106,72,245,0.12)',
  success: '#0FB98C',
  successSoft: 'rgba(15,185,140,0.14)',
  danger: '#E5365A',
};

// Dark is the default; light only when the system explicitly asks for it.
export function useTheme(): Theme {
  return useColorScheme() === 'light' ? lightTheme : darkTheme;
}

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
