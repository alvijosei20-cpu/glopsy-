import { ThemeMode } from './types';

export interface Palette {
  mode: ThemeMode;
  bg: string;
  bgElev: string;
  card: string;
  card2: string;
  border: string;
  borderSoft: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  green: string;
  red: string;
  amber: string;
  skeleton: string;
  skeletonHi: string;
  navBg: string;
  toastBg: string;
  backdrop: string;
  statusBar: 'light' | 'dark';
}

export const palettes: Record<ThemeMode, Palette> = {
  light: {
    mode: 'light',
    bg: '#f4f6fb',
    bgElev: '#ffffff',
    card: '#ffffff',
    card2: '#eef1f7',
    border: '#dfe4ee',
    borderSoft: 'rgba(15,20,35,0.06)',
    text: '#151a26',
    text2: '#5b6478',
    text3: '#97a0b4',
    accent: '#6d4dff',
    accentSoft: 'rgba(109,77,255,0.12)',
    accent2: '#0e7490',
    green: '#059669',
    red: '#dc2626',
    amber: '#b45309',
    skeleton: '#e6eaf2',
    skeletonHi: '#d6dce9',
    navBg: 'rgba(255,255,255,0.92)',
    toastBg: '#ffffff',
    backdrop: 'rgba(15,20,35,0.45)',
    statusBar: 'dark',
  },
  dark: {
    mode: 'dark',
    bg: '#0f1115',
    bgElev: '#171a21',
    card: '#1c2029',
    card2: '#232837',
    border: '#2a2f3d',
    borderSoft: 'rgba(255,255,255,0.06)',
    text: '#eef1f7',
    text2: '#9aa3b5',
    text3: '#6b7488',
    accent: '#7c5cff',
    accentSoft: 'rgba(124,92,255,0.16)',
    accent2: '#22d3ee',
    green: '#34d399',
    red: '#f87171',
    amber: '#fbbf24',
    skeleton: '#232833',
    skeletonHi: '#2b3140',
    navBg: 'rgba(23,26,33,0.92)',
    toastBg: '#262b36',
    backdrop: 'rgba(0,0,0,0.6)',
    statusBar: 'light',
  },
};
