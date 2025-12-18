'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerBookingSuccess } from '@/lib/confetti';
import { CheckCircle2, PartyPopper, CalendarCheck } from 'lucide-react';

interface SuccessCelebrationProps {
    show: boolean;
    message?: string;
    subMessage?: string;
    type?: 'booking' | 'general';
    onAnimationComplete?: () => void;
}

export function SuccessCelebration({
    show,
    message = 'Success!',
    subMessage = 'Redirecting...',
    type = 'booking',
    onAnimationComplete,
}: SuccessCelebrationProps) {
    const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

    useEffect(() => {
        if (show && !hasTriggeredConfetti) {
            setHasTriggeredConfetti(true);
            triggerBookingSuccess();
        }

        if (!show) {
            setHasTriggeredConfetti(false);
        }
    }, [show, hasTriggeredConfetti]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-bg-dark/80 backdrop-blur-sm"
                    onAnimationComplete={onAnimationComplete}
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 via-card to-cyan-500/10 border border-emerald-500/30 p-8 max-w-sm mx-4 shadow-2xl"
                    >
                        {/* Animated background glow - faster pulse */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"
                            animate={{
                                opacity: [0.3, 0.5, 0.3],
                            }}
                            transition={{
                                duration: 0.8,
                                repeat: 2,
                            }}
                        />

                        <div className="relative flex flex-col items-center text-center space-y-4">
                            {/* Animated checkmark */}
                            <motion.div
                                initial={{ scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 400,
                                    damping: 20,
                                    delay: 0.1,
                                }}
                                className="relative"
                            >
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                                    <CheckCircle2 className="w-10 h-10 text-white" />
                                </div>

                                {/* Pulse ring - single quick pulse */}
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-emerald-400"
                                    initial={{ scale: 1, opacity: 1 }}
                                    animate={{ scale: 1.4, opacity: 0 }}
                                    transition={{
                                        duration: 0.5,
                                        repeat: 1,
                                        repeatDelay: 0.2,
                                    }}
                                />
                            </motion.div>

                            {/* Message */}
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.2 }}
                                className="space-y-2"
                            >
                                <h3 className="text-2xl font-bold text-text-main flex items-center justify-center gap-2">
                                    {message}
                                    <motion.span
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 0.3, delay: 0.25 }}
                                    >
                                        {type === 'booking' ? (
                                            <CalendarCheck className="w-6 h-6 text-emerald-400" />
                                        ) : (
                                            <PartyPopper className="w-6 h-6 text-emerald-400" />
                                        )}
                                    </motion.span>
                                </h3>
                                <p className="text-text-muted text-sm">{subMessage}</p>
                            </motion.div>

                            {/* Loading dots - faster animation */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-1"
                            >
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="w-2 h-2 rounded-full bg-emerald-400"
                                        animate={{
                                            y: [-1, 1, -1],
                                            opacity: [0.6, 1, 0.6],
                                        }}
                                        transition={{
                                            duration: 0.4,
                                            repeat: 2,
                                            delay: i * 0.08,
                                        }}
                                    />
                                ))}
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Simple inline success message with animation (for use within cards)
export function InlineSuccess({
    show,
    message = 'Success!',
}: {
    show: boolean;
    message?: string;
}) {
    useEffect(() => {
        if (show) {
            triggerBookingSuccess();
        }
    }, [show]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 p-4 flex items-center gap-3"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </motion.div>
                    <p className="text-sm text-emerald-300 font-medium">{message}</p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
