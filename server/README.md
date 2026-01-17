# TWSVP Backend

Minimal Node.js API for Google OAuth login and posts.

## Setup

1) Install dependencies
```
npm install
```

2) Create `.env`
```
cp .env.example .env
```

3) Configure the database
```
npm run prisma:generate
npm run prisma:migrate
```

4) Run locally
```
npm run dev
```

## Google OAuth

- Create OAuth client in Google Cloud Console
- Set redirect URI to `https://twsvp.com/auth/callback`
- Use the same redirect URI in `.env`

## API

- `POST /auth/google` with `{ "code": "..." }`
- `GET /me` (Bearer token)
- `GET /posts`
- `POST /posts` (Bearer token)

## Render deploy

- Build command: `npm install && npm run prisma:generate`
- Start command: `npm start`
- Set env vars from `.env`

