'use client';

import { useState } from 'react';
import { Bot, User, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '@/lib/services/gpt';

interface ChatMessageProps {
    message: ChatMessageType;
}

// Code block with copy button
function CodeBlock({ children, className }: { children: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const language = className?.replace('language-', '') || 'code';
    
    const handleCopy = async () => {
        await navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    return (
        <div className="my-2 rounded-lg bg-black/40 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10">
                <span className="text-xs text-purple-300">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-3 overflow-x-auto text-xs text-gray-200">
                <code>{children}</code>
            </pre>
        </div>
    );
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isBot = message.role === 'bot';
    
    return (
        <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isBot ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            
            {/* Message bubble */}
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                isBot 
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' 
                    : 'bg-purple-500 text-white'
            }`}>
                <div className="text-sm prose prose-sm prose-invert max-w-none
                    prose-p:my-1 prose-p:leading-relaxed
                    prose-headings:my-2 prose-headings:font-bold
                    prose-ul:my-1 prose-ol:my-1
                    prose-li:my-0
                    prose-table:my-2
                    prose-th:px-3 prose-th:py-1.5 prose-th:bg-black/20 prose-th:text-left prose-th:font-medium
                    prose-td:px-3 prose-td:py-1.5 prose-td:border-t prose-td:border-white/10
                    prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-black/30 prose-code:text-purple-300 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                    prose-strong:text-[var(--text-primary)] prose-strong:font-bold
                    prose-em:italic
                    prose-a:text-purple-400 prose-a:underline
                ">
                    {isBot ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children, ...props }) {
                                    const isBlock = className?.includes('language-') || String(children).includes('\n');
                                    if (isBlock) {
                                        return <CodeBlock className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>;
                                    }
                                    return <code className={className} {...props}>{children}</code>;
                                },
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    ) : (
                        message.content
                    )}
                </div>
                <p className={`text-[10px] mt-1 ${isBot ? 'text-[var(--text-muted)]' : 'text-purple-200'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}
