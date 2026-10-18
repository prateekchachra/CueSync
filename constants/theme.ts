/**
 * MySync palette — built on the Tailwind CSS violet + orange scales.
 * Light mode leans purple (violet-700 primary, orange-500 accent).
 * Dark mode uses a deeper plum base with violet-400 + orange-400 so both colors glow.
 */

export type ThemeColors = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surface2: string;
  elevated: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  text: string;
  muted: string;
  line: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  gradient: [string, string, ...string[]];
  heroGradient: [string, string, ...string[]];
  overlay: string;
};

export const lightColors: ThemeColors = {
  scheme: 'light',
  bg: '#F7F3FF', // violet-50, warmed
  surface: '#FFFFFF',
  surface2: '#EDE9FE', // violet-100
  elevated: '#FFFFFF',
  primary: '#6D28D9', // violet-700
  primarySoft: '#DDD6FE', // violet-200
  onPrimary: '#FFFFFF',
  accent: '#F97316', // orange-500
  accentSoft: '#FFEDD5', // orange-100
  onAccent: '#FFFFFF',
  text: '#1E1336',
  muted: '#6B5E8A',
  line: '#E4DCF7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#C2410C',
  warningSoft: '#FFEDD5',
  success: '#059669',
  successSoft: '#D1FAE5',
  gradient: ['#7C3AED', '#C026D3', '#F97316'],
  heroGradient: ['#6D28D9', '#8B5CF6', '#FB923C'],
  overlay: 'rgba(30, 19, 54, 0.45)',
};

export const darkColors: ThemeColors = {
  scheme: 'dark',
  bg: '#120A21', // deep plum
  surface: '#1C1230',
  surface2: '#2A1C47',
  elevated: '#24173D',
  primary: '#A78BFA', // violet-400
  primarySoft: '#3B2766',
  onPrimary: '#140B26',
  accent: '#FB923C', // orange-400
  accentSoft: '#3D2416',
  onAccent: '#1A0E05',
  text: '#F4EFFF',
  muted: '#A99BC9',
  line: '#33244F',
  danger: '#F87171',
  dangerSoft: '#3A1620',
  warning: '#FDBA74',
  warningSoft: '#3D2416',
  success: '#34D399',
  successSoft: '#0F2E26',
  gradient: ['#7C3AED', '#DB2777', '#FB923C'],
  heroGradient: ['#4C1D95', '#7C3AED', '#F97316'],
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const DARZINI = {
  email: 'darzini@mysync.app',
  password: 'DarziniSync1!',
  artistName: 'Darzini',
};

export const DEMO_SUPERVISOR = {
  email: 'supervisor@mysync.app',
  password: 'SupervisorSync1!',
  name: 'Demo Supervisor',
};
