# Anagram Tiles — PWA Specification

## Overview
A mobile-first Progressive Web App for rearranging letter tiles to solve anagrams. Designed as a digital replacement for pen and paper — not a solver, just a workspace. Must work on both iOS (Safari) and Android (Chrome) via home screen installation.

## Tech Stack
- Vanilla HTML, CSS, JavaScript (no frameworks)
- Single `index.html` with inline or co-located CSS/JS is fine
- Service worker for PWA install support and offline use
- `manifest.json` for home screen installation
- No backend — all state stored in localStorage

## Core Concepts
- The app manages multiple **pages**, each representing one anagram puzzle
- Each page has a set of up to 30 letter tiles and an **answer bar** at the bottom
- Navigation between pages via a simple page list/sidebar

---

## Pages & Navigation

### Page List
- App opens to a **page list** showing all saved pages
- Each entry shows the original letters and a timestamp
- User can tap to open a page, or create a new one
- User can delete pages (with confirmation)

### Creating a New Page
- User taps "New" button
- A text input appears — user types the letters to anagram (uppercase only, max 30 characters)
- Spaces in the input are allowed and should be preserved as context (they represent known word boundaries) but are NOT given tiles — only A-Z characters get tiles
- On submit, the page is created and opens immediately

---

## Tile Workspace (Main Page View)

### Layout
- The screen is divided into two zones:
  1. **Workspace** (upper ~70% of screen): a free-form 2D area where tiles float
  2. **Answer bar** (lower ~30%): a row of fixed slots where the user builds their answer

### Initial Tile Placement
- When a page is first created, letter tiles are placed **randomly but roughly evenly distributed** across the workspace
- Tiles should not overlap and should have some minimum spacing
- Each tile shows a single uppercase letter, clearly readable (minimum ~40px square on mobile)

### Tile Interaction
- Tiles are **draggable via touch** (must work with finger on mobile, mouse on desktop is a bonus)
- User can drag tiles freely within the workspace to rearrange them visually
- User can drag a tile **from the workspace into an answer bar slot**
- User can drag a tile **from the answer bar back to the workspace**
- User can drag a tile **from one answer bar slot to another** (tiles swap positions)
- Dragging should feel responsive with no perceptible lag
- While dragging, the tile should appear visually "lifted" (slight scale increase and shadow)

### Tile Editing
- User can **tap** a tile (without dragging) to edit its letter
- A small input or letter picker appears to change the letter
- This allows correction of typos in the original anagram

---

## Answer Bar

### Structure
- A horizontal row of **slots** at the bottom of the screen
- The number of slots equals the number of letter tiles (A-Z characters from the input)
- Empty slots are shown as outlined boxes or underscores
- Filled slots show the placed letter tile

### Word Separators
- User can tap the **gap between two adjacent slots** to insert a **slash** (word boundary) or **hyphen**
- Tapping an existing separator cycles: none → slash → hyphen → none
- Separators are visual only — they don't add extra slots
- The answer bar should reflow to show separators clearly between the relevant slots

### Multi-Row Wrapping
- The answer bar wraps across multiple rows when slots don't fit the screen width
- Minimum slot size of ~40px is maintained; the answer zone grows vertically as needed
- When word separators (slash/hyphen) are present, they act as **preferred line-break points** — the layout tries to break at separators first to keep word fragments together on one row
- Separators are only used as break points when needed for fit — e.g. a short answer like "2/2/2" stays on one line if it fits
- The workspace zone shrinks to accommodate extra answer rows

---

## Data Persistence
- All pages and their state (tile positions, answer bar contents, separators) are saved to **localStorage**
- State saves automatically on every change (debounced if needed for performance)
- App loads saved state on startup

---

## PWA Requirements
- `manifest.json` with app name "Anagram Tiles", appropriate icons, `display: standalone`, theme colour
- Service worker that caches all assets for offline use
- App should work fully offline after first load
- Appropriate meta tags for iOS home screen support (`apple-mobile-web-app-capable`, status bar style, etc.)

---

## Visual Design
- Clean, minimal design — light background, clear tile borders
- Tiles: rounded rectangle, white/cream background, dark letter, subtle shadow
- Answer bar: clearly delineated from workspace (border or background colour change)
- Use system fonts for performance
- Must be usable on screens as small as iPhone SE (375px wide)
- Dark mode support is a nice-to-have, not a requirement for v1

---

## Out of Scope (for now)
- No anagram solving / dictionary lookup
- No multiplayer or sharing
- No cloud sync
- No app store distribution
- No animations beyond basic drag feedback