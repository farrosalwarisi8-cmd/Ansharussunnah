// tailwind.config.ts

import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ["var(--font-arabic)", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          dark: "hsl(var(--primary-dark))",
          soft: "hsl(var(--primary-soft))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          dark: "hsl(var(--primary-dark))",
          soft: "hsl(var(--primary-soft))",
          foreground: "hsl(var(--gold-foreground))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 0.25rem)",
        "2xl": "calc(var(--radius) + 0.5rem)",
        "3xl": "calc(var(--radius) + 0.75rem)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.125rem)",
        sm: "calc(var(--radius) - 0.25rem)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        soft: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 4px 12px -2px rgb(15 23 42 / 0.06)",
        lifted:
          "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 12px 28px -6px rgb(15 23 42 / 0.10)",
        gold: "0 4px 14px -4px rgb(234 179 8 / 0.45)",
        "gold-soft": "0 2px 8px -2px rgb(234 179 8 / 0.30)",
        "sidebar": "2px 0 16px -4px rgb(15 23 42 / 0.24)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      spacing: {
        header: "4.5rem",
        sidebar: "16rem",
        "sidebar-lg": "17.5rem",
        "sidebar-collapsed": "4.75rem",
      },
      maxWidth: {
        content: "90rem",
        "content-lg": "100rem",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "pulse-soft": "pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.25s ease-out both",
        "slide-in-left": "slide-in-left 0.25s cubic-bezier(0.4, 0, 0.6, 1) both",
      },
    },
  },
  plugins: [],
}

export default config
