function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Placeholder text from the API: slash-slash-star ACCOUNTID star-slash-slash */
const ACCOUNT_PLACEHOLDER = new RegExp('\\/\\/\\*ACCOUNTID\\*\\/\\/', 'g');

/**
 * Replace the feed notification account placeholder in HTML with the sender's account id.
 * Inserts a leading space and wraps the id so it is spaced from "en" and can be styled.
 */
export function formatFeedNotificationBodyHtml(body: string, senderAccountId: string): string {
  const safe = escapeHtml(senderAccountId);
  const wrapped = `<span class="feed-notification-account-name">${safe}</span>`;
  return body.replace(ACCOUNT_PLACEHOLDER, ` ${wrapped}`);
}
