// Google Drive OAuth foundation (issue #1).
//
// This module owns the pieces of the Drive integration that do not require a
// live Google connection: PKCE generation, the authorization URL, and secure
// token storage in the macOS Keychain. The HTTP token exchange, Drive API
// calls, and Picker UI land in a follow-up once OAuth credentials exist.
//
// We deliberately request only the `drive.file` scope so Quillora can touch
// only files the user creates with it or explicitly selects — never the whole
// Drive (see the privacy policy in issue #1).

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use keyring::Entry;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use url::Url;

/// Least-privilege scope: access only files created or opened via this app.
pub const DRIVE_FILE_SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";

// Keychain coordinates for the stored token blob.
const KEYRING_SERVICE: &str = "com.quillora.gdrive";
const KEYRING_ACCOUNT: &str = "oauth-tokens";

/// A PKCE verifier/challenge pair. The verifier is kept by the client and sent
/// during the token exchange; the challenge travels in the authorization URL.
#[derive(Debug, Clone, Serialize)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
    pub method: &'static str,
}

/// Generate a PKCE pair using the S256 method (RFC 7636). The verifier is 32
/// random bytes base64url-encoded (43 chars), well within the 43–128 range.
pub fn generate_pkce() -> Pkce {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let challenge = challenge_from_verifier(&verifier);
    Pkce {
        verifier,
        challenge,
        method: "S256",
    }
}

/// Derive the S256 code challenge: base64url(sha256(verifier)).
pub fn challenge_from_verifier(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

/// Build the Google OAuth authorization URL for the installed-app PKCE flow.
/// `redirect_uri` is the loopback address the app listens on; `state` is an
/// opaque anti-CSRF token the caller verifies on the redirect.
pub fn build_auth_url(
    client_id: &str,
    redirect_uri: &str,
    challenge: &str,
    state: &str,
) -> Result<String, String> {
    let mut url = Url::parse(AUTH_ENDPOINT).map_err(|err| err.to_string())?;
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", DRIVE_FILE_SCOPE)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", state)
        // Request a refresh token and force consent so we reliably get one.
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");
    Ok(url.to_string())
}

/// OAuth tokens persisted in the Keychain. `refresh_token` is optional because
/// Google only returns it on the first consent for a given client.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct OAuthTokens {
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    /// Absolute expiry as a unix timestamp (seconds), if known.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    #[serde(default)]
    pub scope: String,
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|err| err.to_string())
}

/// Persist tokens to the OS secure store (Keychain on macOS) as a JSON blob.
pub fn store_tokens(tokens: &OAuthTokens) -> Result<(), String> {
    let json = serde_json::to_string(tokens).map_err(|err| err.to_string())?;
    keyring_entry()?
        .set_password(&json)
        .map_err(|err| err.to_string())
}

/// Load tokens from secure storage, returning `None` when nothing is stored.
pub fn load_tokens() -> Result<Option<OAuthTokens>, String> {
    match keyring_entry()?.get_password() {
        Ok(json) => {
            let tokens = serde_json::from_str(&json).map_err(|err| err.to_string())?;
            Ok(Some(tokens))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

/// Remove stored tokens (sign-out). Treats "nothing stored" as success so the
/// command is idempotent.
pub fn clear_tokens() -> Result<(), String> {
    match keyring_entry()?.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

// ---- Tauri commands -------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct AuthRequest {
    pub auth_url: String,
    pub verifier: String,
    pub state: String,
}

/// Begin an OAuth flow: generate PKCE + state and hand the frontend the URL to
/// open plus the verifier it must echo back during the (future) token exchange.
#[tauri::command]
pub fn gdrive_begin_auth(client_id: String, redirect_uri: String) -> Result<AuthRequest, String> {
    if client_id.trim().is_empty() {
        return Err("Google OAuth client_id is not configured".into());
    }
    let pkce = generate_pkce();
    // 16 random bytes is plenty of entropy for an anti-CSRF state token.
    let mut state_bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut state_bytes);
    let state = URL_SAFE_NO_PAD.encode(state_bytes);
    let auth_url = build_auth_url(&client_id, &redirect_uri, &pkce.challenge, &state)?;
    Ok(AuthRequest {
        auth_url,
        verifier: pkce.verifier,
        state,
    })
}

#[tauri::command]
pub fn gdrive_store_tokens(tokens: OAuthTokens) -> Result<(), String> {
    store_tokens(&tokens)
}

#[tauri::command]
pub fn gdrive_load_tokens() -> Result<Option<OAuthTokens>, String> {
    load_tokens()
}

#[tauri::command]
pub fn gdrive_clear_tokens() -> Result<(), String> {
    clear_tokens()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_verifier_length_is_in_spec_range() {
        let pkce = generate_pkce();
        // RFC 7636 requires 43..=128 characters for the verifier.
        assert!(pkce.verifier.len() >= 43 && pkce.verifier.len() <= 128);
        assert_eq!(pkce.method, "S256");
    }

    #[test]
    fn challenge_is_deterministic_s256_of_verifier() {
        // Known-answer vector from RFC 7636 appendix B.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            challenge_from_verifier(verifier),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn each_pkce_pair_is_unique() {
        let a = generate_pkce();
        let b = generate_pkce();
        assert_ne!(a.verifier, b.verifier);
        assert_ne!(a.challenge, b.challenge);
    }

    #[test]
    fn auth_url_has_required_pkce_and_scope_params() {
        let url = build_auth_url(
            "client-123.apps.googleusercontent.com",
            "http://127.0.0.1:0/callback",
            "challenge-abc",
            "state-xyz",
        )
        .unwrap();
        let parsed = Url::parse(&url).unwrap();
        let pairs: std::collections::HashMap<_, _> = parsed.query_pairs().into_owned().collect();
        assert_eq!(pairs["client_id"], "client-123.apps.googleusercontent.com");
        assert_eq!(pairs["response_type"], "code");
        assert_eq!(pairs["code_challenge"], "challenge-abc");
        assert_eq!(pairs["code_challenge_method"], "S256");
        assert_eq!(pairs["state"], "state-xyz");
        assert_eq!(pairs["scope"], DRIVE_FILE_SCOPE);
        // Least privilege: never request broad Drive scopes.
        assert!(!pairs["scope"].contains("auth/drive "));
        assert_eq!(pairs["access_type"], "offline");
    }

    #[test]
    fn begin_auth_rejects_empty_client_id() {
        let err = gdrive_begin_auth("  ".into(), "http://127.0.0.1:0/callback".into())
            .unwrap_err();
        assert!(err.contains("client_id"));
    }

    // Exercises the real OS Keychain (store -> load -> clear). Ignored by
    // default because it touches the system keystore and may prompt; run with
    // `cargo test -- --ignored` to verify secure storage end-to-end.
    #[test]
    #[ignore]
    fn keychain_round_trip() {
        let tokens = OAuthTokens {
            access_token: "ya29.roundtrip".into(),
            refresh_token: Some("1//rt".into()),
            expires_at: Some(1_700_000_000),
            scope: DRIVE_FILE_SCOPE.into(),
        };
        store_tokens(&tokens).expect("store");
        let loaded = load_tokens().expect("load").expect("present");
        assert_eq!(loaded, tokens);
        clear_tokens().expect("clear");
        assert!(load_tokens().expect("load after clear").is_none());
    }

    #[test]
    fn tokens_round_trip_through_json() {
        let tokens = OAuthTokens {
            access_token: "ya29.a0".into(),
            refresh_token: Some("1//refresh".into()),
            expires_at: Some(1_700_000_000),
            scope: DRIVE_FILE_SCOPE.into(),
        };
        let json = serde_json::to_string(&tokens).unwrap();
        let restored: OAuthTokens = serde_json::from_str(&json).unwrap();
        assert_eq!(tokens, restored);
    }
}
