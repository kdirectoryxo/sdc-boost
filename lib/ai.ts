import { getSetting } from './sdc-db/settings';
import { OpenRouter } from '@openrouter/sdk';

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

        const response = await client.chat.send({
            model: 'openai/gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            maxTokens: 150,
            temperature: 0.7,
        });
 
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

