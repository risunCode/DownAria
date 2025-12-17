'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const words = ['Videos', 'Pictures', 'Reels', 'Posts'];

export function AnimatedHeroText() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((current) => (current + 1) % words.length);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 min-h-[120px] sm:min-h-[140px]">
            <div className="flex flex-col items-center">
                <span className="gradient-text">Download Multiple</span>
                <div className="relative h-16 sm:h-20 overflow-hidden w-full flex justify-center">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={words[index]}
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -60, opacity: 0 }}
                            transition={{
                                y: { type: "spring", stiffness: 100, damping: 20 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute text-[var(--accent-primary)] font-extrabold"
                        >
                            {words[index]}
                        </motion.span>
                    </AnimatePresence>
                </div>
                <span className="text-[var(--text-secondary)]">Easily!</span>
            </div>
        </h1>
    );
}
