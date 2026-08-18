/** Bounded retry while mobile browsers persist the session cookie after credentials sign-in. */
export const LOGIN_SESSION_CONFIRM_MAX_ATTEMPTS = 8;
export const LOGIN_SESSION_CONFIRM_DELAY_MS = 150;

/** Auth.js client signIn() result shape (redirect: false). */
export type CredentialsSignInResult = {
  error?: string | null;
  ok?: boolean;
  status?: number;
  url?: string | null;
} | null | undefined;

export type LoginFailureKind = 'invalid_credentials' | 'session_confirmation' | 'network';

export function isExplicitSignInSuccess(result: CredentialsSignInResult): boolean {
  return result != null && result.ok === true && !result.error;
}

/** Map signIn result to failure kind, or null when credentials step succeeded. */
export function classifySignInFailure(result: CredentialsSignInResult): LoginFailureKind | null {
  if (isExplicitSignInSuccess(result)) return null;
  if (result == null) return 'network';
  if (result.ok === false) {
    return result.error ? 'invalid_credentials' : 'network';
  }
  if (result.error) return 'invalid_credentials';
  return 'network';
}

export function loginFailureMessage(kind: LoginFailureKind): string {
  switch (kind) {
    case 'invalid_credentials':
      return 'Invalid email or password.';
    case 'session_confirmation':
      return "Signed in, but we couldn't start your session. Please try again.";
    case 'network':
      return 'Network error — could not reach the server. Please try again.';
  }
}

export type SessionSnapshot = { user?: unknown } | null | undefined;

export type SessionReader = () => Promise<SessionSnapshot>;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Poll until Auth.js reports an authenticated user, or attempts are exhausted.
 * Injectable for unit tests and for getSession()/fetch wrappers.
 */
export function resolvePostLoginPath(adminRequired: boolean): string {
  return adminRequired ? '/admin' : '/command';
}

export async function confirmAuthenticatedSession(
  readSession: SessionReader,
  options?: {
    maxAttempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? LOGIN_SESSION_CONFIRM_MAX_ATTEMPTS;
  const delayMs = options?.delayMs ?? LOGIN_SESSION_CONFIRM_DELAY_MS;
  const sleep = options?.sleep ?? defaultSleep;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const session = await readSession();
    if (session?.user) return true;
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }
  return false;
}
