/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#FAFAFA",
        card: "#FFFFFF",
        surface: "#F4F4F5",
        border: "#E4E4E7",
        foreground: "#09090B",
        muted: "#71717A",
        primary: "#18181B",
        destructive: "#DC2626",
      },
    },
  },
  plugins: [],
};
