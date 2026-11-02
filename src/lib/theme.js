import { createContext, useContext, useState, useEffect, createElement } from "react";

const STORAGE_KEY = "qb-dark";

const ThemeCtx = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0F0D0B" : "#FDF8F3");
    try { localStorage.setItem(STORAGE_KEY, dark); } catch {}
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return createElement(ThemeCtx.Provider, { value: { dark, toggle } }, children);
}

export function useTheme() { return useContext(ThemeCtx); }

export const THEME_CSS = `
:root {
  --qb-bg: #FDF8F3;
  --qb-bg-card: #FFF;
  --qb-bg-card-alt: #FDF8F3;
  --qb-bg-hover: #FDF5EE;
  --qb-border: #EDE0D0;
  --qb-border-light: #F5EDE4;
  --qb-text: #1C1C1E;
  --qb-text2: #8B7355;
  --qb-text3: #5C4033;
  --qb-accent: #C4602B;
  --qb-accent-light: #F0A882;
  --qb-accent-bg: #FCE8DE;
  --qb-input-bg: #FFF;
  --qb-input-readonly: #F9F6F2;
  --qb-modal-bg: #FFF;
  --qb-modal-overlay: rgba(28,14,8,0.55);
  --qb-shadow: 0 2px 8px rgba(196,96,43,0.05);
  --qb-shadow-lg: 0 8px 40px rgba(0,0,0,0.2);
  --qb-topbar-bg: rgba(253,248,243,0.95);
  --qb-bottom-bg: #FFF;
  --qb-nav-bg: #FDF8F3;
  --qb-cobro-bg: #F0FDF4;
  --qb-cobro-border: #BBF7D0;
  --qb-gasto-bg: #FEF2F2;
  --qb-gasto-border: #FECACA;
  --qb-presu-bg: #F5F3FF;
  --qb-presu-border: #DDD6FE;
  --qb-dropdown-bg: #FFF;
  --qb-dropdown-shadow: 0 4px 20px rgba(0,0,0,0.14);
  --qb-grab-bar: #D4C5B5;
  --qb-focus-ring: rgba(196,96,43,0.12);
  --qb-gradient-start: #C4602B;
  --qb-gradient-end: #9E4A1E;
  --qb-gradient-shadow: rgba(196,96,43,0.35);
  --qb-muted: #F3F4F6;
  --qb-muted-text: #6B7280;
  --qb-warning-bg: #FFFBEB;
  --qb-warning-border: #FDE68A;
  --qb-st-visita-bg: #F5F3FF;
  --qb-st-visita-border: #DDD6FE;
  --qb-st-pendiente-bg: #F3F4F6;
  --qb-st-pendiente-border: #D1D5DB;
  --qb-st-senada-bg: #E0F2FE;
  --qb-st-senada-border: #7DD3FC;
  --qb-st-confirmada-bg: #DCFCE7;
  --qb-st-confirmada-border: #86EFAC;
  --qb-st-finalizada-bg: #DBEAFE;
  --qb-st-finalizada-border: #93C5FD;
  --qb-st-cancelada-bg: #FEF2F2;
  --qb-st-cancelada-border: #FECACA;
}
:root.dark {
  --qb-bg: #0F0D0B;
  --qb-bg-card: #1A1714;
  --qb-bg-card-alt: #141210;
  --qb-bg-hover: #221E1A;
  --qb-border: #2E2822;
  --qb-border-light: #252017;
  --qb-text: #F0E8E0;
  --qb-text2: #A89880;
  --qb-text3: #C8B8A0;
  --qb-accent: #D4A574;
  --qb-accent-light: #BF9060;
  --qb-accent-bg: rgba(212,165,116,0.12);
  --qb-input-bg: #1A1714;
  --qb-input-readonly: #141210;
  --qb-modal-bg: #1A1714;
  --qb-modal-overlay: rgba(0,0,0,0.7);
  --qb-shadow: 0 2px 8px rgba(0,0,0,0.3);
  --qb-shadow-lg: 0 8px 40px rgba(0,0,0,0.5);
  --qb-topbar-bg: rgba(15,13,11,0.95);
  --qb-bottom-bg: #141210;
  --qb-nav-bg: #141210;
  --qb-cobro-bg: rgba(22,163,74,0.08);
  --qb-cobro-border: rgba(22,163,74,0.25);
  --qb-gasto-bg: rgba(220,38,38,0.08);
  --qb-gasto-border: rgba(220,38,38,0.25);
  --qb-presu-bg: rgba(124,58,237,0.08);
  --qb-presu-border: rgba(124,58,237,0.25);
  --qb-dropdown-bg: #1E1B17;
  --qb-dropdown-shadow: 0 4px 20px rgba(0,0,0,0.4);
  --qb-grab-bar: #3D3530;
  --qb-focus-ring: rgba(212,165,116,0.2);
  --qb-gradient-start: #8B6914;
  --qb-gradient-end: #6B4F0E;
  --qb-gradient-shadow: rgba(139,105,20,0.35);
  --qb-muted: rgba(107,114,128,0.12);
  --qb-muted-text: #9CA3AF;
  --qb-warning-bg: rgba(245,158,11,0.1);
  --qb-warning-border: rgba(245,158,11,0.3);
  --qb-st-visita-bg: rgba(124,58,237,0.1);
  --qb-st-visita-border: rgba(124,58,237,0.3);
  --qb-st-pendiente-bg: rgba(107,114,128,0.1);
  --qb-st-pendiente-border: rgba(107,114,128,0.3);
  --qb-st-senada-bg: rgba(2,132,199,0.1);
  --qb-st-senada-border: rgba(2,132,199,0.3);
  --qb-st-confirmada-bg: rgba(22,163,74,0.1);
  --qb-st-confirmada-border: rgba(22,163,74,0.3);
  --qb-st-finalizada-bg: rgba(29,78,216,0.1);
  --qb-st-finalizada-border: rgba(29,78,216,0.3);
  --qb-st-cancelada-bg: rgba(220,38,38,0.1);
  --qb-st-cancelada-border: rgba(220,38,38,0.3);
}
.dark input, .dark select, .dark textarea {
  background: var(--qb-input-bg) !important;
  border-color: var(--qb-border) !important;
  color: var(--qb-text) !important;
}
.dark input:focus, .dark select:focus, .dark textarea:focus {
  border-color: var(--qb-accent) !important;
  box-shadow: 0 0 0 3px var(--qb-focus-ring) !important;
}
.dark input::placeholder, .dark textarea::placeholder {
  color: var(--qb-text2) !important;
}
.dark option { background: var(--qb-input-bg); color: var(--qb-text); }
.dark button { color: inherit; }
`;
