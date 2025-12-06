'use client';

import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

// Animation variants for reuse
export const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

export const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

export const scaleIn = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
};

export const slideInLeft = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
};

export const slideInRight = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
};

// Stagger container for lists
export const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.05,
        },
    },
};

// Default transition
export const defaultTransition = {
    type: 'spring',
    stiffness: 300,
    damping: 30,
};

export const smoothTransition = {
    duration: 0.3,
    ease: 'easeOut' as const,
};

// Animated wrapper components
interface AnimatedDivProps extends HTMLMotionProps<'div'> {
    children: ReactNode;
    delay?: number;
}

export function FadeInUp({ children, delay = 0, ...props }: AnimatedDivProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...smoothTransition, delay }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function FadeIn({ children, delay = 0, ...props }: AnimatedDivProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...smoothTransition, delay }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function ScaleIn({ children, delay = 0, ...props }: AnimatedDivProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...smoothTransition, delay }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function SlideInLeft({ children, delay = 0, ...props }: AnimatedDivProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...smoothTransition, delay }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Stagger list wrapper - children will animate one by one
interface StaggerListProps {
    children: ReactNode;
    className?: string;
}

export function StaggerList({ children, className }: StaggerListProps) {
    return (
        <motion.div
            className={className}
            initial="initial"
            animate="animate"
            variants={{
                animate: {
                    transition: {
                        staggerChildren: 0.05,
                    },
                },
            }}
        >
            {children}
        </motion.div>
    );
}

// Individual stagger item
export function StaggerItem({ children, ...props }: AnimatedDivProps) {
    return (
        <motion.div
            variants={{
                initial: { opacity: 0, y: 15 },
                animate: {
                    opacity: 1,
                    y: 0,
                    transition: smoothTransition
                },
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Animated button with hover/tap effects
interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
    children: ReactNode;
    variant?: 'default' | 'subtle';
}

export function AnimatedButton({ children, variant = 'default', ...props }: AnimatedButtonProps) {
    const hoverScale = variant === 'subtle' ? 1.02 : 1.05;
    const tapScale = variant === 'subtle' ? 0.99 : 0.95;

    return (
        <motion.button
            whileHover={{
                scale: hoverScale,
                transition: { duration: 0.2 }
            }}
            whileTap={{
                scale: tapScale,
                transition: { duration: 0.1 }
            }}
            {...props}
        >
            {children}
        </motion.button>
    );
}

// Animated card with hover lift effect
interface AnimatedCardProps extends HTMLMotionProps<'div'> {
    children: ReactNode;
    hoverLift?: boolean;
}

export function AnimatedCard({ children, hoverLift = true, ...props }: AnimatedCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={smoothTransition}
            whileHover={hoverLift ? {
                y: -4,
                transition: { duration: 0.2 }
            } : undefined}
            {...props}
        >
            {children}
        </motion.div>
    );
}

// Page wrapper with fade animation
interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
}

// Re-export for convenience
export { motion, AnimatePresence };
