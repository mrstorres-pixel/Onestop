import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        leaf: "#1f8a5b",
        mint: "#dff5e8",
        sun: "#f5b041",
        berry: "#b7355c",
        paper: "#fbfaf6"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 32, 27, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
