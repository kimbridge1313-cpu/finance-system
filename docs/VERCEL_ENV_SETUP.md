# Vercel environment setup

Configure these values in **Vercel → Project Settings → Environment Variables** before merging this branch.

## Browser configuration

Add each variable to both **Preview** and **Production**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_LINE_LIFF_ID`
- `VITE_AUTH_ENDPOINT` (normally `/api/auth`)

Vite embeds `VITE_*` values in the browser bundle. They keep deployment configuration out of GitHub source files, but they are not server-side secrets.

## Server-only secret

Keep `FIREBASE_SERVICE_ACCOUNT` in Vercel only. Do not prefix it with `VITE_`, do not place it in `.env.example`, and do not expose it to client code.

## Safe rollout order

1. Add all variables to Vercel Preview.
2. Redeploy the pull-request preview.
3. Verify LINE login, `/api/auth`, Firestore reads, and one non-destructive test record.
4. Add or verify the same variables in Vercel Production.
5. Merge only after the preview passes.
6. Confirm the production deployment, then remove any obsolete deployment configuration.

## Deployment record

Production browser variables were imported on 2026-08-01. This documentation-only update triggers a clean Production rebuild so Vite can embed the Production values.
