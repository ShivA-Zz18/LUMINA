/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{html,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Cosmic palette
        deep: {
          900: "#1a1a2e",  // Space-tech deep purple
          800: "#16213e",
          700: "#0f3460",
        },
        neon: {
          cyan: "#00f2ff",   // Bright cyan
          purple: "#a855f7",
          pink: "#f472b6",
          green: "#34d399",
          blue: "#3b82f6",
        },
        glass: {
          light: "rgba(15, 15, 45, 0.1)",
          DEFAULT: "rgba(15, 15, 45, 0.5)",
          dark: "rgba(10, 10, 30, 0.75)",
        }
      },
      backgroundColor: {
        glass: "var(--bg-glass)",
        surface: "var(--bg-surface)",
        card: "var(--bg-card)",
      },
      borderColor: {
        glass: "var(--border-glass)",
        active: "var(--border-active)",
      },
      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      backdropBlur: {
        DEFAULT: "20px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(124,58,237,0.15), 0 0 60px rgba(124,58,237,0.05)",
        "glow-cyan": "0 0 20px rgba(34,211,238,0.15), 0 0 60px rgba(34,211,238,0.05)",
        "glow-pink": "0 0 20px rgba(244,114,182,0.15), 0 0 60px rgba(244,114,182,0.05)",
      },
      animation: {
        "float": "float 4s ease-in-out infinite",
        "spin-slow": "spin-slow 25s linear infinite",
        "shimmer": "shimmer 3s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.5s ease-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" }
        },
        "spin-slow": {
          "from": { transform: "rotate(0deg)" },
          "to": { transform: "rotate(360deg)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" }
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" }
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(1.8)", opacity: "0" }
        }
      },
      backgroundImage: {
        "gradient-hero": "linear-gradient(135deg, #7c3aed 0%, #a855f7 30%, #ec4899 70%, #22d3ee 100%)",
        "gradient-glass": "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
      },
      fontFamily: {
        heading: ["Outfit", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
