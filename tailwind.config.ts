import type { Config } from "tailwindcss";

const config: Config = {
  // Class-based so the gameday dashboard can offer an explicit dark/light
  // toggle rather than only following the OS.
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Parish brand palette — deep burgundy/navy with gold accent
        parish: {
          50:  "#fdf8f0",
          100: "#f5e8d0",
          200: "#eacfa0",
          300: "#dbb06a",
          400: "#ce9840",
          500: "#c4a882",  // gold accent
          600: "#b08f67",
          700: "#9a7550",
          800: "#7a5c3c",
          900: "#5e4530",
        },
        navy: {
          50:  "#f0f7f8",
          100: "#d8eced",
          200: "#a9d3d6",
          300: "#72b5ba",
          400: "#3e929a",
          500: "#286b73",  // main brand teal
          600: "#21575f",
          700: "#1a444a",
          800: "#143338",  // dark teal header
          900: "#0d2226",
          950: "#071417",
        },
        // Liturgical season colors (subtle accent strips)
        advent:       "#4a3070",  // violet/purple
        christmas:    "#c8a84b",  // gold
        lent:         "#6b4a9e",  // purple
        easter:       "#c8a84b",  // gold/white
        ordinary:     "#247a3e",  // green
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
