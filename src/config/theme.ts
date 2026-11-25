import {
  Bell,
  Bookmark,
  Eye,
  Heart,
  Monitor,
  Moon,
  Package,
  ShoppingBag,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { AccentPreset, ThemeMode } from '../types/ecommerce.ts';

export interface ThemeColorTokens {
  bg: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  borderHighContrast: string;
  accent: string;
  accentHover: string;
  accentContrast: string;
}

export interface ThemePresetDefinition {
  id: AccentPreset;
  label: string;
  description: string;
  lightSwatch: string;
  darkSwatch: string;
  light: ThemeColorTokens;
  dark: ThemeColorTokens;
}

export interface ThemeTypographyTokens {
  sans: string;
  display: string;
  mono: string;
  scale: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    display: string;
  };
}

export interface ThemeSpacingTokens {
  containerMaxWidth: string;
  sectionGap: string;
  cardPadding: string;
  cardRadius: string;
  controlRadius: string;
}

export interface ThemeIconTokens {
  sm: number;
  md: number;
  lg: number;
  strokeWidth: number;
  semantic: Record<
    'bag' | 'wishlist' | 'saved' | 'orders' | 'notifications' | 'views' | 'light' | 'dark' | 'system',
    LucideIcon
  >;
}

const BASE_LIGHT_SURFACES = {
  bg: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EFEA',
  text: '#171614',
  textMuted: '#66635D',
  border: 'rgba(23, 22, 20, 0.09)',
  borderHighContrast: 'rgba(23, 22, 20, 0.34)',
};

const BASE_DARK_SURFACES = {
  bg: '#0E0E10',
  surface: '#17171A',
  surfaceMuted: '#212126',
  text: '#F4F2ED',
  textMuted: '#A19D95',
  border: 'rgba(255, 255, 255, 0.1)',
  borderHighContrast: 'rgba(255, 255, 255, 0.36)',
};

export const ACCENT_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'bronze',
    label: 'Atelier Bronze',
    description: 'Warm burnt umber and travertine gold',
    lightSwatch: '#9A5B25',
    darkSwatch: '#D4A373',
    light: {
      ...BASE_LIGHT_SURFACES,
      accent: '#9A5B25',
      accentHover: '#7D481B',
      accentContrast: '#FFFFFF',
    },
    dark: {
      ...BASE_DARK_SURFACES,
      accent: '#D4A373',
      accentHover: '#E2B98F',
      accentContrast: '#121214',
    },
  },
  {
    id: 'sage',
    label: 'Botanical Sage',
    description: 'Muted mineral green and eucalyptus',
    lightSwatch: '#3A6B56',
    darkSwatch: '#6EB597',
    light: {
      ...BASE_LIGHT_SURFACES,
      accent: '#3A6B56',
      accentHover: '#2C5443',
      accentContrast: '#FFFFFF',
    },
    dark: {
      ...BASE_DARK_SURFACES,
      accent: '#6EB597',
      accentHover: '#87C9AD',
      accentContrast: '#101412',
    },
  },
  {
    id: 'slate',
    label: 'Nordic Slate',
    description: 'Deep oceanic slate paired with sky-blue focus accents',
    lightSwatch: '#2D4A6E',
    darkSwatch: '#38BDF8',
    light: {
      ...BASE_LIGHT_SURFACES,
      accent: '#2D4A6E',
      accentHover: '#223854',
      accentContrast: '#FFFFFF',
    },
    dark: {
      bg: '#0B1120',
      surface: '#111827',
      surfaceMuted: '#1E293B',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      border: 'rgba(148, 163, 184, 0.16)',
      borderHighContrast: 'rgba(148, 163, 184, 0.42)',
      accent: '#38BDF8',
      accentHover: '#7DD3FC',
      accentContrast: '#082F49',
    },
  },
  {
    id: 'obsidian',
    label: 'Monochrome Ink',
    description: 'Pure high-contrast editorial ink',
    lightSwatch: '#18181B',
    darkSwatch: '#F4F2ED',
    light: {
      ...BASE_LIGHT_SURFACES,
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceMuted: '#F4F4F5',
      accent: '#18181B',
      accentHover: '#27272A',
      accentContrast: '#FFFFFF',
    },
    dark: {
      ...BASE_DARK_SURFACES,
      accent: '#F4F2ED',
      accentHover: '#E2DFD7',
      accentContrast: '#121214',
    },
  },
];

export interface CuratedThemeCard {
  key: 'gallery-light' | 'obsidian-dark' | 'warm-sandstone' | 'midnight-slate';
  label: string;
  description: string;
  themeMode: ThemeMode;
  accentPreset: AccentPreset;
  swatches: [string, string, string];
}

export const CURATED_THEME_CARDS: CuratedThemeCard[] = [
  {
    key: 'gallery-light',
    label: 'Gallery Light',
    description: 'Crisp studio white with high-contrast ink typography.',
    themeMode: 'light',
    accentPreset: 'obsidian',
    swatches: ['#F4F4F5', '#FFFFFF', '#18181B'],
  },
  {
    key: 'obsidian-dark',
    label: 'Obsidian Dark',
    description: 'Deep matte charcoal surfaces tuned for low-light browsing.',
    themeMode: 'dark',
    accentPreset: 'bronze',
    swatches: ['#0E0E10', '#17171A', '#E5E7EB'],
  },
  {
    key: 'warm-sandstone',
    label: 'Warm Sandstone',
    description: 'Editorial travertine tones with tactile warm neutrals.',
    themeMode: 'light',
    accentPreset: 'bronze',
    swatches: ['#EFEAE1', '#FAF9F6', '#2D2926'],
  },
  {
    key: 'midnight-slate',
    label: 'Midnight Slate',
    description: 'Deep oceanic slate paired with crisp sky-blue focus accents.',
    themeMode: 'dark',
    accentPreset: 'slate',
    swatches: ['#0B1120', '#1E293B', '#38BDF8'],
  },
];

// Extendable runtime theme registry supporting custom themes
const customThemeRegistry = new Map<string, ThemePresetDefinition>(
  ACCENT_PRESETS.map((preset) => [preset.id, preset])
);

export function registerCustomTheme(preset: ThemePresetDefinition) {
  customThemeRegistry.set(preset.id, preset);
}

export function getRegisteredThemes(): ThemePresetDefinition[] {
  return Array.from(customThemeRegistry.values());
}

export function getThemePreset(id: AccentPreset | string): ThemePresetDefinition {
  return customThemeRegistry.get(id) || ACCENT_PRESETS[0];
}

export const THEME_TYPOGRAPHY: ThemeTypographyTokens = {
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  display: "'Cormorant Garamond', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  scale: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.5rem',
    display: '2.25rem',
  },
};

export const THEME_SPACING: ThemeSpacingTokens = {
  containerMaxWidth: '1280px',
  sectionGap: '4rem',
  cardPadding: '1rem',
  cardRadius: '0.5rem',
  controlRadius: '0.375rem',
};

export const THEME_ICONS: ThemeIconTokens = {
  sm: 14,
  md: 16,
  lg: 20,
  strokeWidth: 1.75,
  semantic: {
    bag: ShoppingBag,
    wishlist: Heart,
    saved: Bookmark,
    orders: Package,
    notifications: Bell,
    views: Eye,
    light: Sun,
    dark: Moon,
    system: Monitor,
  },
};

export const CENTRAL_THEME_CONFIG = {
  presets: ACCENT_PRESETS,
  typography: THEME_TYPOGRAPHY,
  spacing: THEME_SPACING,
  icons: THEME_ICONS,
};

const THEME_STORAGE_KEY = 'aura_theme_preferences_v1';

export interface StoredThemeConfig {
  themeMode: ThemeMode;
  accentPreset: AccentPreset;
  highContrast: boolean;
}

export function loadStoredTheme(): StoredThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredThemeConfig>;
      return {
        themeMode:
          parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'system'
            ? parsed.themeMode
            : 'system',
        accentPreset:
          parsed.accentPreset === 'bronze' ||
          parsed.accentPreset === 'sage' ||
          parsed.accentPreset === 'slate' ||
          parsed.accentPreset === 'obsidian'
            ? parsed.accentPreset
            : 'bronze',
        highContrast: Boolean(parsed.highContrast),
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    themeMode: 'system',
    accentPreset: 'bronze',
    highContrast: false,
  };
}

export function saveStoredTheme(config: StoredThemeConfig) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage write errors
  }
}

export function resolveDarkClass(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function applyThemeToDocument(config: StoredThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = resolveDarkClass(config.themeMode);
  const preset = getThemePreset(config.accentPreset);
  const tokens = isDark ? preset.dark : preset.light;

  root.classList.toggle('dark', isDark);
  root.classList.toggle('high-contrast', config.highContrast);
  root.setAttribute('data-accent', preset.id);

  // Sync centralized tokens directly to CSS custom properties for runtime extendability
  root.style.setProperty('--aura-bg', tokens.bg);
  root.style.setProperty('--aura-surface', tokens.surface);
  root.style.setProperty('--aura-surface-muted', tokens.surfaceMuted);
  root.style.setProperty('--aura-text', tokens.text);
  root.style.setProperty('--aura-text-muted', tokens.textMuted);
  root.style.setProperty(
    '--aura-border',
    config.highContrast ? tokens.borderHighContrast : tokens.border
  );
  root.style.setProperty('--aura-accent', tokens.accent);
  root.style.setProperty('--aura-accent-hover', tokens.accentHover);
  root.style.setProperty('--aura-accent-contrast', tokens.accentContrast);
  root.style.setProperty('--aura-font-sans', THEME_TYPOGRAPHY.sans);
  root.style.setProperty('--aura-font-display', THEME_TYPOGRAPHY.display);
  root.style.setProperty('--aura-font-mono', THEME_TYPOGRAPHY.mono);
  root.style.setProperty('--aura-container-max', THEME_SPACING.containerMaxWidth);
}
