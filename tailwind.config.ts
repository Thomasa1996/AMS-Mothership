import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import plugin from "tailwindcss/plugin";

// Light and dark themes. Grays, brand blue and the status colors are CSS variables, so one set of
// class names (bg-slate-50, text-red-600, ...) works in both. <html class="dark"> picks the dark set;
// anything inside .theme-light (client proposals) always stays light.

type Scale = Record<string, string>;
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
const MIRROR: Record<string, string> = { 50: "950", 100: "900", 200: "800", 300: "700", 400: "600", 500: "500", 600: "400", 700: "300", 800: "200", 900: "100" };

const brandLight: Scale = { 50: "#eef4ff", 100: "#dbe7ff", 500: "#2f6fed", 600: "#1f5ad6", 700: "#1a48aa" };
const brandDark: Scale = { 50: "#1c2a45", 100: "#23365c", 500: "#5b93ff", 600: "#3b78f0", 700: "#9dbfff" };

// Dark grays modeled on Windows dark mode: #1f1f1f page, #2b2b2b panels.
const slateDark: Scale = {
  50: "#1f1f1f", 100: "#2e2e2e", 200: "#3b3b3b", 300: "#4a4a4a", 400: "#858585",
  500: "#a3a3a3", 600: "#bdbdbd", 700: "#d4d4d4", 800: "#e6e6e6", 900: "#f3f3f3",
};

const STATUS = ["red", "rose", "amber", "emerald", "sky", "blue", "violet"] as const;

const light: Record<string, Scale> = { slate: pick(colors.slate, SHADES), brand: brandLight, surface: { DEFAULT: "#ffffff" } };
const dark: Record<string, Scale> = { slate: slateDark, brand: brandDark, surface: { DEFAULT: "#2b2b2b" } };
for (const c of STATUS) {
  light[c] = pick(colors[c], SHADES);
  dark[c] = Object.fromEntries(SHADES.map((s) => [s, colors[c][MIRROR[s] as keyof (typeof colors)[typeof c]]]));
}

function pick(scale: Scale, shades: string[]) {
  return Object.fromEntries(shades.map((s) => [s, scale[s]!]));
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const varName = (family: string, shade: string) => (shade === "DEFAULT" ? `--c-${family}` : `--c-${family}-${shade}`);

function vars(set: Record<string, Scale>) {
  return Object.fromEntries(Object.entries(set).flatMap(([f, scale]) => Object.entries(scale).map(([s, hex]) => [varName(f, s), rgb(hex)])));
}

function themed(family: string): Scale {
  return Object.fromEntries(Object.keys(light[family]!).map((s) => [s, `rgb(var(${varName(family, s)}) / <alpha-value>)`]));
}

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: { ...themed("slate"), 950: colors.slate[950] },
        brand: { ...themed("brand"), 900: "#0f2550" },
        surface: themed("surface").DEFAULT!,
        ...Object.fromEntries(STATUS.map((c) => [c, { ...themed(c), 950: colors[c][950] }])),
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root, .theme-light": { ...vars(light), colorScheme: "light" },
        ".dark": { ...vars(dark), colorScheme: "dark" },
        ".dark .theme-light": { ...vars(light), colorScheme: "light" },
      });
    }),
  ],
} satisfies Config;
