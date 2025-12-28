'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

interface FAQItem {
    question: string;
    answer: React.ReactNode;
}

const faqs: { category: string; items: FAQItem[] }[] = [
    {
        category: 'General',
        items: [
            { question: 'What is DownAria?', answer: 'DownAria is a free social media video downloader for Facebook, Instagram, Twitter/X, TikTok, YouTube, and Weibo. No watermarks!' },
            { question: 'Is DownAria free?', answer: 'Yes! Completely free. No registration required for basic usage.' },
            { question: 'Do I need to register?', answer: 'No registration needed. Just paste the URL and download!' },
        ],
    },
    {
        category: 'Telegram Bot (@downariaxt_bot)',
        items: [
            { question: 'How do I use the Telegram bot?', answer: 'Just send any supported URL to @downariaxt_bot. The bot will automatically detect the platform and send you the media.' },
            { question: 'What are the bot rate limits?', answer: 'Free users: 8 downloads/day with 4s cooldown. VIP (Donators): Unlimited downloads, no cooldown.' },
            { question: 'Why did my download get stuck on "Processing..."?', answer: 'This bug has been fixed in v2.0.0! If you still experience it, the bot now has a 60-second timeout and will show an error message instead of hanging forever.' },
            { question: 'How do I become VIP?', answer: 'Use /donate command in the bot to see donation options. VIP status is linked to your API key.' },
            { question: 'Can I download multiple URLs at once?', answer: 'VIP users can send up to 5 URLs per message. Free users are limited to 1 URL per message.' },
        ],
    },
    {
        category: 'Downloads',
        items: [
            { question: 'Why is my download failing?', answer: 'Common reasons: private content (needs cookie), invalid URL, or rate limit exceeded. Check the troubleshooting guide.' },
            { question: 'How do I download private content?', answer: <span>Add your cookie in Settings. See the <Link href="/docs/guides/cookies" className="text-[var(--accent-primary)] hover:underline">Cookie Setup Guide</Link>.</span> },
            { question: 'What quality options are available?', answer: 'Quality depends on the original video. We provide all available qualities from the platform (360p to 1080p+).' },
            { question: 'Why does the bot send SD instead of HD?', answer: 'If HD video exceeds 40MB (Telegram limit), the bot automatically sends SD with an HD download link button.' },
        ],
    },
    {
        category: 'Technical',
        items: [
            { question: 'What are cookies and why do I need them?', answer: 'Cookies identify your logged-in session. Required for private content, stories, or age-restricted videos.' },
            { question: 'What are the rate limits?', answer: 'Public: 15 req/min. With API key: 100 req/min. Playground: 5 req/2min.' },
            { question: 'What was fixed in v2.0.0?', answer: 'Major bot reliability fixes: "Processing Stuck" bug, memory leaks from sessions, rate limit bypass at midnight, duplicate request handling, and silent error failures.' },
        ],
    },
    {
        category: 'Privacy',
        items: [
            { question: 'Do you store my data?', answer: 'No. We don\'t store videos or personal data. Cookies are stored locally and encrypted.' },
            { question: 'Is my cookie safe?', answer: 'Yes. Cookies are encrypted with AES-256 and stored locally. Transmitted over HTTPS only.' },
        ],
    },
];

function FAQAccordion({ item }: { item: FAQItem }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-b border-[var(--border-color)] last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-4 text-left group"
            >
                <span className="font-medium text-[var(--text-primary)] text-sm pr-4 group-hover:text-[var(--accent-primary)] transition-colors">
                    {item.question}
                </span>
                <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pb-4 text-sm text-[var(--text-muted)] leading-relaxed">
                            {item.answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function FAQPage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium mb-4">
                            <HelpCircle className="w-3.5 h-3.5" />
                            FAQ
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            Frequently Asked <span className="gradient-text">Questions</span>
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            Find answers to common questions about DownAria.
                        </p>
                    </motion.div>

                    {/* FAQ Sections */}
                    {faqs.map((section, idx) => (
                        <motion.div
                            key={section.category}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="glass-card p-5"
                        >
                            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{section.category}</h2>
                            <div className="px-1">
                                {section.items.map((item, i) => (
                                    <FAQAccordion key={i} item={item} />
                                ))}
                            </div>
                        </motion.div>
                    ))}

                    {/* Still have questions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass-card p-6 text-center"
                    >
                        <h3 className="font-semibold text-[var(--text-primary)] mb-2">Still have questions?</h3>
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Check out our troubleshooting guide or contact us.
                        </p>
                        <div className="flex justify-center gap-3">
                            <Link
                                href="/docs/guides/troubleshooting"
                                className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium transition-colors"
                            >
                                Troubleshooting
                            </Link>
                            <Link
                                href="/about"
                                className="px-4 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-medium transition-colors"
                            >
                                Contact Us
                            </Link>
                        </div>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
