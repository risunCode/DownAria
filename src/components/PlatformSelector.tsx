'use client';

import { motion } from 'framer-motion';
import { PlatformId, PLATFORMS } from '@/lib/types';

interface PlatformSelectorProps {
    selected: PlatformId;
    onChange: (platform: PlatformId) => void;
}

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
    return (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {PLATFORMS.map((platform) => (
                <motion.button
                    key={platform.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onChange(platform.id)}
                    className={`
            platform-tab ${platform.id}
            ${selected === platform.id ? 'active' : ''}
            flex items-center gap-2
          `}
                    style={{
                        '--platform-color': platform.color,
                    } as React.CSSProperties}
                >
                    <span className="text-lg">{platform.icon}</span>
                    <span className="hidden sm:inline">{platform.name}</span>
                </motion.button>
            ))}
        </div>
    );
}
