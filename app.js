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
  // Workspace
  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  workspace.style.height = 'calc(100dvh - 32vh)'; // dynamic viewport height
  workspace.style.overflow = 'hidden';
  // Tiles
  page.tiles.forEach(tile => {
    if (!tile.inAnswer) {
      const el = createTileElement(tile, page, workspace);
      workspace.appendChild(el);
    }
  });
  app.appendChild(workspace);
  // Answer bar
  const answerBar = document.createElement('div');
  answerBar.className = 'answer-bar';
  // Improved answer bar layout: fit as many as possible per row, break at separators
  const minSlot = 40;
  const barW = window.innerWidth - 16;
  let row = [];
  let rows = [];
  let curW = 0;
  for (let i = 0; i < page.answer.length; ++i) {
    // Estimate width: slot + (separator if present)
    let sepW = 0;
    if (i > 0 && page.separators[i-1]) sepW = 24;
    if (curW + minSlot + sepW > barW && row.length > 0) {
      rows.push(row);
      row = [];
      curW = 0;
    }
    row.push(i);
    curW += minSlot + sepW;
    // Prefer to break at separator
    if (i > 0 && page.separators[i-1] && row.length > 0) {
      rows.push(row);
      row = [];
      curW = 0;
    }
  }
  if (row.length) rows.push(row);
  rows.forEach((rowIdxs, r) => {
    rowIdxs.forEach((i, j) => {
      if (i > 0) {
        answerBar.appendChild(createSeparatorElement(page, i - 1));
      }
      const slot = document.createElement('div');
      slot.className = 'answer-slot' + (page.answer[i] ? ' filled' : '');
      slot.dataset.idx = i;
      slot.style.minWidth = minSlot + 'px';
      slot.style.minHeight = minSlot + 'px';
      if (page.answer[i]) {
        const tile = page.tiles.find(t => t.id === page.answer[i]);
        if (tile) slot.appendChild(createTileElement(tile, page, slot));
      }
      // Accept drag from workspace or other slots
      slot.ondragover = slot.ontouchmove = e => {
        e.preventDefault();
        slot.classList.add('filled');
      };
      slot.ondragleave = slot.ontouchend = e => {
        slot.classList.remove('filled');
      };
      slot.ondrop = e => {
        e.preventDefault();
        const tid = e.dataTransfer ? e.dataTransfer.getData('text/plain') : draggingTileId;
        moveTileToAnswer(page, tid, i);
      };
      slot.ontouchstart = e => {
        if (e.touches.length === 1 && slot.childNodes.length && !dragging) {
          startTileTouchDrag(e, page, page.answer[i], true, i);
        }
      };
      answerBar.appendChild(slot);
    });
    // Newline after each row except last
    if (r < rows.length - 1) {
      const br = document.createElement('div');
      br.style.flexBasis = '100%';
      br.style.height = '0';
      answerBar.appendChild(br);
    }
  });
  app.appendChild(answerBar);
  // Back button
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Anagrams';
  backBtn.style.margin = '1rem';
  backBtn.onclick = renderPageList;
  app.appendChild(backBtn);
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Pages';
  backBtn.style.margin = '1rem';
  backBtn.onclick = renderPageList;
  app.appendChild(backBtn);
}

function createTileElement(tile, page, parent) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.textContent = tile.letter;
  el.style.left = tile.x + 'px';
  el.style.top = tile.y + 'px';
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
  // Touch drag
  el.ontouchstart = e => {
    if (e.touches.length === 1) {
      startTileTouchDrag(e, page, tile.id, false);
    }
  };
  // Tap to edit
  el.onclick = e => {
    if (!dragging) showTileEdit(tile, page);
  };
  return el;
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
    // Constrain tile within workspace
    const workspace = document.querySelector('.workspace');
    const wsRect = workspace.getBoundingClientRect();
    let nx = t.clientX - dragOffset.x;
    let ny = t.clientY - dragOffset.y;
    // Clamp
    nx = Math.max(0, Math.min(nx, wsRect.width - 48));
    ny = Math.max(0, Math.min(ny, wsRect.height - 48));
    tile.x = nx;
    tile.y = ny;
    dragTileElem.style.left = nx + 'px';
    dragTileElem.style.top = ny + 'px';
    // Check overlap with answer bar slots
    const answerBar = document.querySelector('.answer-bar');
    if (answerBar) {
      const slots = answerBar.querySelectorAll('.answer-slot');
      slots.forEach(slot => {
        const slotRect = slot.getBoundingClientRect();
        if (
          t.clientX > slotRect.left && t.clientX < slotRect.right &&
          t.clientY > slotRect.top && t.clientY < slotRect.bottom
        ) {
          slot.classList.add('drag-over');
        } else {
          slot.classList.remove('drag-over');
        }
      });
    }
  };
  const end = ev => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    const answerBar = document.querySelector('.answer-bar');
    let dropped = false;
    if (answerBar) {
      const slots = answerBar.querySelectorAll('.answer-slot');
      slots.forEach((slot, idx) => {
        const slotRect = slot.getBoundingClientRect();
        if (
          t.clientX > slotRect.left && t.clientX < slotRect.right &&
          t.clientY > slotRect.top && t.clientY < slotRect.bottom
        ) {
          moveTileToAnswer(page, tileId, idx);
          dropped = true;
        }
        slot.classList.remove('drag-over');
      });
    }
    if (!dropped) {
      // If tile was in answer bar, move it back to workspace
      if (fromAnswer) {
        // Place at drop position, but clamp to workspace
        const workspace = document.querySelector('.workspace');
        const wsRect = workspace.getBoundingClientRect();
        let nx = t.clientX - wsRect.left - 24;
        let ny = t.clientY - wsRect.top - 24;
        nx = Math.max(0, Math.min(nx, wsRect.width - 48));
        ny = Math.max(0, Math.min(ny, wsRect.height - 48));
        moveTileToWorkspace(page, tileId, nx, ny);
      } else {
        // Save tile position
        savePages();
        renderWorkspace();
      }
    }
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
