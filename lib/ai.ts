import { getSetting } from './sdc-db/settings';
import { OpenRouter } from '@openrouter/sdk';

/**
 * Check if an error is a retryable network error (HTTP/2 protocol error, network failure, etc.)
 */
function isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    
    const errorMessage = error.message.toLowerCase();
    
    // Check for HTTP/2 protocol errors
    if (errorMessage.includes('http2_protocol_error') || 
        errorMessage.includes('http/2 protocol error') ||
        errorMessage.includes('err_http2_protocol_error')) {
        return true;
    }
    
    // Check for network failures
    if (errorMessage.includes('failed to fetch') ||
        errorMessage.includes('networkerror') ||
        errorMessage.includes('network error')) {
        return true;
    }
    
    // Check for connection errors
    if (errorMessage.includes('connection') && 
        (errorMessage.includes('reset') || errorMessage.includes('closed') || errorMessage.includes('aborted'))) {
        return true;
    }
    
    return false;
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: Error | unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // Don't retry if it's not a retryable error or if we've exhausted retries
            if (!isRetryableError(error) || attempt === maxRetries) {
                throw error;
            }
            
            // Calculate delay with exponential backoff (with jitter)
            const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
            
            console.warn(
                `[ai] Retryable error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms:`,
                error instanceof Error ? error.message : String(error)
            );
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

/**
 * Generate a note summary using OpenRouter API
 * @param chatContent The full chat content to summarize
 * @param accountName The name of the account the chat is with
 * @returns Generated summary text
 */
export async function generateNoteSummary(
    chatContent: string,
    accountName: string
): Promise<string> {
    const apiKey = await getSetting('openrouter_api_key') || undefined;
    
    if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Please set it in settings.');
    }

    const prompt = `Maak een mini samenvatting van dit gesprek met ${accountName}, max 2-3 zinnen met belangrijke dingen die we moeten onthouden. Dit komt onder notities op hun profiel.

Belangrijk: Gebruik alleen gewone tekst zonder HTML codes of speciale tekencodes. Gebruik gewoon apostrofs (') en andere normale tekens direct, niet zoals &#39; of andere HTML entities.

Gesprek:
${chatContent}

Samenvatting:`;

    try {
        const client = new OpenRouter({
            apiKey: apiKey,
        });

        // Use retry logic for HTTP/2 protocol errors and network failures
        const response = await retryWithBackoff(
            async () => {
                return await client.chat.send({
                    model: 'google/gemini-3-flash-preview',
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    maxTokens: 150,
                    temperature: 0.7,
                    provider: {
                        zdr: true,
                    },
                });
            },
            3, // max retries
            1000 // initial delay 1 second
        );
 
        const content = response.choices?.[0]?.message?.content;
        const summary = typeof content === 'string' ? content.trim() : String(content).trim();

        if (!summary) {
            throw new Error('No summary generated from OpenRouter API');
        }

        return summary;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to generate note summary');
    }
}

