# Quick Start Guide

Get your Tetris.dual web game running in minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Run Development Server (Without Auth)

For quick testing without authentication:

```bash
npm run dev
```

Then visit http://localhost:5173 and click "Solo Mode" to play!

## 3. Full Setup (With Multiplayer and Auth)

### A. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback/google` (for development)
   - `https://your-domain.com/auth/callback/google` (for production)
6. Copy Client ID and Client Secret

### B. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
AUTH_SECRET=$(openssl rand -base64 32)
```

### C. Set Up Cloudflare (For Deployment)

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 Database
wrangler d1 create tetris-dual-db

# Copy the database ID and update wrangler.toml
# Then run migrations
npm run db:migrate
```

## 4. Play!

- **Solo Mode**: Play classic Tetris with progressive difficulty
- **Dual Mode**: Real-time multiplayer (requires deployment to Cloudflare)

### Controls

**Keyboard:**
- Arrow Keys: Move left/right/down
- Up Arrow or Space: Rotate
- Enter: Hard drop
- ESC: Pause

**Mobile:**
- Touch controls appear automatically on mobile devices

## Troubleshooting

### Port already in use
```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9
```

### TypeScript errors
```bash
npm run check
```

### Build fails
```bash
# Clear cache
rm -rf .svelte-kit node_modules
npm install
npm run build
```

## Next Steps

- Read [README.web.md](./README.web.md) for detailed documentation
- Check out the game logic in `src/lib/game/engine.ts`
- Customize colors in `tailwind.config.ts`
- Add sound effects in the components

Enjoy! 🎮
