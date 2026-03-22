/**
 * Central wait for SDC session identifiers in `localStorage.user_info` (and fallbacks in utils).
 * After a full page refresh the React app may hydrate `user_info` shortly after our content script runs;
 * API modules await here so fetches do not race an empty session.
 */
import { getCurrentDBId, getCurrentMuid } from './utils';

export interface SessionCredentials {
  dbId: string;
  muid: string;
}

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_POLL_MS = 50;

function snapshot(): SessionCredentials {
  const dbId = getCurrentDBId();
  const muid = getCurrentMuid();
  if (!dbId || !muid) {
    throw new Error('Session credentials incomplete');
  }
  return { dbId, muid };
}

function hasSessionCredentials(): boolean {
  return getCurrentDBId() != null && getCurrentMuid() != null;
}

let inFlight: Promise<SessionCredentials> | null = null;

/** People/list APIs use `muid=` with the logged-in member DB_ID only — wait for that, not full messenger session. */
let peopleDbIdInFlight: Promise<string> | null = null;

/** Synchronous check — both DB_ID and MUID resolvers in utils return a value. */
export function sessionCredentialsReady(): boolean {
  return hasSessionCredentials();
}

/**
 * Resolves once `user_info` (or cookie fallbacks used by utils) provides both DB_ID and MUID.
 * Concurrent callers share one poll loop.
 */
export async function awaitSessionCredentials(options?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<SessionCredentials> {
  if (hasSessionCredentials()) {
    return snapshot();
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_MS;

  if (!inFlight) {
    inFlight = new Promise<SessionCredentials>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (hasSessionCredentials()) {
          try {
            resolve(snapshot());
          } catch (e) {
            reject(e);
          }
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          reject(
            new Error(
              'Session credentials timed out: user_info (DB_ID / MUID) not available yet. Try refreshing the page.'
            )
          );
          return;
        }
        window.setTimeout(tick, pollIntervalMs);
      };
      tick();
    }).finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

/**
 * Wait until `getCurrentDBId()` is set (user_info hydration). Does not require messenger `sid`;
 * avoids deadlock when profile cookie supplies MUID before `user_info.db_id` exists.
 */
export async function awaitPeopleDbId(options?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<string> {
  const immediate = getCurrentDBId();
  if (immediate) {
    return immediate;
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_MS;

  if (!peopleDbIdInFlight) {
    peopleDbIdInFlight = new Promise<string>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const id = getCurrentDBId();
        if (id) {
          resolve(id);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          reject(new Error('MUID (DB_ID) not found. Cannot fetch members.'));
          return;
        }
        window.setTimeout(tick, pollIntervalMs);
      };
      tick();
    }).finally(() => {
      peopleDbIdInFlight = null;
    });
  }

  return peopleDbIdInFlight;
}

/** For APIs that use messenger `muid` (sid / conn id / fallbacks). */
export async function resolveMuidOrAwait(muid?: string | null): Promise<string> {
  if (muid) return muid;
  await awaitSessionCredentials();
  const id = getCurrentMuid();
  if (!id) {
    throw new Error('MUID not found. Cannot call SDC API.');
  }
  return id;
}

/** For people_v2 endpoints that pass the current member DB_ID as `muid`. */
export async function resolvePeopleApiMuid(explicit?: string | null): Promise<string> {
  if (explicit) return explicit;
  return awaitPeopleDbId();
}
