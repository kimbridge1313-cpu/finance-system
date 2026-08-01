# Finance System

A shared React/Vite financial-system core designed for multiple independent deployments.

## Architecture

One GitHub repository is the source of truth for application code. Each organization connects its own Vercel project to this repository and supplies independent Firebase and LINE configuration.

```text
finance-system (shared GitHub repository)
├─ Vercel Project A → Firebase A → LINE LIFF A
├─ Vercel Project B → Firebase B → LINE LIFF B
└─ Vercel Project C → Firebase C → LINE LIFF C
```

No organization-specific credentials or financial records belong in GitHub.

## Deployment-specific resources

Each deployment requires its own:

- Vercel project
- Firebase project and Firestore database
- Firebase service account
- LINE Login channel and LIFF app
- Vercel environment variables

See [`docs/VERCEL_ENV_SETUP.md`](docs/VERCEL_ENV_SETUP.md) for the complete setup and rollout procedure.

## First-time initialization

When the connected Firebase project is empty, the first verified LINE user is shown a setup screen. The setup creates:

- system name
- first administrator
- department documents
- default accounting categories
- deployment metadata

Subsequent users submit join requests and require administrator approval.

## Security model

- LINE identity is verified server-side from a LINE ID Token.
- Firebase browser configuration and LIFF ID are supplied through `VITE_*` variables.
- `FIREBASE_SERVICE_ACCOUNT` remains server-only.
- Firestore rules are versioned in this repository and deployed separately to each Firebase project.

## Development workflow

- `main` must remain deployable.
- Feature work is developed in isolated branches.
- Preview deployments are tested before merge.
- Production deployments are never changed solely to test a feature.
