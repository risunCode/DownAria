'use client';

import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Loader2, Cloud, AlertTriangle, Play, Bot } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { SidebarLayout } from '@/components/Sidebar';
import { useTranslations } from 'next-intl';

// Tab Components
import { ApiPlaygroundTab } from './components/ApiPlaygroundTab';
import { FacebookHtmlTab } from './components/FacebookHtmlTab';
import { DirectProxyTab } from './components/DirectProxyTab';
import { AIChatTab } from './components/AIChatTab';
import { YouTubeSandboxTab } from './components/YouTubeSandboxTab';

type TabType = 'playground' | 'facebook-html' | 'proxy' | 'ai-chat' | 'youtube-sandbox';

export default function AdvancedPage() {
    const [activeTab, setActiveTab] = useState<TabType>('playground');
    const t = useTranslations('advanced');

    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8 overflow-x-hidden">
                <div className="max-w-4xl mx-auto space-y-6 overflow-hidden">
                    {/* Header */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="text-center"
                    >
                        <h1 className="text-2xl font-bold gradient-text mb-2">{t('title')}</h1>
                        <p className="text-sm text-[var(--text-muted)]">{t('subtitle')}</p>
                    </motion.div>

                    {/* Warning Message */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-[var(--text-secondary)]">
                                <span className="font-medium text-amber-400">{t('warning.title')}</span> {t('warning.message')}
                            </p>
                        </div>
                    </motion.div>

                    {/* Tab Navigation */}
                    <div className="flex flex-wrap gap-2">
                        <TabButton 
                            active={activeTab === 'playground'} 
                            onClick={() => setActiveTab('playground')} 
                            icon={<Play className="w-4 h-4" />} 
                            label={t('tabs.playground')} 
                        />
                        <TabButton 
                            active={activeTab === 'ai-chat'} 
                            onClick={() => setActiveTab('ai-chat')} 
                            icon={<Bot className="w-4 h-4" />} 
                            label="AI Chat" 
                        />
                        <TabButton 
                            active={activeTab === 'facebook-html'} 
                            onClick={() => setActiveTab('facebook-html')} 
                            icon={<Code className="w-4 h-4" />} 
                            label={t('tabs.fbHtml')} 
                        />
                        <TabButton 
                            active={activeTab === 'proxy'} 
                            onClick={() => setActiveTab('proxy')} 
                            icon={<Cloud className="w-4 h-4" />} 
                            label={t('tabs.proxy')} 
                        />
                        <TabButton 
                            active={activeTab === 'youtube-sandbox'} 
                            onClick={() => setActiveTab('youtube-sandbox')} 
                            icon={<FontAwesomeIcon icon={faYoutube} className="w-4 h-4" />} 
                            label="YT Sandbox" 
                        />
                    </div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeTab} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {activeTab === 'playground' && <ApiPlaygroundTab />}
                            {activeTab === 'facebook-html' && (
                                <Suspense fallback={<LoadingCard />}>
                                    <FacebookHtmlTab />
                                </Suspense>
                            )}
                            {activeTab === 'proxy' && <DirectProxyTab />}
                            {activeTab === 'ai-chat' && <AIChatTab />}
                            {activeTab === 'youtube-sandbox' && <YouTubeSandboxTab />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </SidebarLayout>
    );
}

function TabButton({ 
    active, 
    onClick, 
    icon, 
    label 
}: { 
    active: boolean; 
    onClick: () => void; 
    icon: React.ReactNode; 
    label: string; 
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function LoadingCard() {
    return (
        <div className="glass-card p-5 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
    );
}