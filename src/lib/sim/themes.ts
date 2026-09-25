import type { AppTheme } from "./types";

export type ThemeTokens = {
  id: AppTheme;
  label: string;
  dark: boolean;
  vars: {
    bg: string;
    surface: string;
    sunken: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    sidebar: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  radius: number;
  borderWidth: number;
  shadow: string;
  headingFont: "sans" | "serif";
  headingCase: "none" | "upper";
};

/** Themes for generated apps. The preview and the generated theme.css share these values. */
export const APP_THEMES: Record<AppTheme, ThemeTokens> = {
  paper: {
    id: "paper",
    label: "Paper",
    dark: false,
    vars: {
      bg: "#fbfaf7",
      surface: "#ffffff",
      sunken: "#f4f2ec",
      text: "#1d1b16",
      muted: "#6f6c63",
      border: "#e7e4dc",
      accent: "#c2410c",
      accentText: "#ffffff",
      accentSoft: "#fdeee6",
      sidebar: "#f4f2ec",
      success: "#15803d",
      warning: "#a16207",
      danger: "#b91c1c",
      info: "#1d4ed8",
    },
    radius: 10,
    borderWidth: 1,
    shadow: "0 1px 2px rgba(29,27,22,.05)",
    headingFont: "serif",
    headingCase: "none",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    dark: true,
    vars: {
      bg: "#0f1220",
      surface: "#161a2d",
      sunken: "#0b0e19",
      text: "#e6e8f2",
      muted: "#9aa0b8",
      border: "#262b45",
      accent: "#7c9cff",
      accentText: "#0b0e19",
      accentSoft: "#1d2542",
      sidebar: "#0b0e19",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#f87171",
      info: "#7c9cff",
    },
    radius: 10,
    borderWidth: 1,
    shadow: "0 1px 2px rgba(0,0,0,.4)",
    headingFont: "sans",
    headingCase: "none",
  },
  studio: {
    id: "studio",
    label: "Studio",
    dark: false,
    vars: {
      bg: "#f7f8fa",
      surface: "#ffffff",
      sunken: "#f1f3f6",
      text: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
      accent: "#2563eb",
      accentText: "#ffffff",
      accentSoft: "#e8efff",
      sidebar: "#ffffff",
      success: "#16a34a",
      warning: "#ca8a04",
      danger: "#dc2626",
      info: "#2563eb",
    },
    radius: 8,
    borderWidth: 1,
    shadow: "0 1px 2px rgba(17,24,39,.06)",
    headingFont: "sans",
    headingCase: "none",
  },
  meadow: {
    id: "meadow",
    label: "Meadow",
    dark: false,
    vars: {
      bg: "#f6f8f1",
      surface: "#ffffff",
      sunken: "#eef2e7",
      text: "#1d2b1f",
      muted: "#5f6f61",
      border: "#dde5d6",
      accent: "#3f8f4f",
      accentText: "#ffffff",
      accentSoft: "#e3f1e4",
      sidebar: "#eef2e7",
      success: "#3f8f4f",
      warning: "#b7791f",
      danger: "#c0392b",
      info: "#2f6f9f",
    },
    radius: 14,
    borderWidth: 1,
    shadow: "0 1px 3px rgba(29,43,31,.06)",
    headingFont: "sans",
    headingCase: "none",
  },
  bold: {
    id: "bold",
    label: "Bold",
    dark: false,
    vars: {
      bg: "#fff7e6",
      surface: "#ffffff",
      sunken: "#fdefd0",
      text: "#1a1a1a",
      muted: "#5c5344",
      border: "#1a1a1a",
      accent: "#ff3d00",
      accentText: "#ffffff",
      accentSoft: "#ffe2d6",
      sidebar: "#fff0cc",
      success: "#0a8a4a",
      warning: "#b36b00",
      danger: "#d7263d",
      info: "#1f4fd6",
    },
    radius: 4,
    borderWidth: 2,
    shadow: "3px 3px 0 #1a1a1a",
    headingFont: "sans",
    headingCase: "upper",
  },
};

export const THEME_IDS = Object.keys(APP_THEMES) as AppTheme[];
