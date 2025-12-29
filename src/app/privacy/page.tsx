'use client';

import { useTranslations } from 'next-intl';
import { SidebarLayout } from '@/components/Sidebar';
import { motion } from 'framer-motion';

export default function PrivacyPage() {
    return (
        <SidebarLayout>
            <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-8"
                >
                    {/* Header */}
                    <div className="text-center border-b border-[var(--border-color)] pb-8">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                            Privacy Policy
                        </h1>
                        <p className="mt-2 text-[var(--text-secondary)]">
                            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </p>
                    </div>

                    <div className="prose prose-invert max-w-none text-[var(--text-secondary)] space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">1. Introduction</h2>
                            <p>
                                Welcome to DownAria. We respect your privacy and are committed to protecting your personal data.
                                This privacy policy will inform you as to how we look after your personal data when you visit our website
                                and tell you about your privacy rights.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">2. Data We Collect</h2>
                            <p>
                                <strong>We do not require you to create an account used to use our service.</strong>
                                However, we may process:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-2">
                                <li>
                                    <strong>Usage Data:</strong> Information about how you use our website, such as valid URL submissions
                                    (for caching purposes only).
                                </li>
                                <li>
                                    <strong>Cookies:</strong> We use local storage and cookies solely for functionality (e.g., saving your
                                    theme preference, download history, or third-party cookies you explicitly provide for premium downloads).
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">3. How We Use Your Data</h2>
                            <p>
                                We use the generic data we collect to:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-2">
                                <li>Provide and maintain our Service (e.g., verifying validity of video links).</li>
                                <li>Monitor the usage of our Service to detect and prevent technical issues.</li>
                                <li>Display relevant advertisements (via third-party ad networks).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">4. Disclaimer</h2>
                            <p>
                                DownAria is a tool for personal use only. We do not host any copyrighted content on our servers.
                                All files are downloaded directly from the respective CDN of the service provider (Facebook, TikTok, etc.).
                                Users are solely responsible for ensuring they have the right to download and use the content.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">5. Contact</h2>
                            <p>
                                If you have any questions about this Privacy Policy, please contact us via our GitHub repository issues page.
                            </p>
                        </section>
                    </div>
                </motion.div>
            </div>
        </SidebarLayout>
    );
}
