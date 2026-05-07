# Contributing

## Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Production — protected, requires PR + passing CI |
| `develop` | Integration — triggers staging deploy on push |
| `feat/*` | New features — branch from `develop` |
| `fix/*` | Bug fixes — branch from `develop` |
| `chore/*` | Maintenance, docs, refactor |

## Workflow

```bash
git checkout develop
git pull origin develop
git checkout -b feat/my-feature

# ... make changes ...

git push origin feat/my-feature
# Open PR → develop
```

Hotfixes that need to go straight to production branch from `main` and PR back to both `main` and `develop`.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(server): add webhook retry logic
fix(client): correct date range picker timezone offset
chore(worker): bump wrangler to 4.x
docs: update deploy guide
```

## Local setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) (for worker development)

### Server

```bash
cd server
cp .env.example .env   # fill in values
npm install
npm run start:dev
```

### Client

```bash
cd client
npm install
npm run dev
```

### Worker

```bash
cd worker
npm install
npm run dev
```

## CI checks

All PRs must pass:

- **Server**: `npm run lint` + `npm run build`
- **Client**: `npm run lint` + `npm run build` + `npm test`
- **Worker**: `npm run type-check`

Run them locally before pushing:

```bash
# Server
cd server && npm run lint && npm run build

# Client
cd client && npm run lint && npm run build && npm test

# Worker
cd worker && npm run type-check
```

## Adding environment variables

If your change requires a new env var:

1. Add it to `server/.env.example` (name only, no value)
2. Document it in your PR description
3. Add it to `.github/workflows/ci.yml` if needed for CI
