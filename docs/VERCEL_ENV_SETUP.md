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

## Firebase rules

Each Firebase project must deploy the repository's shared Firestore rules before normal users begin using the application:

```bash
firebase use <firebase-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

The included rules allow authenticated users to read operational data, allow staff to create and maintain their own daily records within their assigned department, and reserve configuration, vendor, employee, fixed-expense, billing, and report-adjustment writes for administrators.

The bootstrap API uses the Firebase Admin SDK and can create the first administrator even before client rules are deployed. Normal front-end reads and writes require the rules afterward.

## Existing deployment behavior

An existing Firebase project with users or department documents continues to open normally. The bootstrap layer does not overwrite existing records.

## New deployment behavior

For an empty Firebase project:

1. The first verified LINE user sees the initialization screen.
2. They enter a system name, administrator name, and at least one department.
3. `/api/bootstrap` atomically creates `settings/app`, `settings/categories`, department documents, and the first administrator.
4. Later users see the deployment-specific join request screen and must be approved by an administrator.
5. Department additions and name changes are stored in that deployment's Firestore project; department codes remain immutable so existing records retain their references.

## Safe rollout order

1. Create the Firebase and LINE projects for the deployment.
2. Deploy `firestore.rules` and `firestore.indexes.json` to that Firebase project.
3. Add variables to the Vercel Preview environment.
4. Deploy the feature branch Preview.
5. Verify `/api/auth` and `/api/bootstrap` health endpoints.
6. Test an existing authorized account against existing Firestore data.
7. Test initialization with a separate empty Firebase project.
8. Add or verify the same variables in Production.
9. Merge only after both compatibility paths pass.
