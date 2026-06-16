import { invoke } from "@tauri-apps/api/core";

// Typed wrappers over the Rust Google Drive commands (issue #1 foundation).
// The HTTP token exchange and Drive file I/O arrive in a follow-up; these cover
// the auth-URL handshake and secure token storage that already exist natively.

export type DriveAuthRequest = {
  // The Google authorization URL to open in the system browser.
  authUrl: string;
  // PKCE verifier the caller must echo back during the token exchange.
  verifier: string;
  // Anti-CSRF state token to verify on the OAuth redirect.
  state: string;
};

export type DriveOAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  // Absolute expiry as a unix timestamp in seconds, if known.
  expiresAt?: number;
  scope: string;
};

// Serde on the Rust side uses snake_case field names; map at the boundary so
// the rest of the frontend speaks camelCase.
type RustAuthRequest = {
  auth_url: string;
  verifier: string;
  state: string;
};

type RustTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scope: string;
};

export async function beginDriveAuth(
  clientId: string,
  redirectUri: string
): Promise<DriveAuthRequest> {
  const res = await invoke<RustAuthRequest>("gdrive_begin_auth", {
    clientId,
    redirectUri,
  });
  return { authUrl: res.auth_url, verifier: res.verifier, state: res.state };
}

export async function storeDriveTokens(
  tokens: DriveOAuthTokens
): Promise<void> {
  const payload: RustTokens = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt,
    scope: tokens.scope,
  };
  await invoke("gdrive_store_tokens", { tokens: payload });
}

export async function loadDriveTokens(): Promise<DriveOAuthTokens | null> {
  const res = await invoke<RustTokens | null>("gdrive_load_tokens");
  if (!res) return null;
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt: res.expires_at,
    scope: res.scope,
  };
}

export async function clearDriveTokens(): Promise<void> {
  await invoke("gdrive_clear_tokens");
}
