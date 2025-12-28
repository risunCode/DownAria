'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Send, Bot, User, Loader2, Image as ImageIcon, X, 
    Sparkles, Globe, RefreshCw, Copy, Check, AlertCircle,
    ChevronDown, Trash2, Key, Download, Upload, History
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const STORAGE_KEY = 'downaria_ai_chat_sessions';

type AIModel = 'gemini-2.5-flash' | 'gemini-flash-latest' | 'gpt5' | 'copilot-smart';

// Models that support image upload and web search (Gemini only)
const GEMINI_MODELS: AIModel[] = ['gemini-2.5-flash', 'gemini-flash-latest'];

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image?: string; // base64 data URL
    timestamp: Date;
    model?: string;
    tokensUsed?: number;
}

interface SavedSession {
    sessionKey: string;
    messages: ChatMessage[];
    model: AIModel;
    savedAt: string;
    title: string;
}

interface AIChatProps {
    className?: string;
}

const MODEL_OPTIONS: { value: AIModel; label: string; description: string }[] = [
    { value: 'gemini-2.5-flash', label: 'Flash 2.5', description: 'Fast & balanced' },
    { value: 'gemini-flash-latest', label: 'Flash Latest', description: 'Newest version' },
    { value: 'gpt5', label: 'GPT-5', description: 'OpenAI GPT-5' },
    { value: 'copilot-smart', label: 'Copilot Smart', description: 'Microsoft Copilot' },
];

export function AIChat({ className = '' }: AIChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionKey, setSessionKey] = useState<string | null>(null);
    const [model, setModel] = useState<AIModel>('gemini-2.5-flash');
    
    // Check if current model supports image/web search (Gemini only)
    const supportsAdvancedFeatures = GEMINI_MODELS.includes(model);
    const [webSearch, setWebSearch] = useState(false);
    const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showModelSelect, setShowModelSelect] = useState(false);
    const [showSessionMenu, setShowSessionMenu] = useState(false);
    const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
    const [rateLimit, setRateLimit] = useState({ remaining: 60, limit: 60 });
    const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const sessionMenuRef = useRef<HTMLDivElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);
    
    // Check dropdown position based on available space
    const checkDropdownPosition = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
        if (!ref.current) return 'bottom';
        const rect = ref.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // If less than 200px below and more space above, show on top
        return spaceBelow < 200 && spaceAbove > spaceBelow ? 'top' : 'bottom';
    }, []);
    
    // Load saved sessions from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const sessions = JSON.parse(saved) as SavedSession[];
                // Convert timestamp strings back to Date objects
                sessions.forEach(s => {
                    s.messages = s.messages.map(m => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                });
                setSavedSessions(sessions);
            }
        } catch {}
    }, []);
    
    // Save sessions to localStorage
    const saveSessions = useCallback((sessions: SavedSession[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            setSavedSessions(sessions);
        } catch {}
    }, []);
    
    // Save current session
    const saveCurrentSession = useCallback(() => {
        if (!sessionKey || messages.length === 0) return;
        
        const title = messages[0]?.content.slice(0, 50) || 'Untitled';
        const newSession: SavedSession = {
            sessionKey,
            messages,
            model,
            savedAt: new Date().toISOString(),
            title: title + (title.length >= 50 ? '...' : ''),
        };
        
        // Update or add session
        const existing = savedSessions.findIndex(s => s.sessionKey === sessionKey);
        let updated: SavedSession[];
        if (existing >= 0) {
            updated = [...savedSessions];
            updated[existing] = newSession;
        } else {
            updated = [newSession, ...savedSessions].slice(0, 10); // Keep max 10 sessions
        }
        
        saveSessions(updated);
    }, [sessionKey, messages, model, savedSessions, saveSessions]);
    
    // Load a saved session
    const loadSession = useCallback((session: SavedSession) => {
        setSessionKey(session.sessionKey);
        setMessages(session.messages);
        setModel(session.model);
        setShowSessionMenu(false);
    }, []);
    
    // Delete a saved session
    const deleteSession = useCallback((key: string) => {
        const updated = savedSessions.filter(s => s.sessionKey !== key);
        saveSessions(updated);
    }, [savedSessions, saveSessions]);
    
    // Export sessions as JSON
    const exportSessions = useCallback(() => {
        const data = JSON.stringify(savedSessions, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `downaria-ai-sessions-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [savedSessions]);
    
    // Import sessions from JSON
    const importSessions = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const imported = JSON.parse(reader.result as string) as SavedSession[];
                // Merge with existing, avoiding duplicates
                const merged = [...savedSessions];
                imported.forEach(session => {
                    if (!merged.find(s => s.sessionKey === session.sessionKey)) {
                        merged.push(session);
                    }
                });
                saveSessions(merged.slice(0, 20)); // Keep max 20
            } catch {
                setError('Invalid backup file');
            }
        };
        reader.readAsText(file);
        if (importInputRef.current) importInputRef.current.value = '';
    }, [savedSessions, saveSessions]);
    
    // Copy session key
    const copySessionKey = useCallback(async () => {
        if (!sessionKey) return;
        await navigator.clipboard.writeText(sessionKey);
        setCopiedId('session');
        setTimeout(() => setCopiedId(null), 2000);
    }, [sessionKey]);
    
    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
        }
    }, [input]);
    
    // Handle image upload
    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Validate type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }
        
        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
            setImage({
                file,
                preview: reader.result as string,
            });
        };
        reader.readAsDataURL(file);
    }, []);
    
    // Remove image
    const removeImage = useCallback(() => {
        setImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);
    
    // Copy message
    const copyMessage = useCallback(async (id: string, content: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);
    
    // Clear chat
    const clearChat = useCallback(() => {
        // Auto-save before clearing if there's content
        if (sessionKey && messages.length > 0) {
            saveCurrentSession();
        }
        setMessages([]);
        setSessionKey(null);
        setError(null);
    }, [sessionKey, messages, saveCurrentSession]);
    
    // Send message
    const sendMessage = useCallback(async () => {
        if (!input.trim() && !image) return;
        if (isLoading) return;
        
        // Capture image data before clearing
        const currentImage = image;
        
        const userMessage: ChatMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: input.trim(),
            image: currentImage?.preview,
            timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        removeImage(); // Clear image immediately after adding to message
        setError(null);
        setIsLoading(true);
        
        try {
            // Prepare image data from captured image
            let imageData: { mimeType: string; data: string } | undefined;
            if (currentImage) {
                const base64 = currentImage.preview.split(',')[1];
                const mimeType = currentImage.file.type;
                imageData = { mimeType, data: base64 };
            }
            
            const response = await fetch(`${API_URL}/api/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    image: imageData,
                    sessionKey,
                    model,
                    webSearch,
                }),
            });
            
            const data = await response.json();
            
            if (data.rateLimit) {
                setRateLimit(data.rateLimit);
            }
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to get response');
            }
            
            // Update session key
            if (data.sessionKey) {
                setSessionKey(data.sessionKey);
            }
            
            // Add assistant message
            const assistantMessage: ChatMessage = {
                id: `assistant_${Date.now()}`,
                role: 'assistant',
                content: data.text || '',
                timestamp: new Date(),
                model: data.model,
                tokensUsed: data.tokensUsed,
            };
            
            setMessages(prev => [...prev, assistantMessage]);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    }, [input, image, isLoading, sessionKey, model, webSearch, removeImage]);
    
    // Handle key press
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);
    
    return (
        <div className={`flex flex-col h-[600px] glass-card overflow-hidden w-full max-w-full ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--border-color)] gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                        <Bot className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">AI Assistant</h3>
                        <p className="text-xs text-[var(--text-muted)]">
                            {model === 'gpt5' ? 'GPT-5' : 
                             model === 'copilot-smart' ? 'Copilot Smart' : 
                             'Powered by Gemini'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Session Key Display - Gemini only */}
                    {sessionKey && supportsAdvancedFeatures && (
                        <button
                            onClick={copySessionKey}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-secondary)] text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            title="Click to copy session key"
                        >
                            <Key className="w-3 h-3" />
                            {sessionKey.slice(0, 12)}...
                            {copiedId === 'session' && <Check className="w-3 h-3 text-green-400" />}
                        </button>
                    )}
                    
                    {/* Rate Limit */}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                        rateLimit.remaining > 10 ? 'bg-green-500/20 text-green-400' : 
                        rateLimit.remaining > 0 ? 'bg-amber-500/20 text-amber-400' : 
                        'bg-red-500/20 text-red-400'
                    }`}>
                        {rateLimit.remaining}/{rateLimit.limit}
                    </span>
                    
                    {/* Session Menu - Gemini only */}
                    {supportsAdvancedFeatures && (
                    <div className="relative" ref={sessionMenuRef}>
                        <button
                            onClick={() => { 
                                const pos = checkDropdownPosition(sessionMenuRef);
                                setDropdownPosition(pos);
                                setShowSessionMenu(!showSessionMenu); 
                                setShowModelSelect(false); 
                            }}
                            className="p-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            title="Session History"
                        >
                            <History className="w-4 h-4" />
                        </button>
                        
                        <AnimatePresence>
                            {showSessionMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: dropdownPosition === 'bottom' ? -10 : 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: dropdownPosition === 'bottom' ? -10 : 10 }}
                                    className={`absolute right-0 w-72 p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50 ${
                                        dropdownPosition === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--border-color)]">
                                        <span className="text-xs font-medium">Saved Sessions</span>
                                        <div className="flex gap-1">
                                            <input
                                                ref={importInputRef}
                                                type="file"
                                                accept=".json"
                                                onChange={importSessions}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => importInputRef.current?.click()}
                                                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                                title="Import Backup"
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={exportSessions}
                                                disabled={savedSessions.length === 0}
                                                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] disabled:opacity-50"
                                                title="Export Backup"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Save Current */}
                                    {sessionKey && messages.length > 0 && (
                                        <button
                                            onClick={() => { saveCurrentSession(); setShowSessionMenu(false); }}
                                            className="w-full flex items-center gap-2 p-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs mb-2 hover:bg-[var(--accent-primary)]/20"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Save Current Session
                                        </button>
                                    )}
                                    
                                    {/* Sessions List */}
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {savedSessions.length === 0 ? (
                                            <p className="text-xs text-[var(--text-muted)] text-center py-4">
                                                No saved sessions
                                            </p>
                                        ) : (
                                            savedSessions.map(session => (
                                                <div
                                                    key={session.sessionKey}
                                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-secondary)] group"
                                                >
                                                    <button
                                                        onClick={() => loadSession(session)}
                                                        className="flex-1 text-left min-w-0"
                                                    >
                                                        <p className="text-xs font-medium truncate">{session.title}</p>
                                                        <p className="text-[10px] text-[var(--text-muted)]">
                                                            {new Date(session.savedAt).toLocaleDateString()} • {session.messages.length} msgs
                                                        </p>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSession(session.sessionKey)}
                                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    )}
                    
                    {/* Model Selector */}
                    <div className="relative" ref={modelMenuRef}>
                        <button
                            onClick={() => { 
                                const pos = checkDropdownPosition(modelMenuRef);
                                setDropdownPosition(pos);
                                setShowModelSelect(!showModelSelect); 
                                setShowSessionMenu(false); 
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            {MODEL_OPTIONS.find(m => m.value === model)?.label}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        <AnimatePresence>
                            {showModelSelect && (
                                <motion.div
                                    initial={{ opacity: 0, y: dropdownPosition === 'bottom' ? -10 : 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: dropdownPosition === 'bottom' ? -10 : 10 }}
                                    className={`absolute right-0 w-48 p-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50 ${
                                        dropdownPosition === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'
                                    }`}
                                >
                                    {MODEL_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setModel(opt.value); setShowModelSelect(false); }}
                                            className={`w-full flex flex-col items-start p-2 rounded-lg text-left transition-colors ${
                                                model === opt.value ? 'bg-purple-500/20' : 'hover:bg-[var(--bg-secondary)]'
                                            }`}
                                        >
                                            <span className="text-sm font-medium">{opt.label}</span>
                                            <span className="text-xs text-[var(--text-muted)]">{opt.description}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    
                    {/* Clear Chat */}
                    {messages.length > 0 && (
                        <button
                            onClick={clearChat}
                            className="p-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                            title="Clear Chat"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Warning Banner for non-session models */}
            {!supportsAdvancedFeatures && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                    <p className="text-xs text-amber-400 text-center">
                        ⚠️ {model === 'gpt5' ? 'GPT-5' : 'Copilot Smart'} tidak mendukung session. Setiap pesan adalah chat baru.
                    </p>
                </div>
            )}
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <Bot className="w-12 h-12 text-[var(--text-muted)] mb-4 opacity-50" />
                        <h4 className="font-medium mb-1">Start a conversation</h4>
                        <p className="text-sm text-[var(--text-muted)] max-w-xs">
                            {supportsAdvancedFeatures 
                                ? 'Ask me anything! I can help with coding, explain concepts, analyze images, and more.'
                                : 'Ask me anything! I can help with coding and explain concepts.'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4 justify-center">
                            {['Explain React hooks', 'Debug my code', ...(supportsAdvancedFeatures ? ['Analyze this image'] : [])].map(suggestion => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map(msg => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                msg.role === 'user' 
                                    ? 'bg-blue-500/20' 
                                    : 'bg-gradient-to-br from-purple-500/20 to-blue-500/20'
                            }`}>
                                {msg.role === 'user' ? (
                                    <User className="w-4 h-4 text-blue-400" />
                                ) : (
                                    <Bot className="w-4 h-4 text-purple-400" />
                                )}
                            </div>
                            
                            {/* Content */}
                            <div className={`flex-1 min-w-0 max-w-[85%] sm:max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block p-3 rounded-xl break-words ${
                                    msg.role === 'user'
                                        ? 'bg-blue-500/20 text-left'
                                        : 'bg-[var(--bg-secondary)]'
                                }`}>
                                    {/* Image */}
                                    {msg.image && (
                                        <img 
                                            src={msg.image} 
                                            alt="Uploaded" 
                                            className="max-w-xs rounded-lg mb-2"
                                        />
                                    )}
                                    
                                    {/* Text */}
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm prose-invert max-w-none overflow-x-auto">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                    )}
                                </div>
                                
                                {/* Meta */}
                                <div className={`flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] ${
                                    msg.role === 'user' ? 'justify-end' : ''
                                }`}>
                                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {msg.model && <span className="text-purple-400">{msg.model}</span>}
                                    {msg.tokensUsed && <span>{msg.tokensUsed} tokens</span>}
                                    
                                    {msg.role === 'assistant' && (
                                        <button
                                            onClick={() => copyMessage(msg.id, msg.content)}
                                            className="p-1 hover:bg-[var(--bg-secondary)] rounded"
                                        >
                                            {copiedId === msg.id ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
                
                {/* Loading */}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                <span className="text-sm text-[var(--text-muted)]">Thinking...</span>
                            </div>
                        </div>
                    </motion.div>
                )}
                
                {/* Error */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2"
                    >
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-red-400">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="text-xs text-[var(--text-muted)] hover:text-red-400 mt-1"
                            >
                                Dismiss
                            </button>
                        </div>
                    </motion.div>
                )}
                
                <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-[var(--border-color)]">
                {/* Image Preview */}
                {image && (
                    <div className="mb-3 relative inline-block">
                        <img 
                            src={image.preview} 
                            alt="Upload preview" 
                            className="h-20 rounded-lg"
                        />
                        <button
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                
                <div className="flex gap-2">
                    {/* Image Upload - Gemini only */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!supportsAdvancedFeatures}
                        className={`p-2.5 rounded-lg transition-colors ${
                            supportsAdvancedFeatures 
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        }`}
                        title={supportsAdvancedFeatures ? 'Upload Image' : 'Image upload only available for Gemini models'}
                    >
                        <ImageIcon className="w-5 h-5" />
                    </button>
                    
                    {/* Web Search Toggle - Gemini only */}
                    <button
                        onClick={() => supportsAdvancedFeatures && setWebSearch(!webSearch)}
                        disabled={!supportsAdvancedFeatures}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-colors text-xs ${
                            !supportsAdvancedFeatures 
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                                : webSearch 
                                    ? 'bg-blue-500/20 text-blue-400' 
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                        }`}
                        title={supportsAdvancedFeatures 
                            ? (webSearch ? 'Web Search ON' : 'Web Search OFF') 
                            : 'Web search only available for Gemini models'}
                    >
                        <Globe className="w-4 h-4" />
                        <span className="hidden sm:inline">{webSearch ? 'Web ON' : 'Web'}</span>
                    </button>
                    
                    {/* Text Input */}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-purple-500 focus:outline-none resize-none text-sm"
                        disabled={isLoading}
                    />
                    
                    {/* Send Button */}
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || (!input.trim() && !image)}
                        className="p-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                
                <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                    Enter untuk kirim, Shift+Enter untuk baris baru • AI dapat membuat kesalahan, periksa kembali responsenya
                </p>
            </div>
        </div>
    );
}

export default AIChat;
