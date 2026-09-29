/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#102A43",
        foreground: "#F0F4F8",
        muted: "#9FB3C8",
        primary: "#208AEF",
      },
    },
  },
  plugins: [],
};
