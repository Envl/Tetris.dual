# Tetris.dual - Web Edition

A modern web-based rebuild of the classic Tetris DS dual mode game. Built with Svelte 5, SvelteKit, and Cloudflare Workers.

## Features

- 🎮 **Solo Mode**: Classic Tetris gameplay with progressive difficulty
- 🤝 **Dual Mode**: Real-time multiplayer via WebRTC P2P connection
- 🔄 **Board Shifting**: Clear lines to shift your opponent's board (like Tetris DS!)
- 📱 **Responsive**: Works on desktop and mobile with touch controls
- ☁️ **Serverless**: Deployed on Cloudflare Workers with Durable Objects for matchmaking
- 🔐 **Authentication**: Google OAuth for user accounts
- 📊 **Statistics**: Track your scores and match history with Drizzle ORM

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit
- **Styling**: Tailwind CSS 4
- **Database**: Cloudflare D1 with Drizzle ORM
- **Authentication**: Auth.js with Google OAuth
- **Multiplayer**: WebRTC (P2P) with Durable Objects for matchmaking
- **Deployment**: Cloudflare Workers + Pages

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare account (for deployment)
- Google OAuth credentials

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `AUTH_SECRET`: Random secret key for Auth.js (generate with `openssl rand -base64 32`)

3. **Set up Cloudflare D1 Database:**

```bash
# Create the database
npx wrangler d1 create tetris-dual-db

# Update wrangler.toml with your database ID
# Generate database schema
npm run db:generate

# Apply migrations
npm run db:migrate
```

4. **Run development server:**

```bash
npm run dev
```

Visit `http://localhost:5173` to play!

## Project Structure

```
src/
├── lib/
│   ├── components/          # Svelte components
│   │   ├── GameBoard.svelte
│   │   ├── GameControls.svelte
│   │   ├── NextPieces.svelte
│   │   └── ScoreBoard.svelte
│   ├── game/                # Game engine
│   │   ├── engine.ts        # Core Tetris logic
│   │   ├── tetrominos.ts    # Piece definitions
│   │   └── types.ts         # TypeScript types
│   ├── multiplayer/         # P2P and matchmaking
│   │   ├── p2p.ts           # WebRTC connection
│   │   └── matchmaking.ts   # Matchmaking client
│   └── db/
│       └── schema.ts        # Database schema
├── routes/
│   ├── +page.svelte         # Home page
│   ├── game/
│   │   ├── solo/           # Single player mode
│   │   └── dual/           # Multiplayer mode
│   └── auth/
│       └── signin/         # Authentication
├── durable-objects/
│   └── MatchmakingRoom.ts  # Matchmaking logic
└── hooks.server.ts         # Auth.js setup
```

## Game Controls

### Keyboard
- **Arrow Left/Right**: Move piece
- **Arrow Down**: Soft drop
- **Arrow Up / Space**: Rotate
- **Enter**: Hard drop
- **ESC**: Pause

### Touch/Mobile
- Use the on-screen buttons for all controls

## How Dual Mode Works

1. **Matchmaking**: Players enter a queue managed by Cloudflare Durable Objects
2. **Connection**: When matched, players establish a WebRTC P2P connection
3. **Gameplay**: Game states are synchronized via the P2P connection
4. **Board Shifting**: When a player clears 2+ lines, the opponent's board shifts down
5. **Victory**: First player to fill their board loses

## Deployment

### Cloudflare Pages + Workers

1. **Build the project:**

```bash
npm run build
```

2. **Deploy to Cloudflare:**

```bash
npm run deploy
```

3. **Set environment variables in Cloudflare Dashboard:**
   - Go to your Worker settings
   - Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET`

## Development

### Database Management

```bash
# Generate new migrations
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

### Type Checking

```bash
npm run check
```

## Original Game

This is a rebuild of the original Android Tetris.dual game (2015), which featured Bluetooth multiplayer. The original game logic has been preserved while modernizing the implementation with web technologies.

## License

MIT

## Credits

Original Android version: [Envl/Tetris.dual](https://github.com/Envl/Tetris.dual)

Web rebuild: 2024
