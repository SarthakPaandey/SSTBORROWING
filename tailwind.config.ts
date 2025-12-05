import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Custom design system colors
        'bg-very-dark': 'var(--bg-very-dark)',
        'bg-dark': 'var(--bg-dark)',
        'bg-surface-overlay': 'var(--glass-overlay)',
        'card-border': 'var(--card-border)',
        'accent-blue': 'var(--accent-blue)',
        'accent-cyan': 'var(--accent-cyan)',
        'accent-teal': 'var(--accent-teal)',
        'accent-purple-1': 'var(--accent-purple-1)',
        'accent-purple-2': 'var(--accent-purple-2)',
        'accent-pink': 'var(--accent-pink)',
        'text-muted': 'var(--text-muted)',
        'text-main': 'var(--text-main)',
        'success': 'var(--success)',
        'danger': 'var(--danger)',
        'warning': 'var(--warning)',
        'badge-blue': 'var(--badge-blue)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-purple': 'linear-gradient(90deg, var(--accent-purple-1) 0%, var(--accent-purple-2) 100%)',
        'gradient-blue': 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-cyan) 100%)',
        'gradient-mesh': 'radial-gradient(at 40% 20%, rgba(13, 140, 232, 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(122, 60, 255, 0.1) 0px, transparent 50%)',
        'aurora': 'linear-gradient(135deg, rgba(13, 140, 232, 0.15) 0%, rgba(122, 60, 255, 0.1) 25%, rgba(212, 90, 255, 0.1) 50%, rgba(0, 217, 255, 0.1) 75%, rgba(20, 184, 166, 0.15) 100%)',
        'grid-pattern': 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
      },
      boxShadow: {
        'glow-purple': '0 4px 20px rgba(122, 60, 255, 0.3)',
        'glow-purple-lg': '0 6px 30px rgba(122, 60, 255, 0.5)',
        'glow-blue': '0 4px 20px rgba(13, 140, 232, 0.3)',
        'glow-blue-lg': '0 8px 40px rgba(13, 140, 232, 0.5)',
        'glow-success': '0 4px 20px rgba(39, 196, 106, 0.3)',
        'glow-danger': '0 4px 20px rgba(255, 107, 107, 0.3)',
        'card': '0 8px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.015)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'card-glow': '0 0 40px rgba(47, 176, 255, 0.3), 0 15px 50px rgba(0, 0, 0, 0.7)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'fade-in-down': 'fadeInDown 0.5s ease-out',
        'fade-in-left': 'fadeInLeft 0.5s ease-out',
        'fade-in-right': 'fadeInRight 0.5s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'slide-in-up': 'slideInUp 0.5s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 2s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'success-pop': 'success-pop 0.5s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        // Premium animations
        'aurora': 'aurora 8s ease-in-out infinite',
        'aurora-drift': 'aurora-drift 25s ease-in-out infinite',
        'orb-float': 'orb-float 15s ease-in-out infinite',
        'orb-float-reverse': 'orb-float-reverse 18s ease-in-out infinite',
        'mesh-morph': 'mesh-morph 20s ease-in-out infinite',
        'gradient-flow': 'gradient-flow 4s ease infinite',
        'border-flow': 'border-flow 8s ease infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'twinkle': 'star-twinkle 3s ease-in-out infinite',
        'glow': 'glow-pulse 2s ease-in-out infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 4s ease-in-out infinite 1s',
        'spin-very-slow': 'spin-slow 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(13, 140, 232, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(13, 140, 232, 0.6), 0 0 60px rgba(13, 140, 232, 0.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-5deg)' },
          '75%': { transform: 'rotate(5deg)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'success-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        // Premium keyframes
        aurora: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: '0.3' },
          '25%': { transform: 'translateY(-15px) rotate(3deg) scale(1.05)', opacity: '0.5' },
          '50%': { transform: 'translateY(-30px) rotate(-2deg) scale(1.1)', opacity: '0.4' },
          '75%': { transform: 'translateY(-15px) rotate(4deg) scale(1.02)', opacity: '0.6' },
        },
        'aurora-drift': {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(30px, -50px) rotate(120deg)' },
          '66%': { transform: 'translate(-20px, -30px) rotate(240deg)' },
          '100%': { transform: 'translate(0, 0) rotate(360deg)' },
        },
        'orb-float': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.3' },
          '25%': { transform: 'translate(20px, -40px) scale(1.1)', opacity: '0.5' },
          '50%': { transform: 'translate(-30px, -60px) scale(0.9)', opacity: '0.4' },
          '75%': { transform: 'translate(10px, -30px) scale(1.05)', opacity: '0.35' },
        },
        'orb-float-reverse': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.25' },
          '25%': { transform: 'translate(-25px, 30px) scale(1.15)', opacity: '0.45' },
          '50%': { transform: 'translate(40px, 50px) scale(0.85)', opacity: '0.35' },
          '75%': { transform: 'translate(-15px, 20px) scale(1.08)', opacity: '0.4' },
        },
        'mesh-morph': {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%', transform: 'rotate(0deg) scale(1)' },
          '25%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%', transform: 'rotate(90deg) scale(1.05)' },
          '50%': { borderRadius: '50% 60% 30% 60% / 30% 40% 70% 50%', transform: 'rotate(180deg) scale(0.95)' },
          '75%': { borderRadius: '40% 50% 60% 40% / 60% 50% 40% 50%', transform: 'rotate(270deg) scale(1.02)' },
        },
        'gradient-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'border-flow': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'star-twinkle': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
export default config
