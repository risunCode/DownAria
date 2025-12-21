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
        <div className="my-2 rounded-lg bg-black/40 overflow-hidden max-w-full">
            <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 bg-black/30 border-b border-white/10">
                <span className="text-[10px] sm:text-xs text-purple-300">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 hover:text-white transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-2 sm:p-3 overflow-x-auto text-[10px] sm:text-xs text-gray-200 max-w-full">
                <code className="break-all whitespace-pre-wrap">{children}</code>
            </pre>
        </div>
    );
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isBot = message.role === 'bot';
    
    return (
        <div className={`flex gap-2 sm:gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                isBot ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
                {isBot ? <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>
            
            {/* Message bubble */}
            <div className={`max-w-[80%] sm:max-w-[85%] min-w-0 rounded-2xl px-3 sm:px-4 py-2 ${
                isBot 
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' 
                    : 'bg-purple-500 text-white'
            }`}>
                <div className="text-sm prose prose-sm prose-invert max-w-none break-words overflow-hidden
                    prose-p:my-1 prose-p:leading-relaxed
                    prose-headings:my-2 prose-headings:font-bold
                    prose-ul:my-1 prose-ol:my-1
                    prose-li:my-0
                    prose-table:my-2
                    prose-th:px-2 prose-th:py-1 sm:prose-th:px-3 sm:prose-th:py-1.5 prose-th:bg-black/20 prose-th:text-left prose-th:font-medium prose-th:text-xs
                    prose-td:px-2 prose-td:py-1 sm:prose-td:px-3 sm:prose-td:py-1.5 prose-td:border-t prose-td:border-white/10 prose-td:text-xs
                    prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-black/30 prose-code:text-purple-300 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-code:break-all
                    prose-strong:text-[var(--text-primary)] prose-strong:font-bold
                    prose-em:italic
                    prose-a:text-purple-400 prose-a:underline prose-a:break-all
                    prose-pre:my-2 prose-pre:max-w-full prose-pre:overflow-x-auto
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
