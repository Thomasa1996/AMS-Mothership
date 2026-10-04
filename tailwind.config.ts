import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef4ff", 100: "#dbe7ff", 500: "#2f6fed", 600: "#1f5ad6", 700: "#1a48aa", 900: "#0f2550" },
      },
    },
  },
  plugins: [],
} satisfies Config;
