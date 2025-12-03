# FluxStream

A modern, decentralized streaming platform for movies, series, and anime.

## 🚀 Features

- **Movies**: YTS catalog with torrent streaming
- **Series**: Multi-provider streaming (FlixHQ, DramaCool, Goku)
- **Anime**: AnimePahe streaming with download support
- **Torrent Streaming**: In-browser WebTorrent playback
- **Stremio Addons**: Custom addon support

## 🛠️ Tech Stack

**Frontend:**
- React + TypeScript
- Vite
- TailwindCSS (via inline styles)
- HLS.js for streaming

**Backend:**
- Node.js + Express
- @consumet/extensions
- torrent-stream

## 📦 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment guide.

**Quick Start:**
1. Deploy backend to Fly.io
2. Deploy frontend to Vercel
3. Set `VITE_API_URL` environment variable

## 🔄 Updates

```bash
# Auto-deploy on git push
git add .
git commit -m "Update"
git push
```

Vercel auto-deploys frontend, run `flyctl deploy` for backend.

## 📝 License

MIT
