'use client';

import { SidebarLayout } from '@/components/Sidebar';
import { motion } from 'framer-motion';
import { BoltIcon, LayersIcon, MagicIcon, LockIcon } from '@/components/ui/Icons';

export default function CreditsPage() {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <SidebarLayout>
            <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-12"
                >
                    {/* Header */}
                    <div className="text-center">
                        <motion.h1
                            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-4"
                            variants={item}
                        >
                            Credits & Acknowledgements
                        </motion.h1>
                        <motion.p
                            className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto"
                            variants={item}
                        >
                            DownAria wouldn't be possible without the incredible open-source community and these amazing technologies.
                        </motion.p>
                    </div>

                    {/* Creator Section */}
                    <motion.div variants={item} className="bg-[var(--bg-card)] rounded-2xl p-8 border border-[var(--border-color)] text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h2 className="text-2xl font-bold mb-2">Created by</h2>
                        <div className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 my-4">
                            risunCode
                        </div>
                        <p className="text-[var(--text-secondary)] mb-6">
                            Fullstack Developer • Open Source Enthusiast • UI/UX Designer
                        </p>
                        <div className="flex justify-center gap-4">
                            <a
                                href="https://github.com/risunCode"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all duration-300 font-medium"
                            >
                                GitHub
                            </a>
                            <a
                                href="https://risuncode.github.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all duration-300 font-medium"
                            >
                                Portfolio
                            </a>
                        </div>
                    </motion.div>

                    {/* Tech Stack Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div variants={item} className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)]">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                    <LayersIcon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Core Frameworks</h3>
                            </div>
                            <ul className="space-y-3 text-[var(--text-secondary)]">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    <strong>Next.js 15</strong> (App Router & Server Actions)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                    <strong>React 19</strong> (Latest Features)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                                    <strong>Tailwind CSS</strong> (Styling Engine)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                    <strong>Framer Motion</strong> (Animations)
                                </li>
                            </ul>
                        </motion.div>

                        <motion.div variants={item} className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-color)]">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                                    <BoltIcon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Backend & Infrastructure</h3>
                            </div>
                            <ul className="space-y-3 text-[var(--text-secondary)]">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    <strong>yt-dlp</strong> (The legendary media extractor)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                    <strong>Supabase</strong> (Database & Auth)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                    <strong>Redis (Upstash)</strong> (Rate Limiting & Caching)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                    <strong>BullMQ</strong> (Queue Management)
                                </li>
                            </ul>
                        </motion.div>
                    </div>

                    {/* Special Thanks */}
                    <motion.div variants={item} className="bg-[var(--bg-card)] rounded-xl p-8 border border-[var(--border-color)]">
                        <h3 className="text-xl font-bold mb-6 text-center">Special Thanks & APIs</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                            {['TikWM', 'ffmpeg', 'Sharp', 'Axios', 'Zod', 'Lucide React', 'SweetAlert2'].map((tech) => (
                                <span key={tech} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-sm font-medium hover:scale-105 transition-transform cursor-default border border-[var(--border-color)]">
                                    {tech}
                                </span>
                            ))}
                        </div>
                        <p className="text-center text-sm text-[var(--text-muted)] mt-8">
                            All trademarks, logos and brand names are the property of their respective owners. <br />
                            This project is based on <a href="https://github.com/risunCode/xtfetchs" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">xtfetchs</a> (GPL 3 License).
                        </p>
                    </motion.div>

                </motion.div>
            </div>
        </SidebarLayout>
    );
}
