import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        line: {
          green: "#06C755",
          hover: "#05B04B",
          dark: "#00B900",
          light: "#E8F8EE",
          bubble: "#A9ECA2",
          bubbleDark: "#059640",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
