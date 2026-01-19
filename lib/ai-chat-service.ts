import { getSetting } from './sdc-db/settings';
import { OpenRouter } from '@openrouter/sdk';
import type { ProfileUser, MessengerMessage } from './sdc-api-types';
import { parseImageMessage, parseVideoMessage, parseGalleryMessage } from './composables/chat/utils';
import { getCurrentDBId } from './sdc-api/utils';
import { profileStorage } from './profile-storage';

/**
 * Strip HTML tags and extract plain text from HTML string
 */
function stripHtml(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Parse interests_st (3 characters: Girl on Girl, Soft Swap, Full Swap)
 */
function parseInterestsSt(interestsSt: string | undefined): {
  girlOnGirl: boolean;
  softSwap: boolean;
  fullSwap: boolean;
} {
  if (!interestsSt || interestsSt.length < 3) {
    return { girlOnGirl: false, softSwap: false, fullSwap: false };
  }
  
  const chars = interestsSt.split('');
  return {
    girlOnGirl: chars[0] === '1',
    softSwap: chars[1] === '1',
    fullSwap: chars[2] === '1',
  };
}

/**
 * Parse interests1 (6 characters: Couple M/F, Couple F/F, Couple M/M, Single F, Single M, Transgender)
 */
function parseInterests(interests: string | undefined): {
  coupleMaleFemale: boolean;
  coupleFemaleFemale: boolean;
  coupleMaleMale: boolean;
  singleFemale: boolean;
  singleMale: boolean;
  transgender: boolean;
} {
  if (!interests || interests.length < 6) {
    return {
      coupleMaleFemale: false,
      coupleFemaleFemale: false,
      coupleMaleMale: false,
      singleFemale: false,
      singleMale: false,
      transgender: false,
    };
  }
  
  const chars = interests.split('');
  return {
    coupleMaleFemale: chars[0] === '1',
    coupleFemaleFemale: chars[1] === '1',
    coupleMaleMale: chars[2] === '1',
    singleFemale: chars[3] === '1',
    singleMale: chars[4] === '1',
    transgender: chars[5] === '1',
  };
}

/**
 * Format profile data into a concise system prompt for AI
 */
export function formatProfileForAI(profile: ProfileUser): string {
  const parts: string[] = [];
  
  // Basic info
  parts.push(`Profile: ${profile.account_id}`);
  
  // Ages
  if (profile.g1_age) {
    parts.push(`Age: ${profile.g1_age}`);
  }
  if (profile.g2_age && profile.g2_age >= 18 && profile.g2_age <= 100) {
    parts.push(`Partner age: ${profile.g2_age}`);
  }
  
  // Location
  if (profile.location) {
    const distance = profile.location_how_far 
      ?? (profile.location_how_far2 ? Number(profile.location_how_far2) : undefined);
    const locationStr = distance !== undefined && distance !== null
      ? `${profile.location} (${distance} km away)`
      : profile.location;
    parts.push(`Location: ${locationStr}`);
  }
  
  // Bio
  if (profile.profile_description) {
    const bio = stripHtml(profile.profile_description).trim();
    if (bio) {
      parts.push(`Bio: ${bio}`);
    }
  }
  
  // Hope to find
  if (profile.hope_to_find) {
    const hopeToFind = stripHtml(profile.hope_to_find).trim();
    if (hopeToFind) {
      parts.push(`Looking for: ${hopeToFind}`);
    }
  }
  
  // Preferences (interests_st)
  const interestsSt = parseInterestsSt(profile.interests_st);
  const preferences: string[] = [];
  if (interestsSt.girlOnGirl) preferences.push('Girl on Girl');
  if (interestsSt.softSwap) preferences.push('Soft Swap');
  if (interestsSt.fullSwap) preferences.push('Full Swap');
  if (preferences.length > 0) {
    parts.push(`Preferences: ${preferences.join(', ')}`);
  }
  
  // Looking for (interests1)
  const interests1 = parseInterests(profile.interests1);
  const lookingFor: string[] = [];
  if (interests1.coupleMaleFemale) lookingFor.push('Couple M/F');
  if (interests1.coupleFemaleFemale) lookingFor.push('Couple F/F');
  if (interests1.coupleMaleMale) lookingFor.push('Couple M/M');
  if (interests1.singleFemale) lookingFor.push('Single F');
  if (interests1.singleMale) lookingFor.push('Single M');
  if (interests1.transgender) lookingFor.push('Transgender');
  if (lookingFor.length > 0) {
    parts.push(`Looking for: ${lookingFor.join(', ')}`);
  }
  
  // Validations
  if (profile.validations) {
    parts.push(`Validations: ${profile.validations}`);
  }
  
  // Speed dating
  if (profile.speeddating_active && profile.speeddating_details) {
    const sd = profile.speeddating_details;
    const sdParts: string[] = [];
    if (sd.date_list) sdParts.push(`Date: ${sd.date_list}`);
    if (sd.location) {
      const sdDistance = sd.how_far ? ` (${sd.how_far} km away)` : '';
      sdParts.push(`Location: ${sd.location}${sdDistance}`);
    }
    if (sd.personal_text) sdParts.push(`Details: ${sd.personal_text}`);
    if (sdParts.length > 0) {
      parts.push(`Speed Dating: ${sdParts.join(', ')}`);
    }
  }
  
  return parts.join('\n');
}

/**
 * Format group participants for AI context
 * Loads full profiles for each participant and formats them
 */
export async function formatGroupParticipantsForAI(
  groupName: string,
  participants: Array<{ account_id: string; db_id: string | number }>
): Promise<string> {
  const parts: string[] = [];
  parts.push(`Group: ${groupName}`);
  parts.push('');
  parts.push('Participants:');
  parts.push('');
  
  // Load and format each participant's profile
  for (const participant of participants) {
    const dbId = typeof participant.db_id === 'string' ? parseInt(participant.db_id) : participant.db_id;
    
    if (!dbId || dbId <= 0) {
      // If no valid db_id, just include basic info
      parts.push(`- ${participant.account_id} (profile not available)`);
      continue;
    }
    
    try {
      const profile = await profileStorage.getProfile(dbId);
      if (profile) {
        // Format full profile
        const profileFormatted = formatProfileForAI(profile);
        parts.push(`- ${profileFormatted}`);
      } else {
        // Profile not synced, include basic info
        parts.push(`- ${participant.account_id} (profile not synced)`);
      }
    } catch (err) {
      // Error loading profile, include basic info
      console.warn(`[formatGroupParticipantsForAI] Failed to load profile for ${participant.account_id}:`, err);
      parts.push(`- ${participant.account_id} (profile unavailable)`);
    }
    
    parts.push(''); // Empty line between participants
  }
  
  return parts.join('\n');
}

/**
 * Compress chat history by removing HTML, extra whitespace, and using short sender format
 */
export function compressChatHistory(messages: MessengerMessage[], accountName: string): string {
  if (messages.length === 0) {
    return 'No messages yet.';
  }
  
  // Define sender mapping once at the top
  const lines: string[] = [];
  lines.push(`Me = sender 0, ${accountName} = sender 1`);
  lines.push(''); // Empty line for readability
  
  let lastDate: string | null = null;
  
  for (const msg of messages) {
    // Extract text from message, handling different message types
    let messageText = '';
    
    // Check if it's an image message (type 6)
    if (msg.message.startsWith('[6|') && msg.message.includes('-|-')) {
      const parsed = parseImageMessage(msg.message);
      messageText = parsed.text || '[Image]';
    }
    // Check if it's a video message (type 8)
    else if (msg.message.startsWith('[8|') && msg.message.includes('-|-')) {
      const parsed = parseVideoMessage(msg.message);
      messageText = parsed.text || '[Video]';
    }
    // Regular message - strip HTML
    else {
      messageText = stripHtml(msg.message).trim();
    }
    
    // Skip empty messages
    if (!messageText) {
      continue;
    }
    
    // Remove extra whitespace/newlines (compress to single spaces)
    messageText = messageText.replace(/\s+/g, ' ').trim();
    
    // Format date if it changed (only show date changes, not every message)
    const messageDate = new Date(msg.date2 * 1000).toLocaleDateString();
    if (messageDate !== lastDate) {
      lines.push(`[${messageDate}]`);
      lastDate = messageDate;
    }
    
    // Format message with short sender identifier
    const sender = msg.sender === 0 ? 'Me' : accountName;
    lines.push(`${sender}: ${messageText}`);
  }
  
  return lines.join('\n');
}

/**
 * Compress chat history for group chats with multiple participants
 * Uses message.account_id for each message sender
 */
export function compressChatHistoryForGroup(messages: MessengerMessage[]): string {
  if (messages.length === 0) {
    return 'No messages yet.';
  }
  
  const lines: string[] = [];
  lines.push('Group Chat History:');
  lines.push(''); // Empty line for readability
  
  let lastDate: string | null = null;
  
  for (const msg of messages) {
    // Extract text from message, handling different message types
    let messageText = '';
    
    // Check if it's an image message (type 6)
    if (msg.message.startsWith('[6|') && msg.message.includes('-|-')) {
      const parsed = parseImageMessage(msg.message);
      messageText = parsed.text || '[Image]';
    }
    // Check if it's a video message (type 8)
    else if (msg.message.startsWith('[8|') && msg.message.includes('-|-')) {
      const parsed = parseVideoMessage(msg.message);
      messageText = parsed.text || '[Video]';
    }
    // Regular message - strip HTML
    else {
      messageText = stripHtml(msg.message).trim();
    }
    
    // Skip empty messages
    if (!messageText) {
      continue;
    }
    
    // Remove extra whitespace/newlines (compress to single spaces)
    messageText = messageText.replace(/\s+/g, ' ').trim();
    
    // Format date if it changed (only show date changes, not every message)
    const messageDate = new Date(msg.date2 * 1000).toLocaleDateString();
    if (messageDate !== lastDate) {
      lines.push(`[${messageDate}]`);
      lastDate = messageDate;
    }
    
    // Format message with sender's account_id (or "Me" for current user)
    const sender = msg.sender === 0 ? 'Me' : (msg.account_id || 'Unknown');
    lines.push(`${sender}: ${messageText}`);
  }
  
  return lines.join('\n');
}

/**
 * Check if an error is a retryable network error (HTTP/2 protocol error, network failure, etc.)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();
  
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
  initialDelay: number = 1000,
  abortSignal?: AbortSignal
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if aborted
    if (abortSignal?.aborted) {
      throw new Error('Request aborted');
    }
    
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
        `[ai-chat-service] Retryable error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Chat with AI about a profile and chat history
 */
export async function chatWithAI(
  userMessage: string,
  profile: ProfileUser | null,
  messages: MessengerMessage[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  abortSignal?: AbortSignal,
  groupInfo?: { name: string; participants: Array<{ account_id: string; db_id: string | number }> } | null,
  focusedMessage?: MessengerMessage | null
): Promise<string> {
  const apiKey = await getSetting('openrouter_api_key') || undefined;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Please set it in settings.');
  }

  // Try to load current user's profile
  let currentUserProfileContext = '';
  try {
    const currentDbId = getCurrentDBId();
    if (currentDbId) {
      const currentUserProfile = await profileStorage.getProfile(parseInt(currentDbId));
      if (currentUserProfile) {
        currentUserProfileContext = formatProfileForAI(currentUserProfile);
      }
    }
  } catch (err) {
    // Non-blocking: if current user profile isn't available, continue without it
    console.warn('[ai-chat-service] Could not load current user profile:', err);
  }
  
  // Load additional context/preferences
  let additionalContext = '';
  try {
    const contextValue = await getSetting('ai_chat_context');
    if (contextValue && typeof contextValue === 'string' && contextValue.trim()) {
      additionalContext = contextValue.trim();
    }
  } catch (err) {
    // Non-blocking: if context isn't available, continue without it
    console.warn('[ai-chat-service] Could not load additional context:', err);
  }
  
  // Build system prompt based on whether it's a group chat or individual chat
  let systemPrompt = '';
  
  if (groupInfo) {
    // Group chat mode
    const participantsContext = await formatGroupParticipantsForAI(groupInfo.name, groupInfo.participants);
    const chatHistory = compressChatHistoryForGroup(messages);
    
    const yourProfileSection = currentUserProfileContext 
      ? `Your Profile (the person asking questions):
${currentUserProfileContext}
${additionalContext ? `\nAdditional Preferences:\n${additionalContext}` : ''}

`
      : additionalContext
      ? `Additional Preferences:
${additionalContext}

`
      : '';
    
    // Add focused message context if provided
    let focusedMessageContext = '';
    if (focusedMessage) {
      let focusedText = '';
      if (focusedMessage.message.startsWith('[6|') && focusedMessage.message.includes('-|-')) {
        const parsed = parseImageMessage(focusedMessage.message);
        focusedText = parsed.text || '[Image]';
      } else if (focusedMessage.message.startsWith('[8|') && focusedMessage.message.includes('-|-')) {
        const parsed = parseVideoMessage(focusedMessage.message);
        focusedText = parsed.text || '[Video]';
      } else if (focusedMessage.message.startsWith('[7|')) {
        const parsed = parseGalleryMessage(focusedMessage.message);
        if (parsed) {
          focusedText = parsed.albums && parsed.albums.length > 1 
            ? `[Gallery: ${parsed.albums.length} albums]`
            : `[Gallery: ${parsed.galleryName}]`;
        } else {
          focusedText = '[Gallery]';
        }
      } else {
        focusedText = stripHtml(focusedMessage.message).trim();
      }
      focusedMessageContext = `\n\nFOCUSED MESSAGE (the user wants to discuss this specific message):
From: ${focusedMessage.account_id || 'Unknown'}
Message: "${focusedText}"
Date: ${new Date(focusedMessage.date2 * 1000).toLocaleString()}

The user is asking about this specific message. Keep this message in mind when responding, as it's the focus of the conversation.`;
    }
    
    systemPrompt = `You are an AI assistant helping analyze a GROUP CHAT and its participants from SDC.com (a social networking platform).

${yourProfileSection}${participantsContext}

Chat History:
${chatHistory}${focusedMessageContext}

IMPORTANT CONTEXT:
- "Me" in the chat history refers to YOU (the current user asking questions)
- Each message shows the sender's account_id
- When analyzing the chat, consider all participants' contributions
- The group chat may have multiple active participants${focusedMessage ? '\n- The user is specifically interested in discussing the FOCUSED MESSAGE above' : ''}

Please help answer questions about this group chat and its participants. Be concise and helpful.

IMPORTANT: Format your responses using Markdown syntax. Use:
- **bold** for emphasis
- *italic* for subtle emphasis
- Bullet points (- or *) for lists
- Code blocks (\`\`\`) for code if needed
- Headers (# ## ###) for sections if appropriate

Keep responses clear and well-formatted.`;
  } else if (profile) {
    // Individual chat mode
    const profileContext = formatProfileForAI(profile);
    const chatHistory = compressChatHistory(messages, profile.account_id);
    
    const yourProfileSection = currentUserProfileContext 
      ? `Your Profile (the person asking questions):
${currentUserProfileContext}
${additionalContext ? `\nAdditional Preferences:\n${additionalContext}` : ''}

`
      : additionalContext
      ? `Additional Preferences:
${additionalContext}

`
      : '';
    
    // Add focused message context if provided
    let focusedMessageContext = '';
    if (focusedMessage) {
      let focusedText = '';
      if (focusedMessage.message.startsWith('[6|') && focusedMessage.message.includes('-|-')) {
        const parsed = parseImageMessage(focusedMessage.message);
        focusedText = parsed.text || '[Image]';
      } else if (focusedMessage.message.startsWith('[8|') && focusedMessage.message.includes('-|-')) {
        const parsed = parseVideoMessage(focusedMessage.message);
        focusedText = parsed.text || '[Video]';
      } else if (focusedMessage.message.startsWith('[7|')) {
        const parsed = parseGalleryMessage(focusedMessage.message);
        if (parsed) {
          focusedText = parsed.albums && parsed.albums.length > 1 
            ? `[Gallery: ${parsed.albums.length} albums]`
            : `[Gallery: ${parsed.galleryName}]`;
        } else {
          focusedText = '[Gallery]';
        }
      } else {
        focusedText = stripHtml(focusedMessage.message).trim();
      }
      focusedMessageContext = `\n\nFOCUSED MESSAGE (the user wants to discuss this specific message):
From: ${focusedMessage.account_id || 'Unknown'}
Message: "${focusedText}"
Date: ${new Date(focusedMessage.date2 * 1000).toLocaleString()}

The user is asking about this specific message. Keep this message in mind when responding, as it's the focus of the conversation.`;
    }
    
    systemPrompt = `You are an AI assistant helping analyze a profile and chat history from SDC.com (a social networking platform).

${yourProfileSection}Profile Information (the profile being analyzed):
${profileContext}

Chat History:
${chatHistory}${focusedMessageContext}

IMPORTANT CONTEXT:
- "Me" in the chat history refers to YOU (the current user asking questions)
- "${profile.account_id}" in the chat history refers to the PROFILE BEING ANALYZED
- When analyzing the chat, focus on what ${profile.account_id} said and did, NOT what "Me" said
- "Me" is asking you questions about ${profile.account_id}, so messages from "Me" are from the questioner, not from ${profile.account_id}${focusedMessage ? '\n- The user is specifically interested in discussing the FOCUSED MESSAGE above' : ''}

Please help answer questions about this profile and chat history. Be concise and helpful.

IMPORTANT: Format your responses using Markdown syntax. Use:
- **bold** for emphasis
- *italic* for subtle emphasis
- Bullet points (- or *) for lists
- Code blocks (\`\`\`) for code if needed
- Headers (# ## ###) for sections if appropriate

Keep responses clear and well-formatted.`;
  } else {
    throw new Error('Either profile or groupInfo must be provided');
  }

  try {
    const client = new OpenRouter({
      apiKey: apiKey,
    });

    // Build messages array with system prompt, conversation history, and new user message
    const messagesArray: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Use retry logic for HTTP/2 protocol errors and network failures
    const response = await retryWithBackoff(
      async () => {
        return await client.chat.send(
          {
            model: 'google/gemini-3-flash-preview',
            messages: messagesArray,
            maxTokens: 2000,
            temperature: 0.7,
            provider: {
              zdr: true,
            },
          },
          abortSignal ? { signal: abortSignal } : undefined
        );
      },
      3, // max retries
      1000, // initial delay 1 second
      abortSignal
    );
 
    const content = response.choices?.[0]?.message?.content;
    const aiResponse = typeof content === 'string' ? content.trim() : String(content).trim();

    if (!aiResponse) {
      throw new Error('No response generated from OpenRouter API');
    }

    return aiResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to chat with AI');
  }
}
