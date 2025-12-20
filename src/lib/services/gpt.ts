/**
 * Free GPT API Service
 * API: hutchingd-freegptsir.hf.space
 */

import { analyzeNetworkError, isOnline } from '@/lib/utils/network';

const API_URL = 'https://hutchingd-freegptsir.hf.space/api/ask';

export interface ChatMessage {
    role: 'user' | 'bot';
    content: string;
    timestamp: number;
}

export async function askGPT(question: string): Promise<{ success: boolean; answer?: string; error?: string; isNetworkError?: boolean }> {
    // Pre-check online status
    if (!isOnline()) {
        return {
            success: false,
            error: '📡 No Internet Connection\nPlease check your connection and try again.',
            isNetworkError: true,
        };
    }

    try {
        const res = await fetch(`${API_URL}?q=${encodeURIComponent(question)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        
        // Parse response - API returns { reply: "..." } format
        let answer = '';
        if (typeof data === 'string') {
            answer = data;
        } else if (data.reply) {
            answer = data.reply;
        } else if (data.response) {
            answer = data.response;
        } else if (data.answer) {
            answer = data.answer;
        } else if (data.message) {
            answer = data.message;
        } else if (data.text) {
            answer = data.text;
        } else {
            // Fallback: stringify but try to extract meaningful content
            answer = JSON.stringify(data, null, 2);
        }
        
        // Clean up escaped newlines
        answer = answer.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        
        return { success: true, answer };
    } catch (error) {
        console.error('[GPT] Error:', error);
        
        // Check for network errors
        const networkStatus = analyzeNetworkError(error);
        if (networkStatus.type === 'offline' || networkStatus.type === 'timeout') {
            return {
                success: false,
                error: `📡 ${networkStatus.message}\n${networkStatus.suggestion}`,
                isNetworkError: true,
            };
        }
        
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to get response' 
        };
    }
}
