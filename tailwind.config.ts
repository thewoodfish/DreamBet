import type { Config } from "tailwindcss";

const config: Config = {
  // Must cover all of src/: the per-asset gradient classes live in
  // src/lib/assets.ts, and are dropped from the build if it isn't scanned.
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        up: {
          DEFAULT: "#22c55e",
          soft: "#4ade80",
          deep: "#052e16",
        },
        down: {
          DEFAULT: "#f43f5e",
          soft: "#fb7185",
          deep: "#4c0519",
        },
      },
      boxShadow: {
        "glow-up": "0 0 0 1px rgba(34,197,94,.35), 0 8px 30px -6px rgba(34,197,94,.45)",
        "glow-down": "0 0 0 1px rgba(244,63,94,.35), 0 8px 30px -6px rgba(244,63,94,.45)",
        card: "inset 0 1px 0 0 rgba(255,255,255,.04)",
      },
      keyframes: {
        "pulse-ring": {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        shimmer: "shimmer 2.2s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
