# Universal Vercel deployment setup

This repository is the shared application core. Multiple Vercel projects may connect to the same GitHub repository while using separate Firebase and LINE projects.

## Browser configuration

Add these variables to both **Preview** and **Production** for each Vercel project:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_LINE_LIFF_ID`
- `VITE_AUTH_ENDPOINT` (normally `/api/auth`)
- `VITE_BOOTSTRAP_ENDPOINT` (normally `/api/bootstrap`)

Vite embeds `VITE_*` values in the browser bundle. They are deployment configuration, not server-side secrets.

## Server-only configuration

- `FIREBASE_SERVICE_ACCOUNT` is required and must remain server-only.
- `LINE_CHANNEL_ID` is optional. When omitted, `/api/auth` derives the channel ID from the prefix of `VITE_LINE_LIFF_ID`.

Never add a `VITE_` prefix to a service account, private key, channel secret, or other server credential.

## LINE requirements

The LIFF app must include the `openid` scope so the browser can call `liff.getIDToken()`. The backend verifies that ID token with LINE before issuing a Firebase custom token.

## Existing deployment behavior

An existing Firebase project with users or department documents continues to open normally. The bootstrap layer does not overwrite existing records.

## New deployment behavior

For an empty Firebase project:

1. The first verified LINE user sees the initialization screen.
2. They enter a system name, administrator name, and at least one department.
3. `/api/bootstrap` atomically creates `settings/app`, `settings/categories`, department documents, and the first administrator.
4. Later users see the deployment-specific join request screen and must be approved by an administrator.

## Safe rollout order

1. Add variables to the Vercel Preview environment.
2. Deploy the feature branch Preview.
3. Verify `/api/auth` and `/api/bootstrap` health endpoints.
4. Test an existing authorized account against existing Firestore data.
5. Test initialization with a separate empty Firebase project.
6. Add or verify the same variables in Production.
7. Merge only after both compatibility paths pass.
