import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--oo-brand)",
          hover: "var(--oo-brand-hover)",
          muted: "var(--oo-brand-muted)",
        },
        mennyu: {
          primary: "var(--mennyu-primary)",
          secondary: "var(--mennyu-secondary)",
          accent: "var(--mennyu-accent)",
          muted: "var(--mennyu-muted)",
        },
      },
      maxWidth: {
        shell: "140rem",
        content: "90rem",
        prose: "65ch",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "mennyu-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "mennyu-cart-nudge": {
          "0%, 100%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.12)" },
          "60%": { transform: "scale(1)" },
        },
        "mennyu-hero-gradient": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "oo-fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "mennyu-fade-in": "mennyu-fade-in 0.45s ease-out forwards",
        "mennyu-cart-nudge": "mennyu-cart-nudge 0.55s ease-out",
        "mennyu-hero-gradient": "mennyu-hero-gradient 14s ease-in-out infinite",
        "oo-fade-up": "oo-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
