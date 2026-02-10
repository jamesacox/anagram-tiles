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
  newBtn.textContent = 'New Puzzle';
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
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 30;
  input.placeholder = 'Enter letters (A-Z, spaces allowed)';
  input.style.marginBottom = '0.5rem';
  container.insertBefore(input, container.children[2]);
  input.focus();
  input.onkeydown = e => {
    if (e.key === 'Enter') {
      const val = input.value.toUpperCase().replace(/[^A-Z ]/g, '');
      if (val.replace(/ /g, '').length === 0) return;
      createPage(val);
    }
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
  workspace.style.height = '70vh';
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
  for (let i = 0; i < page.answer.length; ++i) {
    if (i > 0) {
      answerBar.appendChild(createSeparatorElement(page, i - 1));
    }
    const slot = document.createElement('div');
    slot.className = 'answer-slot' + (page.answer[i] ? ' filled' : '');
    slot.dataset.idx = i;
    if (page.answer[i]) {
      const tile = page.tiles.find(t => t.id === page.answer[i]);
      if (tile) slot.appendChild(createTileElement(tile, page, slot));
    }
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
      if (e.touches.length === 1 && slot.childNodes.length) {
        startTileTouchDrag(e, page, page.answer[i], true, i);
      }
    };
    answerBar.appendChild(slot);
  }
  app.appendChild(answerBar);
  // Back button
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
    page.answer[prevIdx] = swapId;
  }
  page.answer[idx] = tileId;
  page.tiles.forEach(t => {
    if (t.id === tileId) {
      t.inAnswer = true;
      t.answerIdx = idx;
    } else if (t.answerIdx === idx) {
      t.inAnswer = false;
      t.answerIdx = null;
    }
  });
  savePages();
  renderWorkspace();
}

// Touch drag logic
let dragging = false;
let draggingTileId = null;
let dragOffset = {x:0, y:0};
function startTileTouchDrag(e, page, tileId, fromAnswer, answerIdx) {
  dragging = true;
  draggingTileId = tileId;
  const tile = page.tiles.find(t => t.id === tileId);
  const touch = e.touches[0];
  dragOffset.x = touch.clientX - tile.x;
  dragOffset.y = touch.clientY - tile.y;
  const move = ev => {
    if (!dragging) return;
    const t = ev.touches[0];
    tile.x = t.clientX - dragOffset.x;
    tile.y = t.clientY - dragOffset.y;
    savePages();
    renderWorkspace();
  };
  const end = ev => {
    dragging = false;
    draggingTileId = null;
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', end);
  };
  window.addEventListener('touchmove', move);
  window.addEventListener('touchend', end);
}

// Initial load
loadPages();
renderPageList();
window.addEventListener('resize', () => {
  if (currentPageId) renderWorkspace();
});
