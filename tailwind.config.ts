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
        mennyu: {
          primary: "var(--mennyu-primary)",
          secondary: "var(--mennyu-secondary)",
          accent: "var(--mennyu-accent)",
          muted: "var(--mennyu-muted)",
        },
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
      },
      animation: {
        "mennyu-fade-in": "mennyu-fade-in 0.45s ease-out forwards",
        "mennyu-cart-nudge": "mennyu-cart-nudge 0.55s ease-out",
        "mennyu-hero-gradient": "mennyu-hero-gradient 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
