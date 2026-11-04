/**
 * Virtual Cryptography Laboratory
 * Experiment: Rail Fence (Keyless) & Columnar (Keyed) Transposition Cipher
 * Permutation-Based Encryption & Decryption Simulation Engine
 */

// Global State
const state = {
  activeTab: 'aim',
  simCipher: 'rf', // 'rf' or 'col'
  
  // Rail Fence State
  rf: {
    mode: 'encrypt', // 'encrypt' or 'decrypt'
    rails: 3,
    input: 'HELLOWORLD',
    output: '',
    steps: [],
    currentStep: -1,
    isPlaying: false,
    timer: null,
    speed: 600,
    permMap: []
  },

  // Columnar State
  col: {
    mode: 'encrypt',
    key: 'ZEBRA',
    input: 'ATTACKATDAWN',
    output: '',
    steps: [],
    currentStep: -1,
    isPlaying: false,
    timer: null,
    speed: 600,
    permMap: [],
    paddingCount: 0,
    paddingByCipher: new Map(),
    paddingOverride: false
  }
};

// Utilities
const clean = s => s ? s.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

const railColors = [
  'var(--rail-0)', 'var(--rail-1)', 'var(--rail-2)', 
  'var(--rail-3)', 'var(--rail-4)', 'var(--rail-5)', 
  'var(--rail-6)', 'var(--rail-7)', 'var(--rail-8)', 'var(--rail-9)'
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initControls();
  initNavigation();
  initSimSubTabs();
  initRailFence();
  initColumnar();
  initTestCases();
  initQuiz();
  initViva();

  // Initial render
  runRfSimulation();
  runColSimulation();
});

// --- LAB CONTROLS ---
function initControls() {
  const resetBtn = document.getElementById('resetLabBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('rfInput').value = 'HELLOWORLD';
      document.getElementById('rfRailsSlider').value = 3;
      document.getElementById('colInput').value = 'ATTACKATDAWN';
      document.getElementById('colKeyInput').value = 'ZEBRA';
      runRfSimulation();
      runColSimulation();
    });
  }
}

// --- TAB NAVIGATION ---
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  let activeText = '';
  document.querySelectorAll('.nav-btn').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
    if (isActive) activeText = b.textContent.trim();
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tabId);
  });
  const breadcrumb = document.getElementById('activeBreadcrumb');
  if (breadcrumb && activeText) breadcrumb.textContent = activeText;
}

// --- SIMULATOR SUB TABS ---
function initSimSubTabs() {
  const rfBtn = document.getElementById('simTabRfBtn');
  const colBtn = document.getElementById('simTabColBtn');
  const rfPanel = document.getElementById('simRfPanel');
  const colPanel = document.getElementById('simColPanel');

  rfBtn.addEventListener('click', () => {
    state.simCipher = 'rf';
    rfBtn.classList.add('active');
    colBtn.classList.remove('active');
    rfPanel.style.display = 'block';
    colPanel.style.display = 'none';
  });

  colBtn.addEventListener('click', () => {
    state.simCipher = 'col';
    colBtn.classList.add('active');
    rfBtn.classList.remove('active');
    colPanel.style.display = 'block';
    rfPanel.style.display = 'none';
  });
}

// ==========================================
// 1. RAIL FENCE CIPHER ENGINE & CONTROLLER
// ==========================================

function getRailPattern(len, rails) {
  if (rails <= 1) return Array(len).fill(0);
  const pat = [];
  let row = 0, dir = 1;
  for (let i = 0; i < len; i++) {
    pat.push(row);
    if (row === 0) dir = 1;
    else if (row === rails - 1) dir = -1;
    row += dir;
  }
  return pat;
}

function computeRfEncrypt(text, rails) {
  const s = clean(text);
  if (!s) return { cipher: '', map: [], pat: [], steps: [] };
  const r = Math.min(Math.max(2, rails), s.length);
  const pat = getRailPattern(s.length, r);
  
  const rows = Array.from({ length: r }, () => []);
  const steps = [];

  // Phase 1: Write into zig-zag
  for (let i = 0; i < s.length; i++) {
    const row = pat[i];
    rows[row].push({ char: s[i], origIdx: i, col: i, row });
    steps.push({
      phase: 'write',
      index: i,
      char: s[i],
      row,
      col: i,
      accumulated: '',
      narrative: `Phase 1 (Writing Zig-Zag): Place character '${s[i]}' (input pos ${i}) into Row ${row + 1}, Col ${i}.`
    });
  }

  // Phase 2: Read row by row
  let cipher = '';
  const map = [];
  let cipherIdx = 0;
  for (let row = 0; row < r; row++) {
    for (let item of rows[row]) {
      cipher += item.char;
      map[item.origIdx] = cipherIdx;
      steps.push({
        phase: 'read',
        char: item.char,
        row,
        col: item.col,
        origIdx: item.origIdx,
        cipherIdx,
        accumulated: cipher,
        narrative: `Phase 2 (Reading Rows): Collecting from Row ${row + 1}: appended '${item.char}' (maps input ${item.origIdx} → cipher ${cipherIdx}).`
      });
      cipherIdx++;
    }
  }

  return { cipher, map, pat, rows, steps };
}

function computeRfDecrypt(cipherText, rails) {
  const c = clean(cipherText);
  if (!c) return { plain: '', map: [], pat: [], steps: [] };
  const r = Math.min(Math.max(2, rails), c.length);
  const pat = getRailPattern(c.length, r);
  
  const counts = Array(r).fill(0);
  pat.forEach(row => counts[row]++);

  const rowChars = [];
  let p = 0;
  for (let row = 0; row < r; row++) {
    rowChars.push(c.slice(p, p + counts[row]).split(''));
    p += counts[row];
  }

  const steps = [];
  // Phase 1: Allocate slots
  steps.push({
    phase: 'setup',
    narrative: `Determined rail pattern: ${counts.map((n, i) => `Row ${i+1}: ${n} slots`).join(', ')}.`
  });

  const used = Array(r).fill(0);
  let plain = '';
  const map = []; // cipher pos -> plain pos
  const rows = Array.from({ length: r }, () => []);

  // Compute inverse
  for (let i = 0; i < c.length; i++) {
    const row = pat[i];
    const ch = rowChars[row][used[row]++];
    plain += ch;
    rows[row].push({ char: ch, row, col: i, plainIdx: i });
    steps.push({
      phase: 'reconstruct',
      char: ch,
      row,
      col: i,
      plainIdx: i,
      accumulated: plain,
      narrative: `Decryption: Placed '${ch}' at Row ${row + 1}, Col ${i} along the zig-zag path.`
    });
  }

  return { plain, map, pat, rows, steps };
}

function initRailFence() {
  const inputEl = document.getElementById('rfInput');
  const sliderEl = document.getElementById('rfRailsSlider');
  const valEl = document.getElementById('rfRailsVal');
  const cycleEl = document.getElementById('rfCycleInfo');
  const countEl = document.getElementById('rfCharCount');

  const updateRails = () => {
    const r = parseInt(sliderEl.value, 10);
    valEl.textContent = r;
    cycleEl.textContent = `T = 2(${r}-1) = ${2 * (r - 1)} chars`;
    state.rf.rails = r;
    runRfSimulation();
  };

  sliderEl.addEventListener('input', updateRails);

  inputEl.addEventListener('input', () => {
    const s = clean(inputEl.value);
    countEl.textContent = `${s.length} chars`;
    runRfSimulation();
  });

  document.getElementById('rfEncryptBtn').addEventListener('click', () => {
    state.rf.mode = 'encrypt';
    document.getElementById('rfVizModeTag').textContent = 'Encryption (Zig-Zag Write → Row Read)';
    runRfSimulation();
  });

  document.getElementById('rfDecryptBtn').addEventListener('click', () => {
    state.rf.mode = 'decrypt';
    document.getElementById('rfVizModeTag').textContent = 'Decryption (Reconstructing Zig-Zag from Rows)';
    runRfSimulation();
  });

  document.getElementById('rfClearBtn').addEventListener('click', () => {
    inputEl.value = '';
    countEl.textContent = '0 chars';
    runRfSimulation();
  });

  document.getElementById('rfCopyBtn').addEventListener('click', () => {
    if (state.rf.output) {
      navigator.clipboard.writeText(state.rf.output);
      const btn = document.getElementById('rfCopyBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => btn.innerHTML = orig, 1500);
    }
  });

  // Playback Buttons
  document.getElementById('rfPlayBtn').addEventListener('click', toggleRfPlay);
  document.getElementById('rfStepFwdBtn').addEventListener('click', () => stepRf(1));
  document.getElementById('rfStepBackBtn').addEventListener('click', () => stepRf(-1));
  document.getElementById('rfResetStepBtn').addEventListener('click', () => resetRfSteps());
  document.getElementById('rfSpeedSlider').addEventListener('input', e => {
    state.rf.speed = 1700 - parseInt(e.target.value, 10);
  });
}

function runRfSimulation() {
  const text = document.getElementById('rfInput').value;
  const s = clean(text);
  const r = state.rf.rails;

  if (!s) {
    document.getElementById('rfOutputBox').textContent = 'Please enter input text';
    document.getElementById('rfRailContainer').innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">Enter a message above to generate the zig-zag visualization.</div>';
    document.getElementById('rfPermQuickBadges').innerHTML = '';
    state.rf.output = '';
    state.rf.steps = [];
    return;
  }

  resetRfSteps();

  let res;
  if (state.rf.mode === 'encrypt') {
    res = computeRfEncrypt(s, r);
    state.rf.output = res.cipher;
    state.rf.permMap = res.map;
  } else {
    res = computeRfDecrypt(s, r);
    state.rf.output = res.plain;
    state.rf.permMap = res.map;
  }

  document.getElementById('rfOutputBox').textContent = state.rf.output;
  state.rf.steps = res.steps;

  renderRfRailView(s, r, res.pat);
  renderRfPermBadges(res.map, s);
}

function renderRfRailView(s, r, pat) {
  const container = document.getElementById('rfRailContainer');
  container.innerHTML = '';

  const actualRails = Math.min(r, s.length);

  for (let row = 0; row < actualRails; row++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'rail-row';

    const header = document.createElement('div');
    header.className = 'rail-header';
    header.innerHTML = `<span class="rail-header-dot" style="background:${railColors[row % railColors.length]}"></span> Row ${row + 1}`;
    rowDiv.appendChild(header);

    const track = document.createElement('div');
    track.className = 'rail-track';

    for (let col = 0; col < s.length; col++) {
      const slot = document.createElement('div');
      slot.className = 'char-slot';
      slot.id = `rf-slot-${row}-${col}`;
      
      const isRailChar = pat[col] === row;
      if (isRailChar) {
        slot.classList.add('filled');
        slot.style.borderColor = railColors[row % railColors.length];
        slot.textContent = s[col];
        slot.innerHTML = `<span class="slot-index">${col}</span>${s[col]}`;
        slot.title = `Position ${col}: '${s[col]}' on Row ${row + 1}`;
        
        // Hover linking
        slot.addEventListener('mouseenter', () => highlightRfPosition(col));
        slot.addEventListener('mouseleave', () => unhighlightRfPosition());
      } else {
        slot.classList.add('empty');
        slot.innerHTML = `&middot;`;
      }
      track.appendChild(slot);
    }
    rowDiv.appendChild(track);
    container.appendChild(rowDiv);
  }
}

function renderRfPermBadges(map, s) {
  const box = document.getElementById('rfPermQuickBadges');
  if (!map || map.length === 0) {
    box.innerHTML = '';
    return;
  }
  let html = '';
  for (let i = 0; i < Math.min(s.length, 16); i++) {
    html += `<span class="tag-btn" style="cursor:default;" title="P[${i}] '${s[i]}' → C[${map[i]}]">${i} → ${map[i]}</span>`;
  }
  if (s.length > 16) {
    html += `<span style="font-size:0.75rem; color:var(--text-muted); align-self:center;">+${s.length - 16} more (see Explorer)</span>`;
  }
  box.innerHTML = html;
}

function highlightRfPosition(pos) {
  document.querySelectorAll('.char-slot.filled').forEach(slot => {
    if (slot.querySelector('.slot-index') && parseInt(slot.querySelector('.slot-index').textContent, 10) === pos) {
      slot.classList.add('highlighted');
    }
  });
}

function unhighlightRfPosition() {
  document.querySelectorAll('.char-slot.highlighted').forEach(s => s.classList.remove('highlighted'));
}

// Rail Fence Stepper Controls
function resetRfSteps() {
  pauseRf();
  state.rf.currentStep = -1;
  document.querySelectorAll('#rfRailContainer .char-slot').forEach(s => s.classList.remove('active-step'));
  document.getElementById('rfNarratorText').textContent = 'Ready. Click Play or Step Forward to trace execution.';
}

function toggleRfPlay() {
  if (state.rf.isPlaying) {
    pauseRf();
  } else {
    playRf();
  }
}

const playIconHtml = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
const pauseIconHtml = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';

function playRf() {
  state.rf.isPlaying = true;
  document.getElementById('rfPlayIcon').innerHTML = pauseIconHtml;
  if (state.rf.currentStep >= state.rf.steps.length - 1) {
    state.rf.currentStep = -1;
  }
  advanceRfStep();
}

function pauseRf() {
  state.rf.isPlaying = false;
  document.getElementById('rfPlayIcon').innerHTML = playIconHtml;
  if (state.rf.timer) clearTimeout(state.rf.timer);
}

function advanceRfStep() {
  if (!state.rf.isPlaying) return;
  if (state.rf.currentStep < state.rf.steps.length - 1) {
    stepRf(1);
    state.rf.timer = setTimeout(advanceRfStep, state.rf.speed);
  } else {
    pauseRf();
    document.getElementById('rfNarratorText').textContent = 'Traversal complete! Full ciphertext produced.';
  }
}

function stepRf(dir) {
  const steps = state.rf.steps;
  if (!steps || steps.length === 0) return;

  const newStep = state.rf.currentStep + dir;
  if (newStep < 0 || newStep >= steps.length) return;

  state.rf.currentStep = newStep;
  const current = steps[newStep];

  // Update narrator
  document.getElementById('rfNarratorText').textContent = current.narrative;

  // Clear previous active slot highlights
  document.querySelectorAll('#rfRailContainer .char-slot').forEach(s => s.classList.remove('active-step'));

  if (current.row !== undefined && current.col !== undefined) {
    const slot = document.getElementById(`rf-slot-${current.row}-${current.col}`);
    if (slot) {
      slot.classList.add('active-step');
      slot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }
}


// ==========================================
// 2. COLUMNAR TRANSPOSITION ENGINE & CONTROLLER
// ==========================================

function normalizeColumnarKey(key) {
  // This lab uses a deduplicated keyword: keep the first occurrence of each letter.
  // Example: BALLOON becomes BALON.
  const cleaned = clean(key);
  return [...new Set(cleaned)].join('');
}

function getKeyOrder(key) {
  const k = normalizeColumnarKey(key);
  const indexed = [...k].map((char, origCol) => ({ char, origCol }));
  indexed.sort((a, b) => a.char.localeCompare(b.char) || a.origCol - b.origCol);

  const ranks = Array(k.length);
  indexed.forEach((item, rank) => { ranks[item.origCol] = rank + 1; });
  return { ranks, readColOrder: indexed.map(item => item.origCol) };
}

function computeColEncrypt(text, key) {
  const s = clean(text);
  const k = normalizeColumnarKey(key);
  if (!s || !k) return { cipher: '', map: [], grid: [], steps: [], ranks: [], readColOrder: [] };

  const numCols = k.length;
  const numRows = Math.ceil(s.length / numCols);
  const { ranks, readColOrder } = getKeyOrder(k);
  const grid = Array.from({ length: numRows }, () => Array(numCols).fill(null));
  const steps = [];

  // Write each plaintext character exactly once, row by row. No dummy padding is added.
  for (let i = 0; i < s.length; i++) {
    const row = Math.floor(i / numCols);
    const col = i % numCols;
    const char = s[i];
    grid[row][col] = { char, origIdx: i, row, col, isPadding: false };
    steps.push({
      phase: 'write', row, col, char, origIdx: i,
      narrative: `Writing plaintext: placed '${char}' (character ${i + 1}) in Row ${row + 1}, Column ${col + 1}.`
    });
  }

  let cipher = '';
  const map = [];
  let cipherIdx = 0;
  for (const col of readColOrder) {
    for (let row = 0; row < numRows; row++) {
      const cell = grid[row][col];
      if (!cell) continue;
      cipher += cell.char;
      map[cell.origIdx] = cipherIdx;
      steps.push({
        phase: 'read', row, col, char: cell.char, colRank: ranks[col],
        origIdx: cell.origIdx, cipherIdx, accumulated: cipher,
        narrative: `Reading ciphertext: Rank ${ranks[col]}, Column ${col + 1} ('${k[col]}') gives '${cell.char}'.`
      });
      cipherIdx++;
    }
  }
  return { cipher, map, grid, ranks, readColOrder, steps, paddingCount: 0, originalLength: s.length };
}

function computeColDecrypt(cipherText, key) {
  const cipher = clean(cipherText);
  const k = normalizeColumnarKey(key);
  if (!cipher || !k) return { plain: '', map: [], grid: [], steps: [], ranks: [], readColOrder: [] };

  const numCols = k.length;
  const numRows = Math.ceil(cipher.length / numCols);
  const baseLength = Math.floor(cipher.length / numCols);
  const extra = cipher.length % numCols;
  const colLengths = Array.from({ length: numCols }, (_, col) => baseLength + (col < extra ? 1 : 0));
  const { ranks, readColOrder } = getKeyOrder(k);
  const columns = Array.from({ length: numCols }, () => []);
  const steps = [{
    phase: 'setup',
    narrative: `The ciphertext has ${cipher.length} characters. Reconstructing a ${numRows}-row grid with ${numCols} columns; shorter columns occur at the right of the original final row.`
  }];

  let cursor = 0;
  for (const col of readColOrder) {
    const length = colLengths[col];
    const slice = cipher.slice(cursor, cursor + length);
    columns[col] = slice.split('');
    steps.push({
      phase: 'allocate', col, keyChar: k[col], rank: ranks[col], chars: slice,
      narrative: `Rank ${ranks[col]}: place ciphertext segment '${slice}' into Column ${col + 1} ('${k[col]}').`
    });
    for (let row = 0; row < slice.length; row++) {
      steps.push({
        phase: 'allocate', row, col, char: slice[row],
        narrative: `Placed '${slice[row]}' in Row ${row + 1}, Column ${col + 1} while reconstructing the grid.`
      });
    }
    cursor += length;
  }

  const grid = Array.from({ length: numRows }, () => Array(numCols).fill(null));
  let plain = '';
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const char = columns[col][row];
      if (char === undefined) continue;
      grid[row][col] = { char, row, col, isPadding: false };
      plain += char;
      steps.push({
        phase: 'reconstruct', row, col, char,
        narrative: `Read Row ${row + 1}, Column ${col + 1}: recovered '${char}' in the plaintext order.`
      });
    }
  }
  steps.push({ phase: 'finish', narrative: 'Decryption complete. Every ciphertext character has been used exactly once.' });
  return { plain, map: [], grid, ranks, readColOrder, steps, paddingCount: 0 };
}

function initColumnar() {
  const inputEl = document.getElementById('colInput');
  const keyEl = document.getElementById('colKeyInput');
  const countEl = document.getElementById('colCharCount');
  const keyLenEl = document.getElementById('colKeyLength');

  const updateCol = () => {
    const s = clean(inputEl.value);
    const k = normalizeColumnarKey(keyEl.value);
    keyEl.value = k;
    countEl.textContent = `${s.length} chars`;
    keyLenEl.textContent = `Length: ${k.length}`;
    state.col.key = k;
    renderKeyChips(k);
    runColSimulation();
  };

  inputEl.addEventListener('input', updateCol);
  keyEl.addEventListener('input', updateCol);

  // Quick preset tags
  document.querySelectorAll('.quick-tags .tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      keyEl.value = btn.dataset.key;
      updateCol();
    });
  });

  document.getElementById('colEncryptBtn').addEventListener('click', () => {
    state.col.mode = 'encrypt';
    document.getElementById('colVizModeTag').textContent = 'Encryption (Row Write → Ranked Column Read)';
    runColSimulation();
  });

  document.getElementById('colDecryptBtn').addEventListener('click', () => {
    state.col.mode = 'decrypt';
    document.getElementById('colVizModeTag').textContent = 'Decryption (Ranked Column Reconstruction → Row Read)';
    runColSimulation();
  });

  document.getElementById('colClearBtn').addEventListener('click', () => {
    inputEl.value = '';
    countEl.textContent = '0 chars';
    runColSimulation();
  });

  document.getElementById('colCopyBtn').addEventListener('click', () => {
    if (state.col.output) {
      navigator.clipboard.writeText(state.col.output);
      const btn = document.getElementById('colCopyBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => btn.innerHTML = orig, 1500);
    }
  });

  // Playback Buttons
  document.getElementById('colPlayBtn').addEventListener('click', toggleColPlay);
  document.getElementById('colStepFwdBtn').addEventListener('click', () => stepCol(1));
  document.getElementById('colStepBackBtn').addEventListener('click', () => stepCol(-1));
  document.getElementById('colResetStepBtn').addEventListener('click', () => resetColSteps());
  document.getElementById('colSpeedSlider').addEventListener('input', e => {
    state.col.speed = 1700 - parseInt(e.target.value, 10);
  });
}

function renderKeyChips(key) {
  const container = document.getElementById('colKeyChipsRow');
  container.innerHTML = '';
  if (!key) return;

  const normalizedKey = normalizeColumnarKey(key);
  const { ranks } = getKeyOrder(normalizedKey);
  [...normalizedKey].forEach((ch, idx) => {
    const chip = document.createElement('div');
    chip.className = 'key-chip';
    chip.id = `key-chip-${idx}`;
    chip.innerHTML = `<span class="char">${ch}</span><span class="rank">#${ranks[idx]}</span>`;
    container.appendChild(chip);
  });
}

function runColSimulation() {
  const text = document.getElementById('colInput').value;
  const key = document.getElementById('colKeyInput').value;
  const s = clean(text);
  const k = normalizeColumnarKey(key);
  const keyInput = document.getElementById('colKeyInput');
  if (keyInput && keyInput.value !== k) keyInput.value = k;

  if (!s || !k) {
    document.getElementById('colOutputBox').textContent = !k ? 'Enter keyword' : 'Enter input text';
    document.getElementById('colMatrixWrapper').innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">Enter message and keyword to generate matrix.</div>';
    document.getElementById('colPermQuickBadges').innerHTML = '';
    state.col.output = '';
    state.col.steps = [];
    state.col.paddingCount = 0;
    return;
  }

  resetColSteps();

  let res;
  if (state.col.mode === 'encrypt') {
    res = computeColEncrypt(s, k);
    state.col.output = res.cipher;
    state.col.permMap = res.map;
    state.col.paddingCount = 0;
  } else {
    res = computeColDecrypt(s, k);
    state.col.output = res.plain;
    state.col.permMap = res.map;
    state.col.paddingCount = res.paddingCount;
  }

  document.getElementById('colOutputBox').textContent = state.col.output;
  state.col.steps = res.steps;

  renderColMatrix(res.grid, k, res.ranks);
  renderColPermBadges(res.readColOrder, res.ranks, k);
}

function renderColMatrix(grid, key, ranks) {
  key = normalizeColumnarKey(key);
  const wrapper = document.getElementById('colMatrixWrapper');
  wrapper.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'col-matrix';

  // Table Header (Keyword letters & ranks)
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [...key].forEach((ch, idx) => {
    const th = document.createElement('th');
    th.className = 'col-th';
    th.id = `col-th-${idx}`;
    th.innerHTML = `
      <span class="key-letter">${ch}</span>
      <span class="key-rank-badge">#${ranks[idx]}</span>
    `;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Table Body (Grid contents)
  const tbody = document.createElement('tbody');
  grid.forEach((row, r) => {
    const tr = document.createElement('tr');
    row.forEach((cell, c) => {
      const td = document.createElement('td');
      td.id = `col-cell-${r}-${c}`;
      if (cell && cell.char) {
        td.className = cell.isPadding ? 'padding-cell' : '';
        td.innerHTML = `<span class="cell-idx">${cell.origIdx !== undefined ? cell.origIdx : ''}</span>${cell.char}`;
        td.title = cell.isPadding
          ? `Row ${r + 1}, Col ${c + 1} (${key[c]}): dummy padding 'X'`
          : `Row ${r + 1}, Col ${c + 1} (${key[c]}): '${cell.char}'`;
      } else {
        td.className = 'empty-cell';
        td.innerHTML = '&mdash;';
        td.title = 'Empty cell';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
}

function renderColPermBadges(readColOrder, ranks, key) {
  key = normalizeColumnarKey(key);
  const box = document.getElementById('colPermQuickBadges');
  if (!readColOrder) {
    box.innerHTML = '';
    return;
  }
  let html = '';
  readColOrder.forEach((colIdx, orderIdx) => {
    html += `<span class="tag-btn" style="cursor:default;">Rank ${orderIdx + 1} → Col ${colIdx + 1} ('${key[colIdx]}')</span>`;
  });
  box.innerHTML = html;
}

// Columnar Stepper Controls
function resetColSteps() {
  pauseCol();
  state.col.currentStep = -1;
  document.querySelectorAll('#colMatrixWrapper td').forEach(td => td.classList.remove('active-cell', 'active-col-cell'));
  document.querySelectorAll('.key-chip').forEach(ch => ch.classList.remove('active-col'));
  document.getElementById('colNarratorText').textContent = 'Ready. Click Play or Step Forward to trace execution.';
}

function toggleColPlay() {
  if (state.col.isPlaying) {
    pauseCol();
  } else {
    playCol();
  }
}

function playCol() {
  state.col.isPlaying = true;
  document.getElementById('colPlayIcon').innerHTML = pauseIconHtml;
  if (state.col.currentStep >= state.col.steps.length - 1) {
    state.col.currentStep = -1;
  }
  advanceColStep();
}

function pauseCol() {
  state.col.isPlaying = false;
  document.getElementById('colPlayIcon').innerHTML = playIconHtml;
  if (state.col.timer) {
    clearTimeout(state.col.timer);
    state.col.timer = null;
  }
}

function advanceColStep() {
  if (!state.col.isPlaying) return;
  if (state.col.currentStep < state.col.steps.length - 1) {
    stepCol(1);
    state.col.timer = setTimeout(advanceColStep, state.col.speed);
  } else {
    pauseCol();
    document.getElementById('colNarratorText').textContent = 'Columnar playback complete.';
  }
}

function stepCol(dir) {
  const steps = state.col.steps;
  if (!steps || steps.length === 0) return;

  const newStep = state.col.currentStep + dir;
  if (newStep < 0 || newStep >= steps.length) return;

  state.col.currentStep = newStep;
  const current = steps[newStep];

  // Update narrator
  document.getElementById('colNarratorText').textContent = current.narrative;

  // Clear previous cell and chip highlights
  document.querySelectorAll('#colMatrixWrapper td').forEach(td => td.classList.remove('active-cell', 'active-col-cell'));
  document.querySelectorAll('.key-chip').forEach(ch => ch.classList.remove('active-col'));

  if (current.col !== undefined) {
    const chip = document.getElementById(`key-chip-${current.col}`);
    if (chip) chip.classList.add('active-col');

    if (current.phase === 'read') {
      // Highlight entire column
      document.querySelectorAll(`[id^="col-cell-"][id$="-${current.col}"]`).forEach(td => {
        td.classList.add('active-col-cell');
      });
    }

    if (current.row !== undefined) {
      const cell = document.getElementById(`col-cell-${current.row}-${current.col}`);
      if (cell) {
        cell.classList.add('active-cell');
        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }
}


// ==========================================
// 3. BENCHMARK TEST CASES MODULE
// ==========================================

const testCasesData = [
  {
    cipher: 'rf',
    title: 'Rail Fence (2 Rails)',
    input: 'HELLOWORLD',
    param: 2,
    paramLabel: '2 Rows',
    expected: 'HLOOLELWRD',
    desc: 'Standard keyless zig-zag benchmark. Odd/even split.'
  },
  {
    cipher: 'rf',
    title: 'Rail Fence (3 Rails)',
    input: 'HELLOWORLD',
    param: 3,
    paramLabel: '3 Rows',
    expected: 'HOLELWRDLO',
    desc: 'Classic 3-row bounce. Cycle period T = 2(3-1) = 4.'
  },
  {
    cipher: 'rf',
    title: 'Rail Fence (4 Rails)',
    input: 'DEFENDTHEEASTWALL',
    param: 4,
    paramLabel: '4 Rows',
    expected: 'DTAEETWFNDHLSEEA',
    desc: 'Military classic with 4 horizontal rails.'
  },
  {
    cipher: 'col',
    title: 'Columnar (Uneven Final Row)',
    input: 'ATTACKATDAWN',
    param: 'ZEBRA',
    paramLabel: 'Key: ZEBRA',
    expected: 'CATTTANADAKW',
    desc: 'The final row is incomplete; no dummy characters are added.'
  },
  {
    cipher: 'col',
    title: 'Columnar (German Fleet)',
    input: 'DEFENDTHEEASTWALLOFCASTLE',
    param: 'GERMAN',
    paramLabel: 'Key: GERMAN',
    expected: 'NALTEHWCDTTFEEELSDSOLFEAA',
    desc: 'The final row is incomplete; decryption uses the original column lengths.'
  },
  {
    cipher: 'col',
    title: 'Columnar (Duplicate Keys)',
    input: 'CRYPTOGRAPHYLABORATORY',
    param: 'BALLOON',
    paramLabel: 'Key: BALLOON',
    expected: 'RGYRYCOHORYRLATPBOPAAT',
    desc: 'BALLOON is reduced to BALON by retaining the first occurrence of each keyword letter.'
  }
];

function initTestCases() {
  const container = document.getElementById('testCasesContainer');
  container.innerHTML = '';

  testCasesData.forEach((tc, idx) => {
    const card = document.createElement('div');
    card.className = 'test-case-card';
    card.innerHTML = `
      <div>
        <div class="test-case-header">
          <span class="badge-tag">${tc.cipher === 'rf' ? 'Rail Fence' : 'Columnar'}</span>
          <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">${tc.paramLabel}</span>
        </div>
        <h3 style="font-size:1.05rem; margin-bottom:8px;">${tc.title}</h3>
        <div class="test-case-body">
          <strong>Input:</strong> ${tc.input}<br>
          <strong>Expected:</strong> <span style="color:var(--accent-emerald);">${tc.expected}</span><br>
          <small style="color:var(--text-muted);">${tc.desc}</small>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="width:100%; justify-content:center; margin-top: 12px;" onclick="loadTestCase(${idx})">
        Load Simulation
      </button>
    `;
    container.appendChild(card);
  });
}

window.loadTestCase = function(idx) {
  const tc = testCasesData[idx];
  switchTab('simulation');

  if (tc.cipher === 'rf') {
    document.getElementById('simTabRfBtn').click();
    document.getElementById('rfInput').value = tc.input;
    document.getElementById('rfRailsSlider').value = tc.param;
    document.getElementById('rfRailsVal').textContent = tc.param;
    state.rf.rails = tc.param;
    state.rf.mode = 'encrypt';
    runRfSimulation();
  } else {
    document.getElementById('simTabColBtn').click();
    document.getElementById('colInput').value = tc.input;
    document.getElementById('colKeyInput').value = tc.param;
    state.col.key = tc.param;
    state.col.mode = 'encrypt';
    renderKeyChips(tc.param);
    runColSimulation();
  }
};


// ==========================================
// 5. INTERACTIVE SELF-ASSESSMENT QUIZ
// ==========================================

const quizQuestions = [
  {
    q: 'What is the fundamental difference between a Substitution cipher and a Transposition cipher?',
    opts: [
      'Substitution replaces characters; Transposition rearranges character positions.',
      'Substitution uses keys; Transposition is strictly keyless.',
      'Transposition changes the alphabet size, while substitution does not.',
      'Substitution is impossible to break; Transposition is easily broken.'
    ],
    ans: 0,
    exp: 'In substitution ciphers (e.g. Caesar, Vigenère), symbols are replaced with other symbols. In transposition ciphers, symbol values remain identical, but their position permutation is altered.'
  },
  {
    q: 'For a Rail Fence cipher with r rows (rails), what is the period of one complete zig-zag oscillation cycle?',
    opts: [
      'r',
      '2r',
      '2(r - 1)',
      'r^2'
    ],
    ans: 2,
    exp: 'Starting at row 0, the trajectory descends through r - 1 steps to row r - 1, and ascends through r - 1 steps back to row 0. Thus the full period is 2(r - 1).'
  },
  {
    q: 'In this lab, what happens when a Columnar keyword contains repeated letters (e.g. "BALLOON")?',
    opts: [
      'Only the first occurrence of each letter is retained, so BALLOON becomes BALON.',
      'Every repeated letter creates another column.',
      'Repeated letters are randomly rearranged.',
      'The keyword is rejected.'
    ],
    ans: 0,
    exp: 'This simulator uses a deduplicated-key variation: it keeps the first occurrence of each letter. Thus BALLOON becomes BALON and the matrix has five keyword columns.'
  },
  {
    q: 'How does letter frequency analysis behave against a pure Transposition cipher?',
    opts: [
      'Letter frequencies are flattened into a uniform distribution.',
      'Letter frequencies are preserved and match natural plaintext frequencies.',
      'Vowel frequencies are eliminated.',
      'Letter frequencies are shifted by the key length modulo 26.'
    ],
    ans: 1,
    exp: 'Because transposition merely permutes symbol positions without substituting any characters, unigram frequency counts (e.g. high frequency of E, T, A) remain completely unchanged.'
  },
  {
    q: 'When the message length is not divisible by the keyword length, how does this lab handle the final row?',
    opts: [
      'It adds dummy X characters.',
      'It leaves unused cells blank and decrypts using the correct column lengths.',
      'It deletes the final row.',
      'It repeats the last plaintext character.'
    ],
    ans: 1,
    exp: 'No padding is added. The final row may be incomplete, and decryption calculates the original length of each column so every ciphertext character is used exactly once.'
  },
  {
    q: 'Mathematically, why is decryption of any transposition cipher guaranteed if the permutation π is known?',
    opts: [
      'Because every transposition mapping π is a bijection, and every bijection has a unique inverse function π⁻¹.',
      'Because transposition relies on prime factorization.',
      'Because matrix multiplication is commutative.',
      'Because character ASCII codes are reversible.'
    ],
    ans: 0,
    exp: 'A transposition permutation π is a one-to-one and onto (bijective) mapping on indices {0..n-1}. Every finite bijection has an exact unique inverse π⁻¹ that restores the original order.'
  },
  {
    q: 'What is the ciphertext when "HELLOWORLD" is encrypted with Rail Fence using 2 rails?',
    opts: [
      'HLOOLELWRD',
      'HOLELWRDLO',
      'DLROWOLLEH',
      'HLEOWLRDLO'
    ],
    ans: 0,
    exp: 'With 2 rails: Row 1 gets indices 0, 2, 4, 6, 8 (H, L, O, O, L) and Row 2 gets indices 1, 3, 5, 7, 9 (E, L, W, R, D). Concatenating gives HLOOLELWRD.'
  }
];

function initQuiz() {
  const container = document.getElementById('quizContainer');
  container.innerHTML = '';

  quizQuestions.forEach((item, qIdx) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'quiz-item';
    qDiv.innerHTML = `
      <div class="quiz-question">
        <span>Q${qIdx + 1}.</span>
        <span>${item.q}</span>
      </div>
      <div class="quiz-options">
        ${item.opts.map((opt, oIdx) => `
          <label class="quiz-option-label" id="opt-label-${qIdx}-${oIdx}">
            <input type="radio" name="q_${qIdx}" value="${oIdx}">
            <span>${opt}</span>
          </label>
        `).join('')}
      </div>
      <div class="quiz-explanation" id="quiz-exp-${qIdx}">
        <strong>Explanation:</strong> ${item.exp}
      </div>
    `;
    container.appendChild(qDiv);
  });

  document.getElementById('submitQuizBtn').addEventListener('click', gradeQuiz);
  document.getElementById('resetQuizBtn').addEventListener('click', resetQuiz);
}

function gradeQuiz() {
  let score = 0;
  quizQuestions.forEach((item, qIdx) => {
    const selected = document.querySelector(`input[name="q_${qIdx}"]:checked`);
    const expEl = document.getElementById(`quiz-exp-${qIdx}`);
    expEl.style.display = 'block';

    const userVal = selected ? parseInt(selected.value, 10) : -1;
    if (userVal === item.ans) {
      score++;
    }

    item.opts.forEach((_, oIdx) => {
      const label = document.getElementById(`opt-label-${qIdx}-${oIdx}`);
      label.classList.remove('correct', 'wrong');
      if (oIdx === item.ans) {
        label.classList.add('correct');
      } else if (userVal === oIdx && userVal !== item.ans) {
        label.classList.add('wrong');
      }
      label.querySelector('input').disabled = true;
    });
  });

  const display = document.getElementById('quizScoreDisplay');
  const percent = Math.round((score / quizQuestions.length) * 100);
  display.innerHTML = `Score: <span style="color:var(--accent-cyan);">${score} / ${quizQuestions.length}</span> (${percent}%)`;
}

function resetQuiz() {
  quizQuestions.forEach((_, qIdx) => {
    document.querySelectorAll(`input[name="q_${qIdx}"]`).forEach(input => {
      input.checked = false;
      input.disabled = false;
    });
    document.querySelectorAll(`[id^="opt-label-${qIdx}-"]`).forEach(l => l.classList.remove('correct', 'wrong'));
    const exp = document.getElementById(`quiz-exp-${qIdx}`);
    if (exp) exp.style.display = 'none';
  });
  document.getElementById('quizScoreDisplay').innerHTML = '';
}


// ==========================================
// 6. VIVA VOCE ACCORDION MODULE
// ==========================================

const vivaData = [
  {
    q: '1. What is a transposition cipher and how does it differ from a substitution cipher?',
    a: 'A transposition cipher rearranges the locations (positions) of the characters in the plaintext according to a predetermined permutation without altering the identity of the characters themselves. In contrast, a substitution cipher preserves the positions of characters but substitutes their identities with other characters or symbols.'
  },
  {
    q: '2. Why is the Rail Fence cipher considered "keyless" while Columnar Transposition is "keyed"?',
    a: 'Rail Fence is keyless because its permutation depends entirely on an algorithmic geometric parameter (the number of rails/depth) without utilizing an arbitrary secret keyword from an exponential keyspace. Columnar Transposition is keyed because the extraction sequence depends on a secret keyword whose letters determine the column permutation.'
  },
  {
    q: '3. What is the mathematical period of a Rail Fence cipher with r rows, and why is this significant?',
    a: 'The period of oscillation is T = 2(r - 1). It represents the number of characters required for the zig-zag path to travel from row 0 down to row r - 1 and back up to row 0. Characters separated by multiples of 2(r - 1) always land in the same horizontal rail row.'
  },
  {
    q: '4. How are repeated letters in a Columnar Transposition keyword handled?',
    a: 'This lab uses a deduplicated-key variation: only the first occurrence of each keyword letter is retained. For example, BALLOON becomes BALON.'
  },
  {
    q: '5. How can an eavesdropper break a simple Columnar Transposition cipher without brute-forcing all keys?',
    a: 'An eavesdropper can use Anagramming. Since column heights are known from the message length, adjacent columns can be slid alongside each other to look for high-frequency digrams (e.g. TH, ER, ON, IN) and common English words across the rows, allowing piecemeal reconstruction of column ordering.'
  },
  {
    q: '6. What role do transposition techniques play in modern cryptographic algorithms like DES and AES?',
    a: 'Transposition provides diffusion, one of the two foundational principles of modern ciphers described by Claude Shannon. In DES, transposition is implemented via Permutation Boxes (Initial Permutation, Expansion, and P-Boxes). In AES, transposition is realized by the ShiftRows layer.'
  }
];

function initViva() {
  const container = document.getElementById('vivaContainer');
  container.innerHTML = '';

  vivaData.forEach(item => {
    const vDiv = document.createElement('div');
    vDiv.className = 'viva-item';
    vDiv.innerHTML = `
      <div class="viva-header">
        <span>${item.q}</span>
        <span style="font-size:1.2rem; color:var(--accent-cyan);">+</span>
      </div>
      <div class="viva-body">
        <p>${item.a}</p>
      </div>
    `;

    const header = vDiv.querySelector('.viva-header');
    const body = vDiv.querySelector('.viva-body');
    const icon = header.querySelector('span:last-child');

    header.addEventListener('click', () => {
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      icon.textContent = isOpen ? '+' : '−';
    });

    container.appendChild(vDiv);
  });
}
