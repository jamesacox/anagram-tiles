// Anagram Tiles PWA — Core logic for tile layout and drag

const STORAGE_KEY = 'anagramTilesPages';
const app = document.getElementById('app');

let pages = [];
let currentPageId = null;

function savePages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}
function loadPages() {
  const raw = localStorage.getItem(STORAGE_KEY);
  pages = raw ? JSON.parse(raw) : [];
}

function renderPageList() {
  app.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'page-list';
  const h1 = document.createElement('h1');
  h1.textContent = 'Anagram Tiles';
  container.appendChild(h1);

  const newBtn = document.createElement('button');
  newBtn.className = 'new-btn';
  newBtn.textContent = 'New Anagram';
  newBtn.onclick = () => showNewPageInput(container);
  container.appendChild(newBtn);

  const ul = document.createElement('ul');
  pages.forEach((page, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${page.letters} <small>${new Date(page.created).toLocaleString()}</small></span>`;
    li.onclick = () => openPage(page.id);
    const del = document.createElement('button');
    del.textContent = '🗑️';
    del.onclick = e => { e.stopPropagation(); confirmDeletePage(page.id); };
    li.appendChild(del);
    ul.appendChild(li);
  });
  container.appendChild(ul);
  app.appendChild(container);
}

function showNewPageInput(container) {
  // Modal input for iOS zoom prevention
  let modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100vw';
  modal.style.height = '100dvh';
  modal.style.background = 'rgba(0,0,0,0.3)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '1000';
  let box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '2rem';
  box.style.borderRadius = '12px';
  box.style.boxShadow = '0 2px 16px rgba(0,0,0,0.15)';
  let label = document.createElement('label');
  label.textContent = 'Enter letters (A-Z, spaces allowed):';
  label.style.display = 'block';
  label.style.marginBottom = '1rem';
  let input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 30;
  input.placeholder = 'ANAGRAMLETTERS';
  input.style.fontSize = '16px';
  input.style.marginBottom = '1rem';
  input.style.width = '100%';
  input.style.padding = '0.5rem';
  input.autocapitalize = 'characters';
  input.autocomplete = 'off';
  input.spellcheck = false;
  box.appendChild(label);
  box.appendChild(input);
  let submit = document.createElement('button');
  submit.textContent = 'Create';
  submit.style.fontSize = '16px';
  submit.style.padding = '0.5rem 1.5rem';
  submit.style.marginRight = '1rem';
  let cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.fontSize = '16px';
  cancel.style.padding = '0.5rem 1.5rem';
  box.appendChild(submit);
  box.appendChild(cancel);
  modal.appendChild(box);
  document.body.appendChild(modal);
  input.focus();
  submit.onclick = () => {
    const val = input.value.toUpperCase().replace(/[^A-Z ]/g, '');
    if (val.replace(/ /g, '').length === 0) return;
    document.body.removeChild(modal);
    createPage(val);
  };
  cancel.onclick = () => {
    document.body.removeChild(modal);
  };
  input.onkeydown = e => {
    if (e.key === 'Enter') submit.onclick();
  };
}

function createPage(letters) {
  const tileLetters = letters.replace(/ /g, '').split('');
  const tiles = tileLetters.map((ch, i) => ({
    id: 't' + i + '-' + Date.now(),
    letter: ch,
    x: 0, y: 0, // will be randomized
    inAnswer: false,
    answerIdx: null
  }));
  // Randomize positions in workspace
  const workspaceW = window.innerWidth - 60;
  const workspaceH = Math.floor(window.innerHeight * 0.7) - 60;
  const grid = Math.ceil(Math.sqrt(tiles.length));
  const spacingX = workspaceW / grid;
  const spacingY = workspaceH / grid;
  tiles.forEach((tile, i) => {
    const gx = i % grid;
    const gy = Math.floor(i / grid);
    tile.x = 20 + gx * spacingX + Math.random() * (spacingX - 48);
    tile.y = 20 + gy * spacingY + Math.random() * (spacingY - 48);
  });
  const page = {
    id: 'p' + Date.now(),
    letters,
    created: Date.now(),
    tiles,
    answer: Array(tiles.length).fill(null),
    separators: Array(tiles.length - 1).fill(0) // 0: none, 1: slash, 2: hyphen
  };
  pages.unshift(page);
  savePages();
  openPage(page.id);
}

function openPage(id) {
  currentPageId = id;
  renderWorkspace();
}

function confirmDeletePage(id) {
  if (confirm('Delete this page?')) {
    pages = pages.filter(p => p.id !== id);
    savePages();
    renderPageList();
  }
}

function renderWorkspace() {
  const page = pages.find(p => p.id === currentPageId);
  if (!page) return renderPageList();
  app.innerHTML = '';
  // Unified workspace/answer area
  const area = document.createElement('div');
  area.className = 'workspace';
  area.style.position = 'relative';
  area.style.height = 'calc(100dvh - 100px)';
  area.style.overflow = 'hidden';
  // Layout answer slots at bottom, at least 7 per row (iPhone SE: 375px)
  const totalSlots = page.answer.length;
  const minSlotsPerRow = 7;
  const areaW = window.innerWidth;
  const slotMargin = 6;
  let slotSize = Math.floor((areaW - (minSlotsPerRow + 1) * slotMargin) / minSlotsPerRow);
  slotSize = Math.max(40, Math.min(60, slotSize));
  let slotsPerRow = Math.floor((areaW + slotMargin) / (slotSize + slotMargin));
  slotsPerRow = Math.max(minSlotsPerRow, slotsPerRow);
  let slotPositions = [];
  let yStart = area.offsetHeight ? area.offsetHeight - Math.ceil(totalSlots / slotsPerRow) * (slotSize + slotMargin) : window.innerHeight - 100 - Math.ceil(totalSlots / slotsPerRow) * (slotSize + slotMargin);
  // Always render answer slots at the bottom
  for (let i = 0; i < totalSlots; ++i) {
    const row = Math.floor(i / slotsPerRow);
    const col = i % slotsPerRow;
    const x = slotMargin + col * (slotSize + slotMargin);
    const y = area.offsetHeight ? area.offsetHeight - (Math.ceil(totalSlots / slotsPerRow) - row) * (slotSize + slotMargin) : yStart + row * (slotSize + slotMargin);
    slotPositions.push({x, y});
    // Render separator tap target (always present, at least 20px wide)
    if (i > 0) {
      const sepTap = document.createElement('div');
      sepTap.className = 'separator-tap';
      sepTap.style.position = 'absolute';
      sepTap.style.left = (x - slotMargin/2 - 10) + 'px';
      sepTap.style.top = y + 'px';
      sepTap.style.width = '24px';
      sepTap.style.height = slotSize + 'px';
      sepTap.style.zIndex = 4;
      sepTap.style.display = 'flex';
      sepTap.style.alignItems = 'center';
      sepTap.style.justifyContent = 'center';
      sepTap.style.cursor = 'pointer';
      sepTap.onclick = () => {
        page.separators[i-1] = (page.separators[i-1] + 1) % 3;
        savePages();
        renderWorkspace();
      };
      const val = page.separators[i-1];
      sepTap.textContent = val === 1 ? '/' : val === 2 ? '-' : '';
      area.appendChild(sepTap);
    }
    // Render slot
    const slot = document.createElement('div');
    slot.className = 'answer-slot' + (page.answer[i] ? ' filled' : '');
    slot.style.position = 'absolute';
    slot.style.left = x + 'px';
    slot.style.top = y + 'px';
    slot.style.width = slotSize + 'px';
    slot.style.height = slotSize + 'px';
    slot.style.lineHeight = slotSize + 'px';
    slot.style.zIndex = 2;
    slot.dataset.idx = i;
    // Place tile if present
    if (page.answer[i]) {
      const tile = page.tiles.find(t => t.id === page.answer[i]);
      if (tile) {
        tile.x = x;
        tile.y = y;
        tile.inAnswer = true;
        tile.answerIdx = i;
        // Tiles in slots get lower z-index
        area.appendChild(createTileElement(tile, page, area, slotSize, 3));
      }
    } else {
      // Empty slot, render as is
      area.appendChild(slot);
    }
  }
  // Render free tiles last (higher z-index)
  page.tiles.forEach(tile => {
    if (!tile.inAnswer) {
      area.appendChild(createTileElement(tile, page, area, slotSize, 10));
    }
  });
  app.appendChild(area);
  // Back button
  let backBtn = document.getElementById('backBtn');
  if (!backBtn) {
    backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    app.appendChild(backBtn);
  }
  backBtn.textContent = '← Anagrams';
  backBtn.style.margin = '1rem auto';
  backBtn.style.display = 'block';
  backBtn.style.width = '90vw';
  backBtn.style.height = '56px';
  backBtn.style.fontSize = '1.3rem';
  backBtn.style.borderRadius = '16px';
  backBtn.style.padding = '1rem';
  backBtn.style.background = '#e0e0e0';
  backBtn.style.border = 'none';
  backBtn.style.fontWeight = 'bold';
  backBtn.onclick = renderPageList;
}

function createTileElement(tile, page, parent) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.textContent = tile.letter;
  el.style.left = tile.x + 'px';
  el.style.top = tile.y + 'px';
  el.style.width = (arguments[3] || 48) + 'px';
  el.style.height = (arguments[3] || 48) + 'px';
  el.style.lineHeight = (arguments[3] || 48) + 'px';
  el.style.zIndex = arguments[4] !== undefined ? arguments[4] : 1;
  el.draggable = true;
  el.dataset.id = tile.id;
  // Mouse drag
  el.ondragstart = e => {
    draggingTileId = tile.id;
    el.classList.add('dragging');
    e.dataTransfer.setData('text/plain', tile.id);
    setTimeout(() => el.classList.remove('dragging'), 200);
  };
  el.ondragend = e => {
    el.classList.remove('dragging');
  };
  // Touch drag and long-press edit
  let longPressTimer = null;
  let touchMoved = false;
  el.ontouchstart = e => {
    if (e.touches.length > 1) { e.preventDefault(); return; }
    touchMoved = false;
    longPressTimer = setTimeout(() => {
      showTileEditModal(tile, page);
      longPressTimer = null;
    }, 500);
  };
  el.ontouchmove = e => {
    if (longPressTimer) {
      const t = e.touches[0];
      // If moved more than 10px, cancel long press
      const dx = t.clientX - (tile.x + (arguments[3]||48)/2);
      const dy = t.clientY - (tile.y + (arguments[3]||48)/2);
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        touchMoved = true;
      }
    }
  };
  el.ontouchend = e => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      e.preventDefault();
    }
    if (!touchMoved && e.changedTouches.length === 1 && !dragging) {
      // Could be a tap, but don't show edit modal here (handled by long-press)
    }
  };
  // Tap to edit (desktop)
  el.onclick = e => {
    if (!dragging && (e.pointerType === undefined || e.pointerType === 'mouse')) showTileEditModal(tile, page);
  };
  return el;

// Modal for editing tile letter (single letter input)
function showTileEditModal(tile, page) {
  let modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100vw';
  modal.style.height = '100dvh';
  modal.style.background = 'rgba(0,0,0,0.3)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '1000';
  let box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '2rem';
  box.style.borderRadius = '12px';
  box.style.boxShadow = '0 2px 16px rgba(0,0,0,0.15)';
  let label = document.createElement('label');
  label.textContent = 'Edit letter:';
  label.style.display = 'block';
  label.style.marginBottom = '1rem';
  let input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 1;
  input.value = tile.letter;
  input.style.fontSize = '32px';
  input.style.marginBottom = '1rem';
  input.style.width = '3ch';
  input.style.textAlign = 'center';
  input.autocapitalize = 'characters';
  input.autocomplete = 'off';
  input.spellcheck = false;
  box.appendChild(label);
  box.appendChild(input);
  let submit = document.createElement('button');
  submit.textContent = 'OK';
  submit.style.fontSize = '20px';
  submit.style.padding = '0.5rem 1.5rem';
  submit.style.marginRight = '1rem';
  let cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.fontSize = '20px';
  cancel.style.padding = '0.5rem 1.5rem';
  box.appendChild(submit);
  box.appendChild(cancel);
  modal.appendChild(box);
  document.body.appendChild(modal);
  input.focus();
  submit.onclick = () => {
    const val = input.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (val.length === 1) {
      tile.letter = val;
      savePages();
      document.body.removeChild(modal);
      renderWorkspace();
    }
  };
  cancel.onclick = () => {
    document.body.removeChild(modal);
  };
  input.onkeydown = e => {
    if (e.key === 'Enter') submit.onclick();
  };
}
}

function showTileEdit(tile, page) {
  const newLetter = prompt('Edit letter:', tile.letter);
  if (newLetter && /^[A-Z]$/.test(newLetter.toUpperCase())) {
    tile.letter = newLetter.toUpperCase();
    savePages();
    renderWorkspace();
  }
}

function createSeparatorElement(page, idx) {
  const sep = document.createElement('div');
  sep.className = 'separator';
  const val = page.separators[idx];
  sep.textContent = val === 1 ? '/' : val === 2 ? '-' : '';
  sep.onclick = () => {
    page.separators[idx] = (val + 1) % 3;
    savePages();
    renderWorkspace();
  };
  return sep;
}

function moveTileToAnswer(page, tileId, idx) {
  // Remove from previous slot
  const prevIdx = page.answer.indexOf(tileId);
  if (prevIdx !== -1) page.answer[prevIdx] = null;
  // If slot filled, swap
  if (page.answer[idx]) {
    const swapId = page.answer[idx];
    if (prevIdx !== -1) {
      page.answer[prevIdx] = swapId;
      page.tiles.forEach(t => {
        if (t.id === swapId) {
          t.inAnswer = true;
          t.answerIdx = prevIdx;
        }
      });
    } else {
      // Move swapId back to workspace
      page.tiles.forEach(t => {
        if (t.id === swapId) {
          t.inAnswer = false;
          t.answerIdx = null;
        }
      });
    }
  }
  page.answer[idx] = tileId;
  page.tiles.forEach(t => {
    if (t.id === tileId) {
      t.inAnswer = true;
      t.answerIdx = idx;
    } else if (t.answerIdx === idx && t.id !== tileId) {
      t.inAnswer = false;
      t.answerIdx = null;
    }
  });
  savePages();
  renderWorkspace();
}

// Allow dragging tiles out of answer bar back to workspace
function moveTileToWorkspace(page, tileId, x, y) {
  const idx = page.answer.indexOf(tileId);
  if (idx !== -1) page.answer[idx] = null;
  page.tiles.forEach(t => {
    if (t.id === tileId) {
      t.inAnswer = false;
      t.answerIdx = null;
      t.x = x;
      t.y = y;
    }
  });
  savePages();
  renderWorkspace();
}

// Touch drag logic
let dragging = false;
let draggingTileId = null;
let dragOffset = {x:0, y:0};
let dragTileElem = null;
function startTileTouchDrag(e, page, tileId, fromAnswer, answerIdx) {
  if (dragging) return; // Only one drag at a time
  dragging = true;
  draggingTileId = tileId;
  dragTileElem = e.target;
  dragTileElem.classList.add('dragging');
  const tile = page.tiles.find(t => t.id === tileId);
  const touch = e.touches[0];
  let startX = tile.x;
  let startY = tile.y;
  dragOffset.x = touch.clientX - tile.x;
  dragOffset.y = touch.clientY - tile.y;
  // Prevent scrolling during drag
  const move = ev => {
    ev.preventDefault();
    if (!dragging) return;
    const t = ev.touches[0];
    // Constrain tile within area and above answer slots
    const area = document.querySelector('.workspace');
    const areaRect = area.getBoundingClientRect();
    let nx = t.clientX - areaRect.left - dragOffset.x;
    let ny = t.clientY - areaRect.top - dragOffset.y;
    // Prevent tile from being dragged below answer slots
    // Find top of answer slot area
    const slotDivs = Array.from(area.querySelectorAll('.answer-slot'));
    let minSlotY = areaRect.height;
    slotDivs.forEach(div => {
      const rect = div.getBoundingClientRect();
      minSlotY = Math.min(minSlotY, rect.top - areaRect.top);
    });
    // Clamp
    nx = Math.max(0, Math.min(nx, areaRect.width - dragTileElem.offsetWidth));
    ny = Math.max(0, Math.min(ny, minSlotY - dragTileElem.offsetHeight - 4));
    tile.x = nx;
    tile.y = ny;
    dragTileElem.style.left = nx + 'px';
    dragTileElem.style.top = ny + 'px';
  };
  const end = ev => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    const area = document.querySelector('.workspace');
    const areaRect = area.getBoundingClientRect();
    // Find nearest empty answer slot within snap distance
    const slotDivs = Array.from(area.querySelectorAll('.answer-slot'));
    let snapIdx = -1;
    let minDist = 9999;
    let snapX = tile.x, snapY = tile.y;
    slotDivs.forEach(div => {
      const idx = parseInt(div.dataset.idx);
      if (page.answer[idx] && page.answer[idx] !== tileId) return; // skip filled slots
      const slotRect = div.getBoundingClientRect();
      const cx = slotRect.left + slotRect.width/2 - areaRect.left;
      const cy = slotRect.top + slotRect.height/2 - areaRect.top;
      const dist = Math.hypot((tile.x + dragTileElem.offsetWidth/2) - cx, (tile.y + dragTileElem.offsetHeight/2) - cy);
      if (dist < 30 && dist < minDist) {
        minDist = dist;
        snapIdx = idx;
        snapX = cx - dragTileElem.offsetWidth/2;
        snapY = cy - dragTileElem.offsetHeight/2;
      }
    });
    // Prevent tile from being left behind answer slots
    let minSlotY = areaRect.height;
    slotDivs.forEach(div => {
      const rect = div.getBoundingClientRect();
      minSlotY = Math.min(minSlotY, rect.top - areaRect.top);
    });
    if (snapIdx !== -1) {
      // Snap into slot, swap if needed
      if (page.answer[snapIdx] && page.answer[snapIdx] !== tileId) {
        // Swap: move occupying tile to previous position
        const swapId = page.answer[snapIdx];
        if (fromAnswer) {
          page.answer[fromAnswer ? answerIdx : -1] = swapId;
        } else {
          // Move swapId to free
          page.tiles.forEach(t => {
            if (t.id === swapId) {
              t.inAnswer = false;
              t.answerIdx = null;
              t.x = startX;
              t.y = startY;
            }
          });
        }
      }
      page.answer[snapIdx] = tileId;
      tile.inAnswer = true;
      tile.answerIdx = snapIdx;
      tile.x = snapX;
      tile.y = snapY;
    } else {
      // Not near any slot: free tile
      if (fromAnswer) {
        page.answer[answerIdx] = null;
      }
      tile.inAnswer = false;
      tile.answerIdx = null;
      // If tile is below answer slots, push it up
      if (tile.y + dragTileElem.offsetHeight > minSlotY - 4) {
        tile.y = Math.max(0, minSlotY - dragTileElem.offsetHeight - 4);
      }
    }
    savePages();
    renderWorkspace();
    dragging = false;
    draggingTileId = null;
    if (dragTileElem) dragTileElem.classList.remove('dragging');
    dragTileElem = null;
    window.removeEventListener('touchmove', move, {passive:false});
    window.removeEventListener('touchend', end);
  };
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('touchend', end);
}

// Initial load
loadPages();
renderPageList();
window.addEventListener('resize', () => {
  if (currentPageId) renderWorkspace();
});
// Prevent pinch/double-tap zoom
window.addEventListener('touchstart', function(e) {
  if (e.touches.length > 1) e.preventDefault();
}, {passive: false});
let lastTouch = 0;
window.addEventListener('touchend', function(e) {
  const now = Date.now();
  if (now - lastTouch < 350) e.preventDefault();
  lastTouch = now;
}, {passive: false});
window.addEventListener('dblclick', function(e) { e.preventDefault(); }, {passive: false});
