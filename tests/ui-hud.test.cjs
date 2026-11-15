const test = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { UIManager } = require('../artifacts/ability-tests/game/ui/UIManager.js');
const { icon } = require('../artifacts/ability-tests/game/ui/icons.js');

const CHARACTER = {
  id: 'wizard',
  name: 'Nick',
  textureKey: 'player',
  scale: 0.4,
  idleAnimation: { key: 'player-idle-down' },
  aura: false,
  companionId: 'mystery',
  blurb: 'A spark of woodland magic.',
  animationForDirection: () => ({ key: 'player-idle-down' })
};

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);

class MiniClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  syncFromAttr(val) {
    this.set = new Set(String(val || '').split(/\s+/).filter(Boolean));
  }
  add(...tokens) {
    for (const t of tokens) if (t) this.set.add(t);
    this.el._attrs.class = Array.from(this.set).join(' ');
  }
  remove(...tokens) {
    for (const t of tokens) this.set.delete(t);
    this.el._attrs.class = Array.from(this.set).join(' ');
  }
  toggle(token, force) {
    const on = force === undefined ? !this.set.has(token) : Boolean(force);
    if (on) this.set.add(token);
    else this.set.delete(token);
    this.el._attrs.class = Array.from(this.set).join(' ');
    return on;
  }
  contains(token) {
    return this.set.has(token);
  }
}

class MiniText {
  constructor(text) {
    this.nodeType = 3;
    this.text = text;
    this.parentElement = null;
  }
  get textContent() {
    return this.text;
  }
  set textContent(v) {
    this.text = String(v ?? '');
  }
  remove() {
    const p = this.parentElement;
    if (!p) return;
    p.childNodes = p.childNodes.filter(n => n !== this);
    this.parentElement = null;
  }
  toHTML() {
    return this.text;
  }
}

class MiniElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.childNodes = [];
    this.parentElement = null;
    this._attrs = {};
    this.classList = new MiniClassList(this);
    this.style = {};
    this.listeners = new Map();
    this.disabled = false;
    this.hidden = false;
    this.title = '';
    this.type = '';
    this.tabIndex = 0;
    this.isContentEditable = false;
    this._rect = { left: 0, top: 0, width: 116, height: 116 };
  }

  get className() {
    return this._attrs.class || '';
  }
  set className(v) {
    this._attrs.class = String(v || '');
    this.classList.syncFromAttr(this._attrs.class);
  }
  get id() {
    return this._attrs.id || '';
  }
  set id(v) {
    this._attrs.id = String(v || '');
  }
  setAttribute(name, value) {
    const str = String(value);
    this._attrs[name] = str;
    if (name === 'class') this.classList.syncFromAttr(str);
    else if (name === 'style') {
      for (const decl of str.split(';')) {
        const idx = decl.indexOf(':');
        if (idx === -1) continue;
        const prop = decl.slice(0, idx).trim();
        const val = decl.slice(idx + 1).trim();
        if (prop) this.style[prop] = val;
      }
    }
    else if (name === 'hidden') this.hidden = true;
    else if (name === 'disabled') this.disabled = true;
    else if (name === 'title') this.title = str;
    else if (name === 'id') this._attrs.id = str;
  }
  getAttribute(name) {
    if (name === 'hidden') return this.hidden ? '' : null;
    if (name === 'disabled') return this.disabled ? '' : null;
    return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const t = new MiniText(node);
        t.parentElement = this;
        this.childNodes.push(t);
      } else if (node) {
        if (node.parentElement) node.remove();
        node.parentElement = this;
        this.childNodes.push(node);
        if (node.nodeType === 1) this.children.push(node);
      }
    }
  }
  remove() {
    const p = this.parentElement;
    if (!p) return;
    p.childNodes = p.childNodes.filter(n => n !== this);
    p.children = p.children.filter(n => n !== this);
    this.parentElement = null;
  }
  get textContent() {
    return this.childNodes.map(n => n.textContent).join('');
  }
  set textContent(v) {
    this.childNodes = [];
    this.children = [];
    if (v !== undefined && v !== null && v !== '') this.append(String(v));
  }
  get innerHTML() {
    return this.childNodes.map(n => n.toHTML()).join('');
  }
  set innerHTML(html) {
    this.childNodes = [];
    this.children = [];
    const parsed = parseFragment(String(html || ''));
    for (const child of parsed) this.append(child);
  }
  insertAdjacentHTML(position, html) {
    const nodes = parseFragment(String(html || ''));
    if (position === 'beforeend') {
      for (const n of nodes) this.append(n);
      return;
    }
    const p = this.parentElement;
    if (!p) return;
    const idx = p.childNodes.indexOf(this);
    const insertAt = position === 'beforebegin' ? idx : idx + 1;
    p.childNodes.splice(insertAt, 0, ...nodes);
    for (const n of nodes) n.parentElement = p;
    p.children = p.childNodes.filter(n => n.nodeType === 1);
  }
  toHTML() {
    const tag = this.tagName.toLowerCase();
    const attrs = Object.entries(this._attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
    if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${this.innerHTML}</${tag}>`;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    event.currentTarget = this;
    event.preventDefault = event.preventDefault || (() => { event.defaultPrevented = true; });
    const list = Array.from(this.listeners.get(event.type) || []);
    for (const fn of list) fn(event);
    return !event.defaultPrevented;
  }
  click() {
    this.dispatchEvent({ type: 'click', detail: 1 });
  }
  focus() {
    if (global.document) global.document.activeElement = this;
  }
  blur() {
    if (global.document && global.document.activeElement === this) global.document.activeElement = null;
  }
  getBoundingClientRect() {
    return this._rect;
  }
  querySelectorAll(selector) {
    const groups = selector.split(',').map(s => s.trim()).filter(Boolean);
    const results = [];
    const seen = new Set();
    const walk = (node) => {
      for (const child of node.children) {
        if (groups.some(g => matchesSelector(child, g)) && !seen.has(child)) {
          seen.add(child);
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function matchesSimple(el, part) {
  let rem = part;
  if (rem.endsWith(':not(:disabled)')) {
    if (el.disabled) return false;
    rem = rem.slice(0, -':not(:disabled)'.length);
  }
  const classes = [];
  rem = rem.replace(/\.([a-zA-Z0-9_-]+)/g, (_, cls) => { classes.push(cls); return ''; });
  const attrs = [];
  rem = rem.replace(/\[([a-zA-Z0-9_-]+)="?([^"\]]+)"?\]/g, (_, k, v) => { attrs.push([k, v]); return ''; });
  if (rem && el.tagName.toLowerCase() !== rem.toLowerCase()) return false;
  for (const cls of classes) if (!el.classList.contains(cls)) return false;
  for (const [k, v] of attrs) if (el.getAttribute(k) !== v) return false;
  return true;
}

function matchesSelector(el, selector) {
  const parts = selector.trim().split(/\s+/);
  let current = el;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (i === parts.length - 1) {
      if (!matchesSimple(current, parts[i])) return false;
    } else {
      let ancestor = current.parentElement;
      while (ancestor && !matchesSimple(ancestor, parts[i])) ancestor = ancestor.parentElement;
      if (!ancestor) return false;
      current = ancestor;
    }
  }
  return true;
}

function parseFragment(html) {
  const root = new MiniElement('div');
  const stack = [root];
  const tokenRe = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  let match;
  while ((match = tokenRe.exec(html)) !== null) {
    if (match[4] !== undefined) {
      const parent = stack[stack.length - 1];
      parent.append(decodeEntities(match[4]));
      continue;
    }
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    const rawAttrs = match[3] || '';
    if (closing) {
      while (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() !== tag) stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }
    const el = new MiniElement(tag);
    const attrRe = /([a-zA-Z0-9_:-]+)(?:="([^"]*)"|='([^']*)')?/g;
    let attr;
    while ((attr = attrRe.exec(rawAttrs)) !== null) {
      const name = attr[1];
      if (!name || name === '/') continue;
      const val = attr[2] ?? attr[3] ?? '';
      el.setAttribute(name, decodeEntities(val));
    }
    stack[stack.length - 1].append(el);
    if (!VOID_TAGS.has(tag) && !rawAttrs.trim().endsWith('/')) {
      stack.push(el);
    }
  }
  return root.childNodes.map(node => {
    node.parentElement = null;
    return node;
  });
}

function decodeEntities(text) {
  return text
    .replace(/&rarr;/g, '→')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function setupDom({ coarse = false } = {}) {
  const uiRoot = new MiniElement('div');
  uiRoot.id = 'ui-root';
  const windowListeners = new Map();
  const prevWindow = global.window;
  const prevDocument = global.document;
  const prevHTMLElement = global.HTMLElement;

  const mockWindow = {
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      windowListeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      event.preventDefault = event.preventDefault || (() => { event.defaultPrevented = true; });
      for (const fn of Array.from(windowListeners.get(event.type) || [])) fn(event);
    },
    matchMedia(query) {
      return { matches: query.includes('coarse') ? coarse : false };
    }
  };

  const mockDocument = {
    activeElement: null,
    getElementById(id) {
      return id === 'ui-root' ? uiRoot : null;
    },
    createElement(tag) {
      return new MiniElement(tag);
    }
  };

  global.window = mockWindow;
  global.document = mockDocument;
  global.HTMLElement = MiniElement;

  const teardown = () => {
    global.window = prevWindow;
    global.document = prevDocument;
    global.HTMLElement = prevHTMLElement;
  };

  return { uiRoot, mockWindow, mockDocument, windowListeners, teardown };
}

test('icons.ts provides distinct inline SVGs for all new HUD, weapon, and event icons', () => {
  const leafSvg = icon('leaf');
  const required = ['reroll', 'dash', 'sound-on', 'sound-off', 'aim', 'boomerang', 'lantern', 'shrine', 'shield'];
  for (const name of required) {
    const svg = icon(name);
    assert.ok(svg.startsWith('<svg '), `${name} should render an inline <svg>`);
    assert.ok(svg.includes('</svg>'), `${name} should close </svg>`);
    assert.notEqual(svg, leafSvg, `${name} should have its own custom path and not fall back to leaf`);
  }
  assert.notEqual(icon('sound-on'), icon('sound-off'));
});

test('UIManager constructor and update stay backward-compatible without options or optional snapshot fields', () => {
  const dom = setupDom();
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    let pausedCalls = 0;
    const ui = new UIManager(game, () => { pausedCalls++; }, CHARACTER, 'p.png', 'c.png');
    // Omit optional nextBossLevel/nextBossName/waking fields to verify legacy bare-snapshot compatibility.
    const {
      nextBossLevel: _lvl,
      nextBossName: _name,
      wakingProgress: _wp,
      wakingRemainingMs: _wr,
      wakingKills: _wk,
      wakingGoal: _wg,
      wakingCompleted: _wc,
      ...bareSnap
    } = game.getHudSnapshot();
    ui.update(bareSnap);

    assert.equal(dom.uiRoot.querySelector('.health-value').textContent, '100 / 100');
    assert.equal(dom.uiRoot.querySelector('.level-seal').textContent, '1');
    assert.equal(dom.uiRoot.querySelector('.status-strip').hidden, true);
    assert.equal(dom.uiRoot.querySelector('.touch-controls').hidden, true);

    dom.uiRoot.querySelector('.pause-button').click();
    assert.equal(pausedCalls, 1);
    ui.destroy();
    assert.equal(dom.uiRoot.children.length, 0);
  } finally {
    dom.teardown();
  }
});

test('in-run status strip displays dash, Barkskin ward, active buffs, and next boss milestone', () => {
  const dom = setupDom();
  try {
    const game = new GameManager('spell', undefined, 'ron');
    let dashCount = 0;
    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png', {
      onDash: () => { dashCount++; }
    });

    const baseSnap = game.getHudSnapshot();
    ui.update({
      ...baseSnap,
      dashCooldownRatio: 0,
      wardStatus: 'ready',
      wardLeaves: 4,
      wardMaxLeaves: 4,
      shoutRemainingMs: 3200,
      harvestBonus: 0.35,
      nextBossLevel: 10,
      nextBossName: 'The Woodland Oven'
    });

    const strip = dom.uiRoot.querySelector('.status-strip');
    assert.equal(strip.hidden, false);

    const dashPill = dom.uiRoot.querySelector('.dash-pill');
    assert.equal(dashPill.hidden, false);
    assert.ok(dashPill.classList.contains('is-ready'));
    assert.match(dashPill.textContent, /Dash/);
    assert.match(dashPill.textContent, /Ready/);
    dashPill.click();
    assert.equal(dashCount, 1);

    const wardPill = dom.uiRoot.querySelector('.ward-pill');
    assert.equal(wardPill.hidden, false);
    assert.equal(wardPill.querySelectorAll('.ward-pips i.on').length, 4);
    assert.match(wardPill.textContent, /4\/4/);

    assert.equal(dom.uiRoot.querySelector('.shout-pill').hidden, false);
    assert.match(dom.uiRoot.querySelector('.shout-pill').textContent, /3\.2s/);
    assert.equal(dom.uiRoot.querySelector('.harvest-pill').hidden, false);
    assert.match(dom.uiRoot.querySelector('.harvest-pill').textContent, /\+35%/);
    assert.equal(dom.uiRoot.querySelector('.boss-milestone-pill').hidden, false);
    assert.match(dom.uiRoot.querySelector('.boss-milestone-pill').textContent, /Next Boss: Lv\. 10/);

    // Cooldown & recharging state updates cleanly; clear nextBossLevel/nextBossName carried by baseSnap
    ui.update({
      ...baseSnap,
      dashCooldownRatio: 0.6,
      wardStatus: 'recharging',
      wardLeaves: 1,
      wardMaxLeaves: 4,
      shoutRemainingMs: 0,
      harvestBonus: 0,
      nextBossLevel: undefined,
      nextBossName: undefined
    });
    assert.ok(dashPill.classList.contains('is-cooling'));
    assert.match(dashPill.textContent, /40%/);
    assert.equal(wardPill.querySelectorAll('.ward-pips i.on').length, 1);
    assert.ok(wardPill.classList.contains('ward-recharging'));
    assert.equal(dom.uiRoot.querySelector('.shout-pill').hidden, true);
    assert.equal(dom.uiRoot.querySelector('.harvest-pill').hidden, true);
    assert.equal(dom.uiRoot.querySelector('.boss-milestone-pill').hidden, true);

    ui.destroy();
  } finally {
    dom.teardown();
  }
});

test('top-right mute and aim mode toggles respond to clicks and M/F keys', () => {
  const dom = setupDom();
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    let muted = false;
    let manualAim = false;
    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png', {
      initialMuted: false,
      initialManualAim: false,
      onToggleMute: () => { muted = !muted; return muted; },
      onToggleAimMode: () => { manualAim = !manualAim; return manualAim; }
    });

    const muteBtn = dom.uiRoot.querySelector('.mute-button');
    const aimBtn = dom.uiRoot.querySelector('.aim-button');
    assert.equal(muteBtn.getAttribute('aria-pressed'), 'false');
    assert.match(aimBtn.textContent, /Auto/);

    muteBtn.click();
    assert.equal(muted, true);
    assert.equal(ui.isMuted(), true);
    assert.equal(muteBtn.getAttribute('aria-pressed'), 'true');
    assert.ok(muteBtn.classList.contains('is-muted'));

    dom.mockWindow.dispatchEvent({ type: 'keydown', key: 'm' });
    assert.equal(muted, false);
    assert.equal(ui.isMuted(), false);

    aimBtn.click();
    assert.equal(manualAim, true);
    assert.equal(ui.isManualAim(), true);
    assert.match(aimBtn.textContent, /Cursor/);
    assert.ok(aimBtn.classList.contains('is-manual'));

    dom.mockWindow.dispatchEvent({ type: 'keydown', key: 'F' });
    assert.equal(manualAim, false);
    assert.match(aimBtn.textContent, /Auto/);

    // F should not toggle aim while an overlay is open
    ui.showPaused(() => {}, () => {});
    dom.mockWindow.dispatchEvent({ type: 'keydown', key: 'f' });
    assert.equal(manualAim, false);

    ui.destroy();
  } finally {
    dom.teardown();
  }
});

test('showLevelUp supports Reroll (R) in-place updates and Skip (S / 0)', () => {
  const dom = setupDom();
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    const upgrades = new UpgradeSystem(() => 0.1);
    const all = upgrades.getAvailable(game.playerStats);
    const firstBatch = all.slice(0, 3);
    const secondBatch = all.slice(3, 6);

    let chosen = null;
    let rerollsLeft = 1;
    let skipped = 0;

    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png');
    ui.showLevelUp(firstBatch, c => { chosen = c; }, 'level', undefined, {
      rerollsRemaining: rerollsLeft,
      onReroll: () => {
        if (rerollsLeft <= 0) return undefined;
        rerollsLeft--;
        return secondBatch;
      },
      onSkip: () => { skipped++; }
    });

    const cardsBefore = dom.uiRoot.querySelectorAll('.upgrade-card');
    assert.equal(cardsBefore.length, 3);
    assert.match(cardsBefore[0].textContent, new RegExp(firstBatch[0].title.split(':')[0]));
    const rerollBtn = dom.uiRoot.querySelector('.reroll-button');
    assert.equal(rerollBtn.disabled, false);
    assert.match(rerollBtn.textContent, /1/);

    // Trigger reroll via R shortcut
    dom.mockWindow.dispatchEvent({ type: 'keydown', key: 'r' });
    const cardsAfter = dom.uiRoot.querySelectorAll('.upgrade-card');
    assert.equal(cardsAfter.length, 3);
    assert.ok(cardsAfter[0].classList.contains('is-rerolled'));
    assert.match(cardsAfter[0].textContent, new RegExp(secondBatch[0].title.split(':')[0]));
    assert.equal(rerollBtn.disabled, true);
    assert.match(rerollBtn.textContent, /0/);

    // Shortcut '1' picks the first card from the rerolled batch
    dom.mockWindow.dispatchEvent({ type: 'keydown', key: '1' });
    assert.equal(chosen?.id, secondBatch[0].id);
    assert.equal(dom.uiRoot.querySelector('.storybook-overlay'), null);

    // Test Skip via S and 0 shortcuts
    ui.showLevelUp(firstBatch, () => {}, 'level', undefined, {
      rerollsRemaining: 0,
      onReroll: () => secondBatch,
      onSkip: () => { skipped++; }
    });
    assert.equal(dom.uiRoot.querySelector('.reroll-button').disabled, true);
    dom.mockWindow.dispatchEvent({ type: 'keydown', key: 's' });
    assert.equal(skipped, 1);
    assert.equal(dom.uiRoot.querySelector('.storybook-overlay'), null);
    assert.equal(dom.uiRoot.querySelector('.upgrade-receipt').hidden, false);

    ui.showLevelUp(firstBatch, () => {}, 'level', undefined, {
      onSkip: () => { skipped++; }
    });
    dom.mockWindow.dispatchEvent({ type: 'keydown', key: '0' });
    assert.equal(skipped, 2);

    ui.destroy();
  } finally {
    dom.teardown();
  }
});

test('showGameOver renders sorted HOW YOU FOUGHT damage breakdown bars', () => {
  const dom = setupDom();
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png');

    ui.showGameOver(() => {}, () => {}, undefined, [
      { id: 'firefly-orbit', label: 'Firefly Orbit', damage: 2500 },
      { id: 'weapon', label: 'Spell Charm', damage: 5000 },
      { id: 'crownfire', label: 'Crownfire', damage: 1500 },
      { id: 'companion', label: 'Mystery', damage: 1000 },
      { id: 'barkskin-ward', label: 'Barkskin Ward', damage: 0 }
    ]);

    const section = dom.uiRoot.querySelector('.damage-breakdown');
    assert.ok(section, 'Damage breakdown section should render');
    assert.match(section.textContent, /HOW YOU FOUGHT/);
    assert.match(section.textContent, /10,000 total/);

    const rows = section.querySelectorAll('.breakdown-row');
    assert.equal(rows.length, 4, 'Zero-damage entries should be excluded');
    assert.match(rows[0].querySelector('.breakdown-label').textContent, /Spell Charm/);
    assert.match(rows[0].querySelector('.breakdown-values').textContent, /5,000/);
    assert.match(rows[0].querySelector('.breakdown-values').textContent, /50%/);
    assert.equal(rows[0].querySelector('.breakdown-track i').style.width, '100.0%');

    assert.match(rows[1].querySelector('.breakdown-label').textContent, /Firefly Orbit/);
    assert.match(rows[1].querySelector('.breakdown-values').textContent, /25%/);
    assert.equal(rows[1].querySelector('.breakdown-track i').style.width, '50.0%');

    assert.match(rows[2].querySelector('.breakdown-label').textContent, /Crownfire/);
    assert.match(rows[3].querySelector('.breakdown-label').textContent, /Mystery/);

    // Without breakdown entries > 0, no HOW YOU FOUGHT section appears
    ui.showGameOver(() => {}, () => {}, undefined, [{ id: 'weapon', label: 'Spell Charm', damage: 0 }]);
    assert.equal(dom.uiRoot.querySelector('.damage-breakdown'), null);

    ui.destroy();
  } finally {
    dom.teardown();
  }
});

test('touch virtual joystick reveals on touchstart, normalizes vector [-1..1], and triggers mobile dash', () => {
  const domDesktop = setupDom({ coarse: false });
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    let dashTaps = 0;
    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png', {
      onDash: () => { dashTaps++; }
    });

    const controls = domDesktop.uiRoot.querySelector('.touch-controls');
    assert.equal(controls.hidden, true, 'Hidden initially on fine-pointer desktop');
    assert.deepEqual(ui.getTouchMoveVector(), { x: 0, y: 0 });

    // First touchstart on .game-ui reveals touch controls
    const gameUi = domDesktop.uiRoot.querySelector('.game-ui');
    gameUi.dispatchEvent({ type: 'touchstart', changedTouches: [] });
    assert.equal(controls.hidden, false);

    // Drag joystick base centered at (58, 58) with radius ~48.72px
    const base = domDesktop.uiRoot.querySelector('.joystick-base');
    base._rect = { left: 0, top: 0, width: 116, height: 116 };

    // Inside deadzone -> (0, 0)
    base.dispatchEvent({ type: 'touchstart', changedTouches: [{ identifier: 1, clientX: 60, clientY: 59 }] });
    assert.deepEqual(ui.getTouchMoveVector(), { x: 0, y: 0 });

    // Drag far right -> clamped to { x: 1, y: 0 }
    domDesktop.mockWindow.dispatchEvent({ type: 'touchmove', changedTouches: [{ identifier: 1, clientX: 258, clientY: 58 }] });
    const rightVec = ui.getTouchMoveVector();
    assert.ok(Math.abs(rightVec.x - 1) < 1e-6);
    assert.ok(Math.abs(rightVec.y) < 1e-6);

    // Drag diagonal -> normalized within unit circle [-1..1]
    domDesktop.mockWindow.dispatchEvent({ type: 'touchmove', changedTouches: [{ identifier: 1, clientX: 88, clientY: 88 }] });
    const diagVec = ui.getTouchMoveVector();
    assert.ok(diagVec.x > 0 && diagVec.x <= 1);
    assert.ok(diagVec.y > 0 && diagVec.y <= 1);
    assert.ok(Math.hypot(diagVec.x, diagVec.y) <= 1.0001);

    // Release -> resets to (0, 0)
    domDesktop.mockWindow.dispatchEvent({ type: 'touchend', changedTouches: [{ identifier: 1, clientX: 88, clientY: 88 }] });
    assert.deepEqual(ui.getTouchMoveVector(), { x: 0, y: 0 });

    // Mobile dash button triggers once on pointerdown + click
    const dashBtn = domDesktop.uiRoot.querySelector('.touch-dash-button');
    dashBtn.dispatchEvent({ type: 'pointerdown', button: 0, pointerType: 'touch' });
    dashBtn.click();
    assert.equal(dashTaps, 1);

    ui.destroy();
  } finally {
    domDesktop.teardown();
  }

  // Coarse-pointer screens show touch controls immediately
  const domCoarse = setupDom({ coarse: true });
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png');
    assert.equal(domCoarse.uiRoot.querySelector('.touch-controls').hidden, false);
    ui.destroy();
  } finally {
    domCoarse.teardown();
  }
});

test('Woods are Waking meter and Kill-Streak Combo badge render, update, complete, and hide cleanly', () => {
  const dom = setupDom();
  try {
    const game = new GameManager('spell', undefined, 'wizard');
    const ui = new UIManager(game, () => {}, CHARACTER, 'p.png', 'c.png');

    // Omitted fields -> both pills remain hidden
    const {
      wakingProgress: _wp,
      wakingRemainingMs: _wr,
      wakingKills: _wk,
      wakingGoal: _wg,
      wakingCompleted: _wc,
      ...baseSnap
    } = game.getHudSnapshot();
    ui.update(baseSnap);
    const wakingPill = dom.uiRoot.querySelector('.waking-pill');
    const comboPill = dom.uiRoot.querySelector('.combo-pill');
    assert.equal(wakingPill.hidden, true);
    assert.equal(comboPill.hidden, true);

    // Active waking meter (>60s) + combo below threshold (<2)
    ui.update({
      ...baseSnap,
      wakingKills: 12,
      wakingGoal: 28,
      wakingRemainingMs: 72000,
      wakingProgress: 12 / 28,
      wakingCompleted: false,
      comboCount: 1,
      comboMultiplier: 1,
      comboTimerRatio: 0.9
    });
    assert.equal(dom.uiRoot.querySelector('.status-strip').hidden, false);
    assert.equal(wakingPill.hidden, false);
    assert.match(wakingPill.textContent, /12 \/ 28/);
    assert.match(wakingPill.textContent, /1:12/);
    assert.equal(wakingPill.querySelector('.pill-progress').style.transform, 'scaleX(0.429)');
    assert.equal(comboPill.hidden, true, 'Combo badge stays hidden below 2x');

    // Update waking meter (<60s) + active combo without bonus multiplier
    ui.update({
      ...baseSnap,
      wakingKills: 24,
      wakingGoal: 28,
      wakingRemainingMs: 45000,
      wakingProgress: 24 / 28,
      wakingCompleted: false,
      comboCount: 4,
      comboMultiplier: 1,
      comboTimerRatio: 0.75
    });
    assert.match(wakingPill.textContent, /24 \/ 28/);
    assert.match(wakingPill.textContent, /45s/);
    assert.equal(comboPill.hidden, false);
    assert.match(comboPill.textContent, /4x Streak/);
    assert.equal(comboPill.classList.contains('is-hot'), false);
    assert.equal(comboPill.querySelector('.pill-progress').style.transform, 'scaleX(0.750)');

    // Waking completed celebration + hot combo with multiplier
    ui.update({
      ...baseSnap,
      wakingKills: 28,
      wakingGoal: 28,
      wakingRemainingMs: 0,
      wakingProgress: 1,
      wakingCompleted: true,
      comboCount: 10,
      comboMultiplier: 1.1,
      comboTimerRatio: 0.5
    });
    assert.equal(wakingPill.hidden, false);
    assert.ok(wakingPill.classList.contains('is-complete'));
    assert.match(wakingPill.textContent, /Woods Awakened! \+1 Reroll · \+8g/);
    assert.equal(comboPill.hidden, false);
    assert.ok(comboPill.classList.contains('is-hot'));
    assert.match(comboPill.textContent, /10x Streak · \+10%/);
    assert.equal(comboPill.querySelector('.pill-progress').style.transform, 'scaleX(0.500)');

    // Expired / reset -> both hide cleanly
    ui.update({
      ...baseSnap,
      wakingKills: 28,
      wakingGoal: 28,
      wakingRemainingMs: 0,
      wakingCompleted: false,
      comboCount: 0,
      comboMultiplier: 1,
      comboTimerRatio: 0
    });
    assert.equal(wakingPill.hidden, true);
    assert.equal(comboPill.hidden, true);

    ui.destroy();
  } finally {
    dom.teardown();
  }
});
