import { getAIApiKey } from './storage';

/**
 * Generate a note summary using OpenAI API
 * @param chatContent The full chat content to summarize
 * @param accountName The name of the account the chat is with
 * @returns Generated summary text
 */
export async function generateNoteSummary(
    chatContent: string,
    accountName: string
): Promise<string> {
    const apiKey = await getAIApiKey();
    
    if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set it in settings.');
    }

    const prompt = `Maak een mini samenvatting van dit gesprek met ${accountName}, max 2-3 zinnen met belangrijke dingen die we moeten onthouden. Dit komt onder notities op hun profiel.

Belangrijk: Gebruik alleen gewone tekst zonder HTML codes of speciale tekencodes. Gebruik gewoon apostrofs (') en andere normale tekens direct, niet zoals &#39; of andere HTML entities.

Gesprek:
${chatContent}

Samenvatting:`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
            );
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content?.trim();

        if (!summary) {
            throw new Error('No summary generated from OpenAI API');
        }

        return summary;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to generate note summary');
    }
}

