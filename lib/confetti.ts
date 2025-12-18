'use client';

import confetti from 'canvas-confetti';

// Default confetti burst for success celebrations
export function triggerSuccessConfetti() {
    // Fire from both sides
    const end = Date.now() + 1000; // 1 second

    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#f59e0b'];

    const frame = () => {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.6 },
            colors,
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.6 },
            colors,
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    };

    frame();
}

// Simple burst from center
export function triggerCenterConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#f59e0b'],
    });
}

// Star-shaped confetti for special events
export function triggerStarConfetti() {
    const defaults = {
        spread: 360,
        ticks: 60,
        gravity: 0,
        decay: 0.96,
        startVelocity: 20,
        colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
        shapes: ['star' as const],
    };

    const shoot = () => {
        confetti({
            ...defaults,
            particleCount: 30,
            scalar: 1.2,
            origin: { x: 0.5, y: 0.5 },
        });

        confetti({
            ...defaults,
            particleCount: 15,
            scalar: 0.75,
            origin: { x: 0.5, y: 0.5 },
        });
    };

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
}

// Fireworks-style confetti
export function triggerFireworks() {
    const duration = 2000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#3b82f6', '#10b981', '#8b5cf6'],
        });
        confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ['#f59e0b', '#06b6d4', '#ec4899'],
        });
    }, 250);
}

// Quick success burst (for booking confirmations)
export function triggerBookingSuccess() {
    // Cannon from bottom
    confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.9, x: 0.5 },
        colors: ['#10b981', '#34d399', '#6ee7b7'], // Green success colors
        startVelocity: 45,
        gravity: 1.2,
    });

    // Side bursts after a short delay (faster)
    setTimeout(() => {
        confetti({
            particleCount: 30,
            angle: 60,
            spread: 40,
            origin: { x: 0.1, y: 0.8 },
            colors: ['#3b82f6', '#60a5fa'],
        });
        confetti({
            particleCount: 30,
            angle: 120,
            spread: 40,
            origin: { x: 0.9, y: 0.8 },
            colors: ['#8b5cf6', '#a78bfa'],
        });
    }, 150);
}
