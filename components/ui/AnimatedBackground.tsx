'use client';

import { useEffect, useState, useRef } from 'react';

interface Star {
  id: number;
  left: string;
  top: string;
  delay: number;
  duration: number;
  size: number;
}

interface AnimatedBackgroundProps {
  variant?: 'default' | 'minimal' | 'intense';
  showStars?: boolean;
  showGrid?: boolean;
  showParticles?: boolean;
  enableSpotlight?: boolean;
}

// Generate random stars
function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: Math.random() * 5,
    duration: 2 + Math.random() * 3,
    size: 1 + Math.random() * 2,
  }));
}

export function AnimatedBackground({
  variant = 'default',
  showStars = true,
  showGrid = true,
  showParticles = true,
  enableSpotlight = true,
}: AnimatedBackgroundProps) {
  const [stars] = useState(() => generateStars(variant === 'intense' ? 80 : variant === 'minimal' ? 20 : 40));
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!enableSpotlight) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enableSpotlight]);

  const orbOpacity = variant === 'intense' ? 0.7 : variant === 'minimal' ? 0.4 : 0.5;
  const blobOpacity = variant === 'intense' ? 0.5 : variant === 'minimal' ? 0.25 : 0.35;

  return (
    <div className="fixed inset-0 overflow-hidden -z-10">
      {/* Base gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #030711 0%, #0a0f1a 40%, #070d17 70%, #05080f 100%)',
        }}
      />

      {/* Aurora orbs layer */}
      <div className="absolute inset-0 overflow-hidden" style={{ opacity: orbOpacity }}>
        {/* Primary blue orb */}
        <div 
          className="absolute rounded-full animate-aurora-drift"
          style={{
            top: '-20%',
            left: '-10%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(13, 140, 232, 0.4) 0%, transparent 70%)',
            filter: 'blur(80px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* Purple orb */}
        <div 
          className="absolute rounded-full"
          style={{
            top: '30%',
            right: '-20%',
            width: '50%',
            height: '50%',
            background: 'radial-gradient(circle, rgba(122, 60, 255, 0.35) 0%, transparent 70%)',
            filter: 'blur(100px)',
            mixBlendMode: 'screen',
            animation: 'aurora-drift 30s ease-in-out infinite reverse',
            animationDelay: '-5s',
          }}
        />

        {/* Teal orb */}
        <div 
          className="absolute rounded-full"
          style={{
            bottom: '-30%',
            left: '20%',
            width: '55%',
            height: '55%',
            background: 'radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, transparent 70%)',
            filter: 'blur(90px)',
            mixBlendMode: 'screen',
            animation: 'aurora-drift 28s ease-in-out infinite',
            animationDelay: '-10s',
          }}
        />

        {/* Pink/magenta orb */}
        <div 
          className="absolute rounded-full"
          style={{
            bottom: '10%',
            right: '10%',
            width: '40%',
            height: '40%',
            background: 'radial-gradient(circle, rgba(212, 90, 255, 0.25) 0%, transparent 70%)',
            filter: 'blur(80px)',
            mixBlendMode: 'screen',
            animation: 'aurora-drift 22s ease-in-out infinite reverse',
            animationDelay: '-15s',
          }}
        />
      </div>

      {/* Floating mesh blobs */}
      {showParticles && (
        <div className="absolute inset-0 overflow-hidden" style={{ opacity: blobOpacity }}>
          <div 
            className="absolute animate-mesh-morph"
            style={{
              top: '10%',
              left: '15%',
              width: '300px',
              height: '300px',
              background: 'linear-gradient(135deg, rgba(13, 140, 232, 0.4), rgba(0, 217, 255, 0.3))',
              filter: 'blur(60px)',
              borderRadius: '50%',
              animation: 'mesh-morph 20s ease-in-out infinite, orb-float 15s ease-in-out infinite',
            }}
          />
          
          <div 
            className="absolute"
            style={{
              top: '60%',
              right: '20%',
              width: '250px',
              height: '250px',
              background: 'linear-gradient(135deg, rgba(122, 60, 255, 0.4), rgba(212, 90, 255, 0.3))',
              filter: 'blur(60px)',
              borderRadius: '50%',
              animation: 'mesh-morph 18s ease-in-out infinite reverse, orb-float-reverse 18s ease-in-out infinite',
              animationDelay: '-5s',
            }}
          />
          
          <div 
            className="absolute"
            style={{
              bottom: '20%',
              left: '30%',
              width: '200px',
              height: '200px',
              background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.4), rgba(13, 140, 232, 0.3))',
              filter: 'blur(50px)',
              borderRadius: '50%',
              animation: 'mesh-morph 22s ease-in-out infinite, orb-float 20s ease-in-out infinite',
              animationDelay: '-8s',
            }}
          />
        </div>
      )}

      {/* Grid overlay */}
      {showGrid && (
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
          }}
        />
      )}

      {/* Stars */}
      {showStars && isClient && (
        <div className="absolute inset-0 overflow-hidden">
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white"
              style={{
                left: star.left,
                top: star.top,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animation: `star-twinkle ${star.duration}s ease-in-out infinite`,
                animationDelay: `${star.delay}s`,
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      )}

      {/* Mouse spotlight */}
      {enableSpotlight && isClient && (
        <div
          ref={spotlightRef}
          className="pointer-events-none fixed rounded-full transition-opacity duration-300"
          style={{
            width: '400px',
            height: '400px',
            left: mousePosition.x,
            top: mousePosition.y,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(13, 140, 232, 0.08) 0%, transparent 60%)',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Subtle vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%)',
        }}
      />

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.02,
        }}
      />
    </div>
  );
}

// Simpler background for performance-sensitive areas
export function SimpleGradientBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(at 40% 20%, rgba(13, 140, 232, 0.12) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(122, 60, 255, 0.08) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(212, 90, 255, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 50%, rgba(0, 217, 255, 0.08) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(20, 184, 166, 0.08) 0px, transparent 50%),
            linear-gradient(135deg, #030711 0%, #0a0f1a 50%, #05080f 100%)
          `,
        }}
      />
    </div>
  );
}

// Animated gradient line/divider
export function GradientLine({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`h-px ${className}`}
      style={{
        background: 'linear-gradient(90deg, transparent, var(--accent-blue), var(--accent-purple-1), var(--accent-cyan), transparent)',
        backgroundSize: '200% 100%',
        animation: 'gradient-flow 4s ease infinite',
      }}
    />
  );
}

// Glowing orb component for decorative use
export function GlowingOrb({ 
  color = 'blue', 
  size = 'md', 
  className = '' 
}: { 
  color?: 'blue' | 'purple' | 'teal' | 'pink';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const colors = {
    blue: 'rgba(13, 140, 232, 0.3)',
    purple: 'rgba(122, 60, 255, 0.3)',
    teal: 'rgba(20, 184, 166, 0.3)',
    pink: 'rgba(212, 90, 255, 0.3)',
  };

  const sizes = {
    sm: '100px',
    md: '200px',
    lg: '300px',
  };

  return (
    <div 
      className={`absolute rounded-full animate-breathe ${className}`}
      style={{
        width: sizes[size],
        height: sizes[size],
        background: `radial-gradient(circle, ${colors[color]} 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }}
    />
  );
}

