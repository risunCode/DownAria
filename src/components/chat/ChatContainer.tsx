'use client';

import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Bot, Trash2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { askGPT, type ChatMessage as ChatMessageType } from '@/lib/services/gpt';

export function ChatContainer() {
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const MAX_MESSAGES = 100; // Limit to prevent memory issues

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (content: string) => {
        // Add user message
        const userMessage: ChatMessageType = {
            role: 'user',
            content,
            timestamp: Date.now(),
        };
        setMessages(prev => {
            const updated = [...prev, userMessage];
            // Keep only last MAX_MESSAGES
            return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
        });
        setIsLoading(true);

        // Get bot response
        const result = await askGPT(content);
        
        const botMessage: ChatMessageType = {
            role: 'bot',
            content: result.success ? (result.answer || 'No response') : `Error: ${result.error}`,
            timestamp: Date.now(),
        };
        setMessages(prev => {
            const updated = [...prev, botMessage];
            return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
        });
        setIsLoading(false);
    };

    const handleClear = () => {
        setMessages([]);
    };

    return (
        <div className="flex flex-col h-[400px] sm:h-[500px] rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">GPT-4 Turbo</h3>
                        <p className="text-[10px] sm:text-xs text-[var(--text-muted)] truncate">Knowledge: Nov 2023</p>
                    </div>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-colors flex-shrink-0"
                        title="Clear chat"
                    >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                )}
            </div>

            {/* Warning banner */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-500/10 border-b border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs text-amber-500 line-clamp-1">
                    Chat tidak disimpan. AI tidak akurat, harap validasi data.
                </p>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-3 sm:mb-4">
                            <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                        </div>
                        <h4 className="text-[var(--text-primary)] font-medium mb-1 text-sm sm:text-base">Start a conversation</h4>
                        <p className="text-xs sm:text-sm text-[var(--text-muted)]">Ask me anything!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => (
                            <ChatMessage key={idx} message={msg} />
                        ))}
                        {isLoading && (
                            <div className="flex gap-2 sm:gap-3">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                                </div>
                                <div className="bg-[var(--bg-secondary)] rounded-2xl px-3 sm:px-4 py-2 sm:py-3">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <ChatInput onSend={handleSend} disabled={isLoading} placeholder="Tanya sesuatu..." />
        </div>
    );
}
