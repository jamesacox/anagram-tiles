// ── Anagram Tiles — Complete Rewrite ────────────────────
// Vanilla JS, no frameworks, no build step.
// Single canvas layout — tiles and answer slots share one coordinate space.

'use strict';

// ── Constants ───────────────────────────────────────────

const STORAGE_KEY = 'anagramTilesPages';
const TILE_SIZE = 44;           // px — base tile/slot size
const TILE_GAP = 6;             // px — gap between answer slots
const SNAP_DISTANCE = 50;       // px — how close to snap into a slot
const ANSWER_PADDING = 10;      // px — padding inside answer zone
const SEP_WIDTH = 20;           // px — width of separator tap targets
const MIN_WORKSPACE_H = 120;    // px — minimum free workspace height
const DRAG_TAP_THRESHOLD = 8;   // px — movement below this counts as tap, not drag
const MAX_LETTERS = 30;

// Separator values
const SEP_NONE = 0;
const SEP_SLASH = 1;
const SEP_HYPHEN = 2;
const SEP_CHARS = { [SEP_NONE]: '', [SEP_SLASH]: '/', [SEP_HYPHEN]: '-' };

// ── DOM References ──────────────────────────────────────

const $pageList = document.getElementById('page-list');
const $pagesUl = document.getElementById('pages-ul');
const $newBtn = document.getElementById('new-btn');
const $workspaceView = document.getElementById('workspace-view');
const $canvas = document.getElementById('canvas');
const $modalOverlay = document.getElementById('modal-overlay');
const $modalLabel = document.getElementById('modal-label');
const $modalInput = document.getElementById('modal-input');
const $modalOk = document.getElementById('modal-ok');
const $modalCancel = document.getElementById('modal-cancel');

// ── State ───────────────────────────────────────────────

let pages = [];
let currentPageId = null;
let slotPositions = [];   // [{x, y}] computed on each render

// Drag state — kept outside of functions so cleanup is reliable
let drag = null;  // { tileId, el, startX, startY, offsetX, offsetY, moved, fromAnswer, fromSlotIdx }

// ── Persistence ─────────────────────────────────────────

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    pages = raw ? JSON.parse(raw) : [];
  } catch {
    pages = [];
  }
}

function getPage(id) {
  return pages.find(p => p.id === id);
}

// ── Modal Helper ────────────────────────────────────────

function showModal(label, value, maxLength, validate) {
  return new Promise(resolve => {
    $modalLabel.textContent = label;
    $modalInput.value = value;
    $modalInput.maxLength = maxLength;
    $modalOverlay.classList.remove('hidden');
    $modalInput.focus();

    function cleanup() {
      $modalOverlay.classList.add('hidden');
      $modalOk.onclick = null;
      $modalCancel.onclick = null;
      $modalInput.onkeydown = null;
    }

    function submit() {
      const result = validate($modalInput.value);
      if (result !== null) {
        cleanup();
        resolve(result);
      }
    }

    $modalOk.onclick = submit;
    $modalCancel.onclick = () => { cleanup(); resolve(null); };
    $modalInput.onkeydown = e => { if (e.key === 'Enter') submit(); };
  });
}

// ── Page List View ──────────────────────────────────────

function showPageList() {
  currentPageId = null;
  $workspaceView.classList.add('hidden');
  $pageList.classList.remove('hidden');
  renderPageList();
}

function renderPageList() {
  $pagesUl.innerHTML = '';
  pages.forEach(page => {
    const li = document.createElement('li');
    li.className = 'page-item';

    const textDiv = document.createElement('div');
    textDiv.className = 'page-item-text';

    const letters = document.createElement('div');
    letters.className = 'page-item-letters';
    letters.textContent = page.letters;

    const date = document.createElement('div');
    date.className = 'page-item-date';
    date.textContent = new Date(page.created).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    textDiv.appendChild(letters);
    textDiv.appendChild(date);
    li.appendChild(textDiv);

    const del = document.createElement('button');
    del.className = 'page-item-delete';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Delete this anagram?')) {
        pages = pages.filter(p => p.id !== page.id);
        save();
        renderPageList();
      }
    });
    li.appendChild(del);

    li.addEventListener('click', () => openPage(page.id));
    $pagesUl.appendChild(li);
  });
}

// ── Create New Page ─────────────────────────────────────

async function createNewPage() {
  const letters = await showModal(
    'Enter letters (A–Z, spaces allowed):',
    '',
    MAX_LETTERS,
    val => {
      const cleaned = val.toUpperCase().replace(/[^A-Z ]/g, '');
      if (cleaned.replace(/ /g, '').length === 0) return null;
      return cleaned;
    }
  );
  if (!letters) return;

  const tileLetters = letters.replace(/ /g, '').split('');
  const canvasW = $canvas.clientWidth;
  const canvasH = $canvas.clientHeight;

  // Place tiles in a grid with jitter, in the upper part of the canvas
  const workspaceH = canvasH * 0.6;
  const cols = Math.ceil(Math.sqrt(tileLetters.length));
  const rows = Math.ceil(tileLetters.length / cols);
  const cellW = (canvasW - 20) / cols;
  const cellH = workspaceH / rows;

  const tiles = tileLetters.map((ch, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: 't' + i + '_' + Date.now(),
      letter: ch,
      x: Math.round(10 + col * cellW + Math.random() * Math.max(0, cellW - TILE_SIZE - 4)),
      y: Math.round(40 + row * cellH + Math.random() * Math.max(0, cellH - TILE_SIZE - 4)),
      inAnswer: false,
      answerIdx: null
    };
  });

  const page = {
    id: 'p' + Date.now(),
    letters,
    created: Date.now(),
    tiles,
    answer: new Array(tiles.length).fill(null),
    separators: new Array(Math.max(0, tiles.length - 1)).fill(SEP_NONE)
  };

  pages.unshift(page);
  save();
  openPage(page.id);
}

// ── Open Page (Workspace) ───────────────────────────────

function openPage(id) {
  const page = getPage(id);
  if (!page) return;
  currentPageId = id;
  $pageList.classList.add('hidden');
  $workspaceView.classList.remove('hidden');
  renderWorkspace();
}

// ── Answer Bar Layout Engine ────────────────────────────
// Computes slot positions with smart multi-row wrapping.
// Tries to break at separators when a row overflows.

function computeSlotLayout(page) {
  const canvasW = $canvas.clientWidth;
  const canvasH = $canvas.clientHeight;
  const totalSlots = page.answer.length;
  if (totalSlots === 0) return { positions: [], answerZoneTop: canvasH };

  const step = TILE_SIZE + TILE_GAP; // px per slot
  const sepStep = SEP_WIDTH;         // px per visible separator
  const maxRowW = canvasW - ANSWER_PADDING * 2;

  // Build "segments" — groups of consecutive slots split by separators.
  // Each segment is a run of slots between separator positions (or start/end).
  const segments = [];
  let segStart = 0;
  for (let i = 0; i < totalSlots; i++) {
    // A separator sits between slot i-1 and slot i.
    // If separator[i-1] is non-zero, that's a break point.
    if (i > 0 && page.separators[i - 1] !== SEP_NONE) {
      segments.push({ start: segStart, end: i - 1, sepAfter: page.separators[i - 1] });
      segStart = i;
    }
  }
  segments.push({ start: segStart, end: totalSlots - 1, sepAfter: SEP_NONE });

  // Measure width of a segment (in px)
  function segWidth(seg) {
    const slotCount = seg.end - seg.start + 1;
    return slotCount * step - TILE_GAP; // no trailing gap
  }

  // Pack segments into rows using a greedy algorithm.
  // A separator between segments takes sepStep px.
  const rows = []; // each row = [seg, seg, ...]
  let currentRow = [];
  let currentRowW = 0;

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const sw = segWidth(seg);
    const sepW = currentRow.length > 0 ? sepStep : 0;

    if (currentRow.length > 0 && currentRowW + sepW + sw > maxRowW) {
      // Overflow — push current row, start new one
      rows.push(currentRow);
      currentRow = [seg];
      currentRowW = sw;
    } else {
      currentRow.push(seg);
      currentRowW += sepW + sw;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // If there are no separators and everything is one segment,
  // that segment may still be wider than maxRowW.
  // In that case, do plain wrapping by slot count.
  if (segments.length === 1 && segWidth(segments[0]) > maxRowW) {
    return computePlainWrapLayout(page, totalSlots, maxRowW, step, canvasW, canvasH);
  }

  // Now compute actual x,y for each slot.
  const positions = new Array(totalSlots);
  const rowCount = rows.length;
  const answerH = rowCount * step + ANSWER_PADDING * 2;
  const answerTop = canvasH - answerH;

  for (let r = 0; r < rowCount; r++) {
    const rowSegs = rows[r];
    // Compute total row width to centre it
    let rowW = 0;
    for (let s = 0; s < rowSegs.length; s++) {
      if (s > 0) rowW += sepStep;
      rowW += segWidth(rowSegs[s]);
    }
    let x = Math.round((canvasW - rowW) / 2);
    const y = answerTop + ANSWER_PADDING + r * step;

    for (let s = 0; s < rowSegs.length; s++) {
      const seg = rowSegs[s];
      if (s > 0) x += sepStep; // space for separator
      for (let i = seg.start; i <= seg.end; i++) {
        positions[i] = { x, y };
        x += step;
      }
    }
  }

  return { positions, answerZoneTop: answerTop };
}

function computePlainWrapLayout(page, totalSlots, maxRowW, step, canvasW, canvasH) {
  const slotsPerRow = Math.max(1, Math.floor((maxRowW + TILE_GAP) / step));
  const rowCount = Math.ceil(totalSlots / slotsPerRow);
  const answerH = rowCount * step + ANSWER_PADDING * 2;
  const answerTop = canvasH - answerH;
  const positions = new Array(totalSlots);

  for (let i = 0; i < totalSlots; i++) {
    const row = Math.floor(i / slotsPerRow);
    const col = i % slotsPerRow;
    // Centre each row
    const slotsInRow = Math.min(slotsPerRow, totalSlots - row * slotsPerRow);
    const rowW = slotsInRow * step - TILE_GAP;
    const startX = Math.round((canvasW - rowW) / 2);
    positions[i] = {
      x: startX + col * step,
      y: answerTop + ANSWER_PADDING + row * step
    };
  }

  return { positions, answerZoneTop: answerTop };
}

// ── Render Workspace ────────────────────────────────────

function renderWorkspace() {
  const page = getPage(currentPageId);
  if (!page) return showPageList();

  $canvas.innerHTML = '';

  // Compute answer slot positions
  const layout = computeSlotLayout(page);
  slotPositions = layout.positions;
  const answerZoneTop = layout.answerZoneTop;

  // Answer zone background
  const zone = document.createElement('div');
  zone.className = 'answer-zone';
  zone.style.height = ($canvas.clientHeight - answerZoneTop) + 'px';
  $canvas.appendChild(zone);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'back-btn';
  backBtn.textContent = '← Back';
  backBtn.addEventListener('click', showPageList);
  $canvas.appendChild(backBtn);

  // Render answer slots
  slotPositions.forEach((pos, i) => {
    const slot = document.createElement('div');
    slot.className = 'answer-slot' + (page.answer[i] ? ' filled' : '');
    slot.style.left = pos.x + 'px';
    slot.style.top = pos.y + 'px';
    slot.style.width = TILE_SIZE + 'px';
    slot.style.height = TILE_SIZE + 'px';
    slot.dataset.slotIdx = i;
    $canvas.appendChild(slot);
  });

  // Render separator tap targets (between adjacent slots on the same row)
  for (let i = 0; i < page.separators.length; i++) {
    const posA = slotPositions[i];
    const posB = slotPositions[i + 1];
    if (!posA || !posB) continue;
    // Only show separator between slots on the same row
    if (posA.y !== posB.y) continue;

    const tap = document.createElement('div');
    tap.className = 'sep-tap';
    tap.style.left = (posA.x + TILE_SIZE) + 'px';
    tap.style.top = posA.y + 'px';
    tap.style.width = (posB.x - posA.x - TILE_SIZE) + 'px';
    tap.style.height = TILE_SIZE + 'px';
    tap.style.fontSize = (TILE_SIZE * 0.55) + 'px';
    tap.textContent = SEP_CHARS[page.separators[i]];
    tap.addEventListener('click', () => {
      page.separators[i] = (page.separators[i] + 1) % 3;
      save();
      renderWorkspace();
    });
    $canvas.appendChild(tap);
  }

  // For separators between rows (line break happened at a separator),
  // show the separator character at the end of the first row.
  for (let i = 0; i < page.separators.length; i++) {
    if (page.separators[i] === SEP_NONE) continue;
    const posA = slotPositions[i];
    const posB = slotPositions[i + 1];
    if (!posA || !posB) continue;
    if (posA.y === posB.y) continue; // same row — already rendered above

    const tap = document.createElement('div');
    tap.className = 'sep-tap';
    // Place it just after the last slot on this row
    tap.style.left = (posA.x + TILE_SIZE + 2) + 'px';
    tap.style.top = posA.y + 'px';
    tap.style.width = SEP_WIDTH + 'px';
    tap.style.height = TILE_SIZE + 'px';
    tap.style.fontSize = (TILE_SIZE * 0.55) + 'px';
    tap.textContent = SEP_CHARS[page.separators[i]];
    tap.addEventListener('click', () => {
      page.separators[i] = (page.separators[i] + 1) % 3;
      save();
      renderWorkspace();
    });
    $canvas.appendChild(tap);
  }

  // Update tile positions for tiles in the answer
  page.tiles.forEach(tile => {
    if (tile.inAnswer && tile.answerIdx != null && slotPositions[tile.answerIdx]) {
      tile.x = slotPositions[tile.answerIdx].x;
      tile.y = slotPositions[tile.answerIdx].y;
    }
  });

  // Render tiles — answer tiles first (lower z), then free tiles (higher z)
  page.tiles.forEach(tile => {
    if (tile.inAnswer) $canvas.appendChild(createTileEl(tile, page, answerZoneTop));
  });
  page.tiles.forEach(tile => {
    if (!tile.inAnswer) $canvas.appendChild(createTileEl(tile, page, answerZoneTop));
  });
}

// ── Create Tile Element ─────────────────────────────────

function createTileEl(tile, page, answerZoneTop) {
  const el = document.createElement('div');
  el.className = 'tile' + (tile.inAnswer ? ' in-answer' : '');
  el.textContent = tile.letter;
  el.style.left = tile.x + 'px';
  el.style.top = tile.y + 'px';
  el.style.width = TILE_SIZE + 'px';
  el.style.height = TILE_SIZE + 'px';
  el.style.lineHeight = TILE_SIZE + 'px';
  el.dataset.tileId = tile.id;

  // Attach touch drag
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    startDrag(tile, el, e.touches[0].clientX, e.touches[0].clientY, page, answerZoneTop);
  }, { passive: false });

  // Attach mouse drag
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(tile, el, e.clientX, e.clientY, page, answerZoneTop);
  });

  return el;
}

// ── Drag System ─────────────────────────────────────────
// Single unified system for both touch and mouse.
// Tracks movement to distinguish tap from drag.

function startDrag(tile, el, clientX, clientY, page, answerZoneTop) {
  if (drag) return; // one drag at a time

  const canvasRect = $canvas.getBoundingClientRect();

  drag = {
    tileId: tile.id,
    el,
    startX: tile.x,
    startY: tile.y,
    offsetX: clientX - canvasRect.left - tile.x,
    offsetY: clientY - canvasRect.top - tile.y,
    moved: false,
    totalDist: 0,
    fromAnswer: tile.inAnswer,
    fromSlotIdx: tile.answerIdx,
    page,
    answerZoneTop,
    canvasRect
  };

  el.classList.add('dragging');

  // Add move/end listeners on window for reliable capture
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);
  window.addEventListener('touchcancel', onDragEnd);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();

  const point = e.touches ? e.touches[0] : e;
  const canvasRect = drag.canvasRect;

  let nx = point.clientX - canvasRect.left - drag.offsetX;
  let ny = point.clientY - canvasRect.top - drag.offsetY;

  // Clamp to canvas bounds
  nx = Math.max(0, Math.min(nx, canvasRect.width - TILE_SIZE));
  ny = Math.max(0, Math.min(ny, canvasRect.height - TILE_SIZE));

  drag.totalDist += Math.hypot(nx - (drag.moved ? parseFloat(drag.el.style.left) : drag.startX),
                                ny - (drag.moved ? parseFloat(drag.el.style.top) : drag.startY));
  drag.moved = true;

  drag.el.style.left = nx + 'px';
  drag.el.style.top = ny + 'px';
}

function onDragEnd(e) {
  if (!drag) return;
  e.preventDefault();

  const d = drag;
  drag = null;
  cleanupDragListeners();
  d.el.classList.remove('dragging');

  const page = d.page;
  const tile = page.tiles.find(t => t.id === d.tileId);
  if (!tile) return;

  // If barely moved, treat as tap → edit tile
  if (d.totalDist < DRAG_TAP_THRESHOLD) {
    tile.x = d.startX;
    tile.y = d.startY;
    editTile(tile, page);
    return;
  }

  // Get tile's current centre
  const tileX = parseFloat(d.el.style.left);
  const tileY = parseFloat(d.el.style.top);
  const tileCX = tileX + TILE_SIZE / 2;
  const tileCY = tileY + TILE_SIZE / 2;

  // Find nearest answer slot within snap distance
  let bestIdx = -1;
  let bestDist = SNAP_DISTANCE;

  for (let i = 0; i < slotPositions.length; i++) {
    const sp = slotPositions[i];
    const cx = sp.x + TILE_SIZE / 2;
    const cy = sp.y + TILE_SIZE / 2;
    const dist = Math.hypot(tileCX - cx, tileCY - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  if (bestIdx !== -1) {
    // Snap into a slot
    placeTileInSlot(page, tile, bestIdx, d.fromSlotIdx);
  } else {
    // Drop as free tile
    removeTileFromAnswer(page, tile);
    tile.x = tileX;
    tile.y = tileY;

    // Keep free tiles out of the answer zone
    if (tile.y + TILE_SIZE > d.answerZoneTop) {
      tile.y = Math.max(0, d.answerZoneTop - TILE_SIZE - 4);
    }
  }

  save();
  renderWorkspace();
}

function cleanupDragListeners() {
  window.removeEventListener('touchmove', onDragMove);
  window.removeEventListener('touchend', onDragEnd);
  window.removeEventListener('touchcancel', onDragEnd);
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
}

// ── Tile Placement Logic ────────────────────────────────

function placeTileInSlot(page, tile, targetIdx, fromSlotIdx) {
  const existingTileId = page.answer[targetIdx];

  if (existingTileId && existingTileId !== tile.id) {
    // Slot is occupied — swap
    const otherTile = page.tiles.find(t => t.id === existingTileId);
    if (otherTile) {
      if (fromSlotIdx != null && fromSlotIdx !== targetIdx) {
        // Dragged from another slot → swap the two
        page.answer[fromSlotIdx] = otherTile.id;
        otherTile.inAnswer = true;
        otherTile.answerIdx = fromSlotIdx;
        otherTile.x = slotPositions[fromSlotIdx].x;
        otherTile.y = slotPositions[fromSlotIdx].y;
      } else {
        // Dragged from workspace → displace occupant to workspace
        removeTileFromAnswer(page, otherTile);
        // Give displaced tile a position in the workspace
        otherTile.x = tile.x;
        otherTile.y = tile.y;
        // Make sure it's not in the answer zone
        const layout = computeSlotLayout(page);
        if (otherTile.y + TILE_SIZE > layout.answerZoneTop) {
          otherTile.y = Math.max(0, layout.answerZoneTop - TILE_SIZE - 10);
        }
      }
    }
  } else if (fromSlotIdx != null && fromSlotIdx !== targetIdx) {
    // Moving from one empty slot to another — clear old slot
    page.answer[fromSlotIdx] = null;
  }

  // Remove tile from its previous slot if it had one
  if (tile.inAnswer && tile.answerIdx != null && tile.answerIdx !== targetIdx) {
    if (page.answer[tile.answerIdx] === tile.id) {
      page.answer[tile.answerIdx] = null;
    }
  }

  // Place tile
  page.answer[targetIdx] = tile.id;
  tile.inAnswer = true;
  tile.answerIdx = targetIdx;
  tile.x = slotPositions[targetIdx].x;
  tile.y = slotPositions[targetIdx].y;
}

function removeTileFromAnswer(page, tile) {
  if (tile.inAnswer && tile.answerIdx != null) {
    if (page.answer[tile.answerIdx] === tile.id) {
      page.answer[tile.answerIdx] = null;
    }
  }
  tile.inAnswer = false;
  tile.answerIdx = null;
}

// ── Tile Editing ────────────────────────────────────────

async function editTile(tile, page) {
  const newLetter = await showModal(
    'Edit letter:',
    tile.letter,
    1,
    val => {
      const ch = val.toUpperCase().replace(/[^A-Z]/g, '');
      return ch.length === 1 ? ch : null;
    }
  );
  if (newLetter) {
    tile.letter = newLetter;
    save();
  }
  renderWorkspace();
}

// ── Event Bindings ──────────────────────────────────────

$newBtn.addEventListener('click', createNewPage);

// Prevent zoom gestures
window.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// Prevent double-tap zoom (iOS)
let lastTouchEnd = 0;
window.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// Re-render workspace on resize (orientation change etc.)
window.addEventListener('resize', () => {
  if (currentPageId) renderWorkspace();
});

// ── Boot ────────────────────────────────────────────────

load();
showPageList();
