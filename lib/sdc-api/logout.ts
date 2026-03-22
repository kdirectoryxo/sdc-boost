/**
 * SDC session logout — matches browser flow: GET /v1/logout?muid=… with site cookies.
 */
import { resolveMuidOrAwait } from './session-credentials';

export async function logoutSdcSession(muid?: string | null): Promise<void> {
  const currentMuid = await resolveMuidOrAwait(muid);

  const url = new URL('https://api.sdc.com/v1/logout');
  url.searchParams.set('muid', currentMuid);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Logout request failed: ${response.status} — ${errorText}`);
  }
}

/** Full navigation so the main SDC app reloads with cleared session cookies. */
export function navigateToSdcHome(): void {
  window.location.assign('https://www.sdc.com/');
}
