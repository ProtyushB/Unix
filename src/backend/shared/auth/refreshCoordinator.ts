/**
 * Single-flight coordination for access-token refresh.
 *
 * Kept RN-free and dependency-injected so the repo's plain-node jest can cover it — the same
 * reason `appointment.view.ts` and `collapsingHeader.ts` exist. The axios/AsyncStorage/navigation
 * wiring lives in `../config/authInterceptors.ts`.
 *
 * The problem this solves: refresh tokens are ROTATED, so the old one dies the moment a refresh
 * succeeds. Every client used to run its own refresh, so a screen firing five requests against an
 * expired token produced five concurrent refreshes; the first won and the other four presented an
 * already-rotated token, failed, and logged the user out. Funnelling them through one promise
 * makes the burst cost exactly one round trip.
 */

export interface RefreshTokens {
  accessToken: string;
  /** Absent when the server chooses not to rotate. Must NOT overwrite a good token with undefined. */
  refreshToken?: string;
}

export interface RefreshDeps {
  getRefreshToken: () => Promise<string | null>;
  /** Persist the new pair. Called only on success. */
  setTokens: (tokens: RefreshTokens) => Promise<void>;
  /** POST the refresh. Must use a bare client so a 401 here cannot recurse into this coordinator. */
  postRefresh: (refreshToken: string) => Promise<RefreshTokens>;
}

export class RefreshCoordinator {
  private inFlight: Promise<string> | null = null;

  constructor(private readonly deps: RefreshDeps) {}

  /**
   * Refresh once, however many callers ask concurrently.
   *
   * The promise is cleared in `finally` rather than on success, so a FAILED refresh doesn't pin a
   * rejected promise for every later caller — the next 401 after a failure gets a fresh attempt.
   */
  refresh(): Promise<string> {
    if (!this.inFlight) {
      this.inFlight = this.doRefresh().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /** Test seam / logout hook: drop any in-flight refresh so the next call starts clean. */
  reset(): void {
    this.inFlight = null;
  }

  private async doRefresh(): Promise<string> {
    const refreshToken = await this.deps.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    const tokens = await this.deps.postRefresh(refreshToken);
    if (!tokens?.accessToken) throw new Error('Refresh response missing accessToken');

    await this.deps.setTokens({
      accessToken: tokens.accessToken,
      // Guarded: an unconditional write would store `undefined` over a perfectly good refresh
      // token whenever the server omits the field, logging the user out on the next 401.
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    });

    return tokens.accessToken;
  }
}

/** Requests that must never trigger a refresh — a bad login should surface as a form error. */
export const NO_REFRESH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh'] as const;

export function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return NO_REFRESH_PATHS.some((p) => url.includes(p));
}
