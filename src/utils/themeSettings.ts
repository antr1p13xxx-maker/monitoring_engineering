export interface ThemeConfig {
  presetId: 'indigo-fuchsia' | 'emerald-teal' | 'ocean-cobalt' | 'amber-crimson' | 'slate-graphite' | 'custom';
  primary: string;
  secondary: string;
  highlight: string;
}

export interface ThemePreset {
  id: ThemeConfig['presetId'];
  name: string;
  description: string;
  primary: string;
  secondary: string;
  highlight: string;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  presetId: 'indigo-fuchsia',
  primary: '#4f46e5',
  secondary: '#d946ef',
  highlight: '#06b6d4'
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'indigo-fuchsia',
    name: 'Indigo & Fuchsia (Default)',
    description: 'Gradasi default modern biru indigo, fuchsia, dan cyan',
    primary: '#4f46e5',
    secondary: '#d946ef',
    highlight: '#06b6d4'
  },
  {
    id: 'emerald-teal',
    name: 'Emerald & Teal',
    description: 'Nuansa hijau industrial presisi dan toska modern',
    primary: '#059669',
    secondary: '#0d9488',
    highlight: '#38bdf8'
  },
  {
    id: 'ocean-cobalt',
    name: 'Ocean Cobalt & Cyan',
    description: 'Biru teknik kedirgantaraan dengan aksen biru langit',
    primary: '#2563eb',
    secondary: '#0284c7',
    highlight: '#22d3ee'
  },
  {
    id: 'amber-crimson',
    name: 'Amber & Crimson',
    description: 'Energi kontras tinggi oranye manufaktur & merah tua',
    primary: '#ea580c',
    secondary: '#e11d48',
    highlight: '#f59e0b'
  },
  {
    id: 'slate-graphite',
    name: 'Executive Graphite',
    description: 'Monokrom abu-abu baja minimalis dengan aksen sky blue',
    primary: '#334155',
    secondary: '#0f172a',
    highlight: '#38bdf8'
  }
];

const STORAGE_KEY = 'eng_theme_settings_v1';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function normalizeHex(hex: string, fallback = '#4f46e5'): string {
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return (
      '#' +
      cleaned
        .split('')
        .map((ch) => ch + ch)
        .join('')
        .toLowerCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return '#' + cleaned.toLowerCase();
  }
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHex(hex);
  const intVal = parseInt(norm.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const wA = 1 - weightB;
  return rgbToHex(a.r * wA + b.r * weightB, a.g * wA + b.g * weightB, a.b * wA + b.b * weightB);
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Relative luminance for WCAG contrast calculation.
 */
function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastTextHex(bgHex: string): string {
  return getLuminance(bgHex) > 0.42 ? '#0f172a' : '#ffffff';
}

export function loadSavedTheme(): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      presetId: parsed.presetId || 'custom',
      primary: normalizeHex(parsed.primary || DEFAULT_THEME_CONFIG.primary, DEFAULT_THEME_CONFIG.primary),
      secondary: normalizeHex(parsed.secondary || DEFAULT_THEME_CONFIG.secondary, DEFAULT_THEME_CONFIG.secondary),
      highlight: normalizeHex(parsed.highlight || DEFAULT_THEME_CONFIG.highlight, DEFAULT_THEME_CONFIG.highlight)
    };
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

export function saveThemeConfig(config: ThemeConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to persist theme settings:', err);
  }
}

export function applyThemeToDocument(config: ThemeConfig): void {
  if (typeof document === 'undefined') return;
  const primary = normalizeHex(config.primary, DEFAULT_THEME_CONFIG.primary);
  const secondary = normalizeHex(config.secondary, DEFAULT_THEME_CONFIG.secondary);
  const highlight = normalizeHex(config.highlight, DEFAULT_THEME_CONFIG.highlight);

  // Compute rich dark atmospheric header & table head tones anchored to the chosen colors
  const darkBase = '#090e21';
  const headerFrom = mixHex(darkBase, highlight, 0.14);
  const headerVia = mixHex('#0d1329', primary, 0.28);
  const headerTo = mixHex('#110f24', secondary, 0.26);

  const tableHeadFrom = mixHex('#0f172a', primary, 0.34);
  const tableHeadTo = mixHex('#0f172a', secondary, 0.32);

  // Average primary & secondary luminance to pick legible foreground text
  const avgPrimaryLum = (getLuminance(primary) + getLuminance(secondary)) / 2;
  const onPrimary = avgPrimaryLum > 0.42 ? '#0f172a' : '#ffffff';

  const root = document.documentElement;
  root.style.setProperty('--theme-primary', primary);
  root.style.setProperty('--theme-secondary', secondary);
  root.style.setProperty('--theme-highlight', highlight);
  root.style.setProperty('--theme-on-primary', onPrimary);
  root.style.setProperty('--theme-primary-soft', hexToRgba(primary, 0.12));
  root.style.setProperty('--theme-secondary-soft', hexToRgba(secondary, 0.11));
  root.style.setProperty('--theme-highlight-soft', hexToRgba(highlight, 0.13));
  root.style.setProperty('--theme-primary-border', hexToRgba(primary, 0.32));
  root.style.setProperty('--theme-primary-shadow', hexToRgba(primary, 0.28));
  root.style.setProperty('--theme-header-from', headerFrom);
  root.style.setProperty('--theme-header-via', headerVia);
  root.style.setProperty('--theme-header-to', headerTo);
  root.style.setProperty('--theme-table-head-from', tableHeadFrom);
  root.style.setProperty('--theme-table-head-to', tableHeadTo);

  // Sync browser/PWA status bar color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', headerVia);
  }
}
