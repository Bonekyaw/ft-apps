/**
 * Theme configuration for Family Taxi User App
 */

import { Platform } from "react-native";

// Brand colors for the taxi app
export const Brand = {
  primary: "#FFB800", // Taxi yellow
  primaryDark: "#E5A500",
  secondary: "#1A1A2E", // Dark navy
  accent: "#16213E",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
};

export const Colors = {
  light: {
    text: "#1A1A2E",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    background: "#FFFFFF",
    backgroundSecondary: "#F8FAFC",
    card: "#FFFFFF",
    border: "#E2E8F0",
    tint: Brand.primary,
    icon: "#64748B",
    tabIconDefault: "#94A3B8",
    tabIconSelected: Brand.primary,
    inputBackground: "#F1F5F9",
    inputBorder: "#E2E8F0",
    inputPlaceholder: "#94A3B8",
  },
  dark: {
    text: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    background: "#0F172A",
    backgroundSecondary: "#1E293B",
    card: "#1E293B",
    border: "#334155",
    tint: Brand.primary,
    icon: "#94A3B8",
    tabIconDefault: "#64748B",
    tabIconSelected: Brand.primary,
    inputBackground: "#1E293B",
    inputBorder: "#334155",
    inputPlaceholder: "#64748B",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
