import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const KEY = "pq_theme";

// Two palettes with identical keys so any component can read `usePalette()`
// and stay theme-reactive. DARK is extracted 1:1 from the client mockup;
// LIGHT is the app's original bright look (white cards, indigo accent).
const DARK = {
  page: "#0B0B0D",
  cardBg: "#141417",
  inset: "#0E1016",
  border: "#24252C",
  hair: "#1B1C21",
  railActive: "#17181C",
  text: "#F4F5F7",
  text2: "#C9CAD0",
  text3: "#8A8B92",
  textMuted: "#8A8B92",
  text4: "#6E6F76",
  textDim: "#6E6F76",
  text5: "#5C5D66",
  blue: "#4C7DFB",
  green: "#3FB984", greenBg: "rgba(63,185,132,0.14)", greenBorder: "rgba(63,185,132,0.28)",
  amber: "#E0A33A", amberBg: "rgba(224,163,58,0.14)", amberBorder: "rgba(224,163,58,0.28)",
  red: "#E5654C", redBg: "rgba(229,101,76,0.14)", redBorder: "rgba(229,101,76,0.28)",
  gold: "#E8B23A", goldText: "#3A2A06",
  pillBg: "#20222B", pillBorder: "#2C2E39",
  avatarBlue: "#3B6FF6", avatarPurple: "#6D4BF0", avatarGrey: "#2A2B33",
  copilotGrad: "radial-gradient(120% 80% at 80% 0%,#2A2410 0%,#141417 45%)",
  font: "'Hanken Grotesk', sans-serif",
};

const LIGHT = {
  page: "#F3F4F8",
  cardBg: "#FFFFFF",
  inset: "#F7F8FB",
  border: "#ECEDF2",
  hair: "#F1F2F6",
  railActive: "#EEF2FF",
  text: "#111827",
  text2: "#374151",
  text3: "#6B7280",
  textMuted: "#6B7280",
  text4: "#8B92A0",
  textDim: "#8B92A0",
  text5: "#9AA0AE",
  blue: "#4F46E5",
  green: "#047857", greenBg: "#ECFDF5", greenBorder: "#A7F3D0",
  amber: "#B45309", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  red: "#B91C1C", redBg: "#FEF2F2", redBorder: "#FECACA",
  gold: "#E8B23A", goldText: "#3A2A06",
  pillBg: "#F3F4F8", pillBorder: "#E2E4EC",
  avatarBlue: "#4F46E5", avatarPurple: "#7C3AED", avatarGrey: "#E5E7EB",
  copilotGrad: "radial-gradient(120% 80% at 80% 0%,#FFF7E6 0%,#FFFFFF 45%)",
  font: "'Hanken Grotesk', sans-serif",
};

const PALETTES = { dark: DARK, light: LIGHT };

export function ThemeProvider({ children }) {
  // Defaults to light until every screen is converted to the palette —
  // several screens still have hardcoded white cards with no explicit text
  // color, which read as invisible white-on-white if dark is forced on.
  // The toggle still lets anyone preview dark on the screens that are done.
  const [theme, setTheme] = useState(() => {
    try { const saved = localStorage.getItem(KEY); return saved === "dark" ? "dark" : "light"; } catch { return "light"; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    document.documentElement.setAttribute("data-pq-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, palette: PALETTES[theme], toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Convenience: the active palette object, so components can do `const D = usePalette();`
export function usePalette() {
  return useContext(ThemeContext).palette;
}
