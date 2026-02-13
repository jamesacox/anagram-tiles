# Anagram Tiles — Project Conventions

## Tech Stack
- **Vanilla HTML, CSS, JavaScript only** — no frameworks, no build step, no bundler
- Single `index.html` with co-located or linked CSS/JS files
- No backend — all state in `localStorage`
- PWA: `manifest.json` + service worker for offline use and home screen install

## Design Principles
- **Mobile-first**: must work on iPhone SE (375px) and up
- Touch interactions are primary; mouse/desktop is secondary
- Clean, minimal UI — system fonts, subtle shadows, light background
- Performance over cleverness — keep it simple

## PWA Requirements
- `manifest.json` with `display: standalone`, theme colour, icons (192px, 512px)
- Service worker caches all assets for full offline use
- iOS meta tags: `apple-mobile-web-app-capable`, status bar style, icons

## File Structure
```
index.html          — root document
style.css           — all styles
app.js              — all application logic
service-worker.js   — cache-first offline strategy
manifest.json       — PWA manifest
icon-192.png        — PWA icon
icon-512.png        — PWA icon
favicon.ico         — browser tab icon
SPEC.md             — full product specification
```

## Key Behaviours (from SPEC.md)
- App manages multiple **pages**, each an anagram puzzle
- Each page has a free-form **workspace** (~70% screen) and an **answer bar** (~30%)
- Tiles are draggable via touch between workspace and answer bar
- Spaces in input are preserved as context but don't get tiles (A-Z only)
- Answer bar separators cycle: none → slash → hyphen → none
- Tap a tile to edit its letter
- State auto-saves to localStorage on every change

## Code Style
- No TypeScript, no JSX, no transpilation
- Prefer `const`/`let` over `var`
- Use semantic HTML where possible
- CSS: mobile-first, use `dvh` for viewport height on mobile
- Avoid magic numbers — use named constants
- Keep functions small and single-purpose
