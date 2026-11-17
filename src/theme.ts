import { useColorScheme } from 'react-native';
import type { Cat } from './agenda';
import type { ColorToken } from './domain/types';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
  now: string;
  ok: string;
  warn: string;
  cat: Record<Cat, string>;
}

const light: Theme = {
  dark: false,
  bg: '#EDF0EC', surface: '#FFFFFF', surface2: '#E2E8E4', fg: '#16211C', muted: '#56635C', line: '#CFD7D2',
  accent: '#1F4FD8', onAccent: '#FFFFFF', now: '#E3EBFF', ok: '#1B7A4B', warn: '#B3450A',
  cat: {
    work: '#1F4FD8', close: '#1F4FD8', content: '#C0185A', project: '#0C7A7A', health: '#2A8A3A',
    english: '#A86A0A', fixed: '#4F5B66', rest: '#7F8B85',
  },
};
const dark: Theme = {
  dark: true,
  bg: '#0E1512', surface: '#16201B', surface2: '#1F2B25', fg: '#E6EEE9', muted: '#9BA9A2', line: '#2B3832',
  accent: '#8CAAFF', onAccent: '#0E1512', now: '#1A2A52', ok: '#5BD08F', warn: '#F0A060',
  cat: {
    work: '#8CAAFF', close: '#8CAAFF', content: '#FF86B5', project: '#4FD1D1', health: '#6CCB7A',
    english: '#E8AE55', fixed: '#9AA7B3', rest: '#6E7B75',
  },
};

/** Color del tema para un token de la paleta de categorías (mismos colores que las categorías actuales). */
const TOKEN_TO_CAT: Record<ColorToken, Cat> = {
  blue: 'work', pink: 'content', teal: 'project', green: 'health', amber: 'english', slate: 'fixed', gray: 'rest',
};
export const colorFor = (t: Theme, token: ColorToken) => t.cat[TOKEN_TO_CAT[token]];

/** Los dos temas, para pruebas. */
export const THEMES = { light, dark };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
