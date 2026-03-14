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
    },
  },
  plugins: [],
};

export default config;
