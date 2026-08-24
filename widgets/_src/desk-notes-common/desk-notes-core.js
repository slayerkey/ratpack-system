/* PackRat Desk Notes shared runtime. Shipping builds inline this file. */
(function () {
  'use strict';

  var cfg = globalThis.DeskNotesConfig || { pro: false, maxEntries: 8, boardCount: 1 };
  var runtime = {
    started: false,
    activeBoard: 0,
    completion: {},
    history: [],
    rotationTimer: null,
    rotationPausedUntil: 0,
    infoOpen: false,
    historyOpen: false
  };

  var THEMES = {
    midnight: { card: '#111722', card2: '#161f2d', ink: '#f4f7fb', muted: '#9aa8b8', accent: '#65e69c' },
    paper: { card: '#efe8d8', card2: '#e6dcc8', ink: '#191919', muted: '#5e5a51', accent: '#d56c45' },
    sage: { card: '#14211d', card2: '#1b2c27', ink: '#f1f5f2', muted: '#9eb2aa', accent: '#8ed7ae' },
    ocean: { card: '#101d2a', card2: '#15283a', ink: '#f4f8fc', muted: '#9db4c7', accent: '#74c6ff' },
    plum: { card: '#211728', card2: '#2c1d35', ink: '#fbf5ff', muted: '#baa6c4', accent: '#d7a6ff' },
    amber: { card: '#241d12', card2: '#312718', ink: '#fff8eb', muted: '#c4b18d', accent: '#ffc86b' },
    slate: { card: '#171a20', card2: '#20242b', ink: '#f5f7fa', muted: '#a8b0bb', accent: '#a8c7fa' },
    rose: { card: '#28181e', card2: '#351f27', ink: '#fff5f7', muted: '#c2a5ad', accent: '#ff9fb8' },
    teal: { card: '#102322', card2: '#17302f', ink: '#f0fbfa', muted: '#9ebdb9', accent: '#75e1d2' }
  };

  function getProp(name, fallback) {
    try {
      var value = globalThis[name];
      if (typeof Node !== 'undefined' && value instanceof Node) return fallback;
      if (value === undefined || value === null) return fallback;
      return value;
    } catch (e) { return fallback; }
  }

  function instanceKey(suffix) {
    var id = 'packrat-desk-notes';
    try { if (typeof uniqueId !== 'undefined' && uniqueId) id = String(uniqueId); } catch (e) {}
    return id + ':desk-notes:' + suffix;
  }

  function readStore(suffix, fallback) {
    try {
      var raw = localStorage.getItem(instanceKey(suffix));
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === undefined || parsed === null ? fallback : parsed;
    } catch (e) { return fallback; }
  }

  function writeStore(suffix, value) {
    try { localStorage.setItem(instanceKey(suffix), JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function normalizeText(text) {
    return String(text || '').replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').trim();
  }

  function hashText(text) {
    var s = String(text || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function parseLine(raw, boardIndex, cardIndex, itemIndex, duplicateIndex) {
    var text = String(raw || '').trim();
    if (!text) return null;
    var pinned = false;
    if (/^!\s*/.test(text)) { pinned = true; text = text.replace(/^!\s*/, ''); }

    var checklist = false;
    var initiallyDone = false;
    var match = text.match(/^\[([ xX])\]\s*(.*)$/);
    if (match) {
      checklist = true;
      initiallyDone = match[1].toLowerCase() === 'x';
      text = match[2].trim();
    } else {
      text = text.replace(/^[-•]\s*/, '').trim();
    }
    if (!text) return null;
    var identity = [boardIndex, cardIndex, normalizeText(text).toLowerCase(), duplicateIndex || 0].join('|');
    return {
      id: 'n-' + hashText(identity),
      text: text,
      checklist: checklist,
      initiallyDone: initiallyDone,
      pinned: pinned,
      itemIndex: itemIndex
    };
  }

  function parseBoard(title, rawRows, boardIndex, maxFields) {
    var rows = Array.isArray(rawRows)
      ? rawRows.slice(0, maxFields)
      : String(rawRows || '').replace(/\r\n?/g, '\n').split('\n').slice(0, maxFields);
    var cards = [];
    var card = { title: '', category: '', items: [] };
    var count = 0;
    var duplicateMap = {};

    function pushCard() {
      if (card.items.length || card.title || card.category) cards.push(card);
      card = { title: '', category: '', items: [] };
    }

    for (var i = 0; i < rows.length; i++) {
      var line = String(rows[i] || '').replace(/\r?\n/g, ' ').trim();
      if (!line) { pushCard(); continue; }
      if (/^##\s+/.test(line)) { card.title = line.replace(/^##\s+/, '').trim(); continue; }
      if (/^#\s+/.test(line)) { card.category = line.replace(/^#\s+/, '').trim(); continue; }

      var identityText = normalizeText(line.replace(/^!\s*/, '').replace(/^\[[ xX]\]\s*/, '').replace(/^[-•]\s*/, '')).toLowerCase();
      var dup = duplicateMap[identityText] || 0;
      duplicateMap[identityText] = dup + 1;
      var item = parseLine(line, boardIndex, cards.length, count, dup);
      if (item) { card.items.push(item); count++; }
    }
    pushCard();

    if (!cards.length) cards.push({ title: '', category: '', items: [] });
    return { title: String(title || '').trim() || 'TODAY', cards: cards, count: count };
  }

  function collectEntries(prefix, count, defaults) {
    var rows = [];
    for (var i = 1; i <= count; i++) {
      var fallback = defaults && defaults[i - 1] !== undefined ? defaults[i - 1] : '';
      rows.push(String(getProp(prefix + i, fallback) || ''));
    }
    return rows;
  }

  function readBoards() {
    var entryCount = Math.max(1, Number(cfg.entryCount || cfg.maxEntries || (cfg.pro ? 16 : 8)) || 8);
    if (!cfg.pro) {
      var liteDefaults = ['[ ] Finish thumbnail', '[ ] Upload video', 'Respond to email', 'Call dentist', '', '', '', ''];
      return [parseBoard(getProp('boardTitle', 'TODAY'), collectEntries('entry', entryCount, liteDefaults), 0, entryCount)];
    }
    var defaults = [
      ['[ ] Finish thumbnail', '[ ] Upload video', 'Respond to email', '', '## Remember', 'Call dentist', 'Buy SSD'],
      ['## Priority', '! [ ] Ship widget', '[ ] Test layouts', '[ ] Submit Marketplace assets'],
      ['[ ] Grocery run', 'Book appointment', 'Text Alex'],
      ['# Launch', '! [ ] Final QA', '[ ] Rat Art', '[ ] Ship kit', '', '## Later', 'Write changelog']
    ];
    var boards = [];
    var count = Math.max(1, Math.min(Number(cfg.boardCount || 4), 4));
    for (var i = 0; i < count; i++) {
      var n = i + 1;
      var title = getProp('board' + n + 'Title', ['TODAY', 'WORK', 'PERSONAL', 'CURRENT PROJECT'][i] || ('BOARD ' + n));
      boards.push(parseBoard(title, collectEntries('board' + n + 'Entry', entryCount, defaults[i] || []), i, entryCount));
    }
    return boards;
  }

  function settings() {
    var theme = String(getProp('noteTheme', 'midnight')).toLowerCase();
    if (!THEMES[theme]) theme = 'midnight';
    var fontScale = Math.max(80, Math.min(125, Number(getProp('fontScale', 100)) || 100));
    return {
      theme: theme,
      fontScale: fontScale,
      text: String(getProp('textColor', THEMES[theme].ink) || THEMES[theme].ink),
      accent: String(getProp('accentColor', THEMES[theme].accent) || THEMES[theme].accent),
      background: String(getProp('backgroundColor', '#07090d') || '#07090d'),
      transparency: Math.max(0, Math.min(90, Number(getProp('transparency', 0)) || 0)),
      arrangement: cfg.pro ? String(getProp('arrangement', 'cards')) : 'cards',
      rotateBoards: cfg.pro && getProp('rotateBoards', false) === true,
      rotationSeconds: Math.max(10, Math.min(120, Number(getProp('rotationSeconds', 30)) || 30)),
      showHistory: cfg.pro && getProp('showHistory', true) !== false
    };
  }

  function restoreRuntime() {
    runtime.completion = readStore('completion', {});
    if (!runtime.completion || typeof runtime.completion !== 'object' || Array.isArray(runtime.completion)) runtime.completion = {};
    runtime.history = readStore('history', []);
    if (!Array.isArray(runtime.history)) runtime.history = [];
    runtime.activeBoard = Math.max(0, Number(readStore('active-board', 0)) || 0);
  }

  function persistSnapshot(boards) {
    writeStore('content-snapshot', boards.map(function (b) { return { title: b.title, count: b.count }; }));
  }

  function isDone(item) {
    if (!item.checklist) return false;
    if (Object.prototype.hasOwnProperty.call(runtime.completion, item.id)) return runtime.completion[item.id] === true;
    return item.initiallyDone === true;
  }

  function trimCompletion(boards) {
    var valid = {};
    boards.forEach(function (board) {
      board.cards.forEach(function (card) {
        card.items.forEach(function (item) { if (item.checklist) valid[item.id] = true; });
      });
    });
    Object.keys(runtime.completion).forEach(function (key) { if (!valid[key]) delete runtime.completion[key]; });
    writeStore('completion', runtime.completion);
  }

  function completeItem(item, boardTitle) {
    var next = !isDone(item);
    runtime.completion[item.id] = next;
    writeStore('completion', runtime.completion);
    if (next && cfg.pro) {
      runtime.history.unshift({ text: item.text, board: boardTitle, at: Date.now() });
      runtime.history = runtime.history.slice(0, 40);
      writeStore('history', runtime.history);
    }
    render();
  }

  function setCssVars(s) {
    var theme = THEMES[s.theme];
    var root = document.documentElement;
    root.style.setProperty('--text', s.text);
    root.style.setProperty('--accent', s.accent);
    root.style.setProperty('--background', s.background);
    root.style.setProperty('--card', theme.card);
    root.style.setProperty('--card-2', theme.card2);
    root.style.setProperty('--muted', theme.muted);
    root.style.setProperty('--font-scale', String(s.fontScale / 100));
    root.style.setProperty('--surface-alpha', String(1 - s.transparency / 100));
    document.body.setAttribute('data-theme', s.theme);
    document.body.setAttribute('data-arrangement', s.arrangement);
  }

  function element(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function itemNode(item, boardTitle) {
    var row = element('button', 'note-item' + (item.pinned ? ' is-pinned' : '') + (item.checklist ? ' is-check' : ' is-plain'));
    row.type = 'button';
    row.setAttribute('data-item-id', item.id);
    if (!item.checklist) row.disabled = true;
    var check = element('span', 'checkmark', item.checklist ? '' : '•');
    var copy = element('span', 'item-copy', item.text);
    var pin = element('span', 'pin-mark', item.pinned ? 'PIN' : '');
    row.appendChild(check); row.appendChild(copy); row.appendChild(pin);
    if (isDone(item)) row.classList.add('is-done');
    if (item.checklist) {
      row.setAttribute('aria-label', (isDone(item) ? 'Mark incomplete: ' : 'Mark complete: ') + item.text);
      row.addEventListener('click', function () { completeItem(item, boardTitle); });
    }
    return row;
  }

  function cardNode(card, boardTitle) {
    var wrapper = element('section', 'note-card');
    if (card.title || card.category) {
      var heading = element('div', 'card-heading');
      if (card.title) heading.appendChild(element('strong', 'card-title', card.title));
      if (card.category) heading.appendChild(element('span', 'category-pill', card.category));
      wrapper.appendChild(heading);
    }
    var list = element('div', 'note-list');
    var ordered = card.items.slice().sort(function (a, b) { return Number(b.pinned) - Number(a.pinned) || a.itemIndex - b.itemIndex; });
    ordered.forEach(function (item) { list.appendChild(itemNode(item, boardTitle)); });
    if (!ordered.length) list.appendChild(element('div', 'empty-card', 'Add notes in iCUE settings'));
    wrapper.appendChild(list);
    return wrapper;
  }

  function boardProgress(board) {
    var checks = [];
    board.cards.forEach(function (card) { card.items.forEach(function (item) { if (item.checklist) checks.push(item); }); });
    if (!checks.length) return '';
    var done = checks.filter(isDone).length;
    return done + ' / ' + checks.length + ' DONE';
  }

  function renderTabs(boards) {
    var tabs = document.getElementById('boardTabs');
    tabs.replaceChildren();
    tabs.hidden = !cfg.pro || boards.length < 2;
    if (tabs.hidden) return;
    boards.forEach(function (board, index) {
      var btn = element('button', 'board-tab', board.title || ('BOARD ' + (index + 1)));
      btn.type = 'button';
      if (index === runtime.activeBoard) btn.classList.add('is-active');
      btn.addEventListener('click', function () {
        runtime.activeBoard = index;
        runtime.rotationPausedUntil = Date.now() + 60000;
        writeStore('active-board', index);
        render();
      });
      tabs.appendChild(btn);
    });
  }

  function renderHistory() {
    var overlay = document.getElementById('historyOverlay');
    if (!overlay) return;
    overlay.classList.toggle('is-open', runtime.historyOpen);
    var list = overlay.querySelector('.history-list');
    list.replaceChildren();
    if (!runtime.history.length) list.appendChild(element('div', 'overlay-empty', 'Completed items will appear here.'));
    runtime.history.slice(0, 20).forEach(function (entry) {
      var row = element('div', 'history-row');
      row.appendChild(element('strong', '', entry.text));
      row.appendChild(element('span', '', (entry.board || '') + '  •  ' + new Date(entry.at).toLocaleDateString()));
      list.appendChild(row);
    });
  }

  function renderInfo() {
    var overlay = document.getElementById('infoOverlay');
    if (!overlay) return;
    overlay.classList.toggle('is-open', runtime.infoOpen);
    var button = overlay.querySelector('[data-action="view-pro"]');
    if (!button) return;
    var url = String(globalThis.DESK_NOTES_PRO_MARKETPLACE_URL || '').trim();
    button.disabled = !url;
    button.textContent = url ? 'View Pro' : 'Pro listing link pending';
  }

  function visibleEntryLimit() {
    var w = Math.max(1, innerWidth || 840), h = Math.max(1, innerHeight || 344);
    if (!cfg.pro) return cfg.maxEntries || 8;
    if (h < 450) return 8;
    if (w < 760 && h < 900) return 10;
    if (w > 1500 || h > 1200) return cfg.maxEntries || 16;
    return 14;
  }

  function render() {
    if (!document.getElementById('notesGrid')) return;
    var boards = readBoards();
    if (runtime.activeBoard >= boards.length) runtime.activeBoard = 0;
    trimCompletion(boards);
    persistSnapshot(boards);
    var s = settings();
    setCssVars(s);
    renderTabs(boards);

    var board = boards[runtime.activeBoard] || boards[0];
    document.getElementById('boardTitleView').textContent = board.title;
    document.getElementById('progressView').textContent = boardProgress(board);
    var grid = document.getElementById('notesGrid');
    grid.replaceChildren();

    var remaining = visibleEntryLimit();
    var hiddenCount = Math.max(0, board.count - remaining);
    board.cards.forEach(function (card) {
      if (remaining <= 0) return;
      var cloned = { title: card.title, category: card.category, items: card.items.slice(0, remaining) };
      remaining -= cloned.items.length;
      if (cloned.items.length || cloned.title || cloned.category) grid.appendChild(cardNode(cloned, board.title));
    });
    if (!board.count) grid.appendChild(cardNode({ title: '', category: '', items: [] }, board.title));
    var more = document.getElementById('moreCount');
    more.hidden = hiddenCount === 0;
    more.textContent = hiddenCount ? ('+' + hiddenCount + ' MORE IN THIS BOARD') : '';

    var historyButton = document.getElementById('historyButton');
    if (historyButton) historyButton.hidden = !s.showHistory;
    renderInfo();
    renderHistory();
    configureRotation(s, boards.length);
  }

  function configureRotation(s, boardCount) {
    if (runtime.rotationTimer) { clearInterval(runtime.rotationTimer); runtime.rotationTimer = null; }
    if (!s.rotateBoards || boardCount < 2) return;
    runtime.rotationTimer = setInterval(function () {
      if (Date.now() < runtime.rotationPausedUntil || runtime.infoOpen || runtime.historyOpen) return;
      runtime.activeBoard = (runtime.activeBoard + 1) % boardCount;
      writeStore('active-board', runtime.activeBoard);
      render();
    }, s.rotationSeconds * 1000);
  }

  function openProListing() {
    var url = String(globalThis.DESK_NOTES_PRO_MARKETPLACE_URL || '').trim();
    if (!url) return false;
    try {
      if (globalThis.plugins && plugins.Linkprovider && typeof plugins.Linkprovider.open === 'function') {
        plugins.Linkprovider.open(url);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function bindUi() {
    var info = document.getElementById('infoButton');
    if (info) info.addEventListener('click', function () { runtime.infoOpen = true; renderInfo(); });
    var closeInfo = document.querySelector('#infoOverlay [data-action="close"]');
    if (closeInfo) closeInfo.addEventListener('click', function () { runtime.infoOpen = false; renderInfo(); });
    var viewPro = document.querySelector('#infoOverlay [data-action="view-pro"]');
    if (viewPro) viewPro.addEventListener('click', openProListing);
    var history = document.getElementById('historyButton');
    if (history) history.addEventListener('click', function () { runtime.historyOpen = true; renderHistory(); });
    var closeHistory = document.querySelector('#historyOverlay [data-action="close"]');
    if (closeHistory) closeHistory.addEventListener('click', function () { runtime.historyOpen = false; renderHistory(); });
  }

  function start() {
    if (runtime.started) return;
    runtime.started = true;
    restoreRuntime();
    bindUi();
    render();
    addEventListener('resize', render);
  }

  globalThis.icueEvents = {
    onICUEInitialized: function () { start(); render(); },
    onDataUpdated: function () { render(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  globalThis.__deskNotesTest = {
    normalizeText: normalizeText,
    hashText: hashText,
    parseLine: parseLine,
    parseBoard: parseBoard,
    themes: THEMES,
    visibleEntryLimit: visibleEntryLimit
  };
})();