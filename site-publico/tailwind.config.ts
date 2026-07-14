import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Institutional steel-blue scale (matches the Symanek Suite admin theme)
        petrol: {
          50: "#eef4f9",
          100: "#d7e5f0",
          200: "#b0cbe1",
          300: "#7fa9cb",
          400: "#4f83af",
          500: "#316591",
          600: "#254e73",
          700: "#1d3f5e",
          800: "#173650",
          900: "#0f2740",
          950: "#0a1b2e",
        },
        accent: {
          DEFAULT: "#2f9e8f", // teal-green — healthcare / growth
          soft: "#e6f4f1",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        // Strong custom curves (emil-design-eng: built-in easings are too weak)
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 39, 64, 0.04), 0 8px 24px -8px rgba(15, 39, 64, 0.12)",
        "card-hover": "0 2px 4px rgba(15, 39, 64, 0.06), 0 16px 40px -12px rgba(15, 39, 64, 0.22)",
        glass: "0 8px 32px -8px rgba(15, 39, 64, 0.18)",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [],
};
export default config;
