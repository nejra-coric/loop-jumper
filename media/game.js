(function () {
  'use strict';

  const vscodeApi = typeof window.__DJ_VSCODE__ !== 'undefined' ? window.__DJ_VSCODE__ : null;

  const SKIN_IDS = [
    'android',
    'apple',
    'swift',
    'flutter',
    'python',
    'js',
    'kotlin',
    'rust',
  ];

  const init = window.__DJ_INIT__ || { skin: 'android' };
  let selectedSkin = SKIN_IDS.includes(init.skin) ? init.skin : 'android';

  const canvas = document.getElementById('game');
  const canvasWrap = document.getElementById('canvas-wrap');
  if (!canvas || !canvasWrap) {
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const scoreEl = document.getElementById('score');
  const hudEl = document.getElementById('hud');

  let W = 300;
  let H = 520;

  const GRAVITY = 0.62;
  const JUMP_V = -16;
  const JUMP_SPRING = -22;
  const MOVE_SPEED = 6.2;
  const ROCKET_EXTRA_VY = -1.55;
  const ROCKET_DURATION_MS = 3500;
  /** Fall off bottom of view → game over (no downward camera chase) */
  const MAX_FALL_BELOW_CAM = 200;
  const SHOOT_COOLDOWN_MS = 125;
  const BULLET_SPEED = -15;

  /** Larger text, sprites, platforms, and menu targets for readability. */
  const VIS = 1.32;
  const vz = (n) => Math.max(1, Math.round(n * VIS));
  const PLAYER_DRAW_W = 28;
  const PLAYER_DRAW_H = 32;

  /** World-y of bottom starter row; climb = this minus platform y = how far up we've stacked */
  let firstPlatformRowY = 0;

  /** Below this climb (px): only static + rare spring — no crack, moving, or bugs */
  const SAFE_CLIMB_UNTIL = 560;
  const ENEMY_MIN_CLIMB = 580;
  const VERT_GAP_MIN = vz(36);
  const VERT_GAP_MAX = vz(52);

  const ENEMY_LABELS = [
    { text: 'NullPointer', color: '#f44747' },
    { text: 'Merge Conflict', color: '#ce9178' },
    { text: 'Memory Leak', color: '#c586c0' },
  ];

  /** Static platforms: tokens & keywords — no [] or () */
  const STATIC_PLAT_SNIPPETS = [
    '=>',
    '::',
    '##',
    '&&',
    '||',
    '===',
    '!==',
    '!=',
    '??',
    '..=',
    '...',
    '<T>',
    '++',
    '--',
    '//',
    '~>',
    'fn',
    'use',
    'mod',
    'pub',
    'let',
    'mut',
    'def',
    'impl',
    'trait',
    'enum',
    'type',
    'async',
    'await',
    'yield',
    'Self',
    'i32',
    'u64',
    'Vec',
    'Arc',
    'Box',
    'Ok',
    'Err',
    'None',
    'Some',
    'nil',
    'NaN',
    'ref',
    'where',
    'crate',
    'super',
    'match',
    'const',
  ];

  function pickStaticPlatLabel() {
    return STATIC_PLAT_SNIPPETS[(Math.random() * STATIC_PLAT_SNIPPETS.length) | 0];
  }

  const MOVING_PLAT_LABELS = [
    'while true',
    'loop {',
    'for ever',
    'async move',
    'match _ ',
    'impl Trait',
    'trait Bound',
    'generator',
  ];

  function pickMovingPlatLabel() {
    return MOVING_PLAT_LABELS[(Math.random() * MOVING_PLAT_LABELS.length) | 0];
  }

  const SPRING_PLAT_LABELS = [
    'fn spring',
    'def bounce',
    'BOOST::on',
    'yield jump',
    'super::hop',
    'tramp::UP',
  ];

  function pickSpringPlatLabel() {
    return SPRING_PLAT_LABELS[(Math.random() * SPRING_PLAT_LABELS.length) | 0];
  }

  const CRACK_PLAT_LABELS = ['unsafe', 'panic!', 'SIGSEGV', 'broken', '@deny', 'OOM', 'UB!!', 'fatal', 'abort'];

  function pickCrackLabel() {
    return CRACK_PLAT_LABELS[(Math.random() * CRACK_PLAT_LABELS.length) | 0];
  }

  /** Narrow band on crack = must land centered; safe platforms get small edge forgiveness. */
  const SAFE_LAND_SLOP = vz(6);
  const CRACK_LAND_INSET_FR = 0.26;

  function landBandForPlatform(p) {
    if (p.type === 'crack') {
      const inset = Math.min(vz(18), p.w * CRACK_LAND_INSET_FR);
      return { left: p.x + inset, right: p.x + p.w - inset };
    }
    return { left: p.x - SAFE_LAND_SLOP, right: p.x + p.w + SAFE_LAND_SLOP };
  }

  const CRACK_COLLAPSE_MS = 420;

  /** Tokenized lines for animated code wallpaper (VS Code Dark+ colors) */
  const CODE_WALLPAPER = [
    [{ t: '/* Loop Jumper: Code Break — arcade.ts */', c: '#6A9955' }],
    [
      { t: 'const ', c: '#569CD6' },
      { t: 'controls ', c: '#9CDCFE' },
      { t: '= ', c: '#D4D4D4' },
      { t: "{ move: 'A/D', shoot: 'Space' };", c: '#CE9178' },
    ],
    [
      { t: 'function ', c: '#569CD6' },
      { t: 'onPlayerSave() ', c: '#DCDCAA' },
      { t: '{ ', c: '#D4D4D4' },
      { t: 'return ', c: '#C586C0' },
      { t: 'new ', c: '#569CD6' },
      { t: "Rocket('Flutter'); ", c: '#4EC9B0' },
      { t: '}', c: '#D4D4D4' },
    ],
    [{ t: '// Goal: squash NullPointer bugs', c: '#6A9955' }],
    [
      { t: 'interface ', c: '#569CD6' },
      { t: 'Player ', c: '#4EC9B0' },
      { t: '{ x: number; y: number; vy: number }', c: '#9CDCFE' },
    ],
    [
      { t: 'export ', c: '#569CD6' },
      { t: 'async ', c: '#569CD6' },
      { t: 'function ', c: '#569CD6' },
      { t: 'tick(dt: number) ', c: '#DCDCAA' },
      { t: '{ ', c: '#D4D4D4' },
      { t: '/* game loop */', c: '#6A9955' },
      { t: ' }', c: '#D4D4D4' },
    ],
    [
      { t: 'const ', c: '#569CD6' },
      { t: 'g ', c: '#9CDCFE' },
      { t: '= ', c: '#D4D4D4' },
      { t: '9.81', c: '#B5CEA8' },
      { t: '; ', c: '#D4D4D4' },
      { t: '// m/s²', c: '#6A9955' },
    ],
    [{ t: 'type ', c: '#569CD6' }, { t: 'Vec2 ', c: '#4EC9B0' }, { t: '= readonly [number, number]', c: '#9CDCFE' }],
    [
      { t: 'if ', c: '#C586C0' },
      { t: '(player.y ', c: '#D4D4D4' },
      { t: '> ', c: '#D4D4D4' },
      { t: 'world.height) ', c: '#9CDCFE' },
      { t: 'gameOver();', c: '#DCDCAA' },
    ],
    [
      { t: '#include ', c: '#9CDCFE' },
      { t: '<stdio.h>', c: '#CE9178' },
    ],
    [
      { t: 'int ', c: '#569CD6' },
      { t: 'main', c: '#DCDCAA' },
      { t: '(void) { ', c: '#D4D4D4' },
      { t: 'return ', c: '#C586C0' },
      { t: '0; ', c: '#B5CEA8' },
      { t: '}', c: '#D4D4D4' },
    ],
    [
      { t: 'def ', c: '#569CD6' },
      { t: 'hello', c: '#DCDCAA' },
      { t: '():', c: '#D4D4D4' },
    ],
    [{ t: '    print("Hello, world")', c: '#D4D4D4' }],
    [
      { t: 'for ', c: '#C586C0' },
      { t: 'i ', c: '#9CDCFE' },
      { t: 'in ', c: '#569CD6' },
      { t: 'range(42):', c: '#D4D4D4' },
    ],
    [
      { t: 'fn ', c: '#569CD6' },
      { t: 'fib', c: '#DCDCAA' },
      { t: '(n: u32) -> u64 ', c: '#9CDCFE' },
      { t: '{ ', c: '#D4D4D4' },
      { t: 'n ', c: '#9CDCFE' },
      { t: 'as u64 ', c: '#569CD6' },
      { t: '}', c: '#D4D4D4' },
    ],
    [
      { t: 'println!', c: '#DCDCAA' },
      { t: '("segment fault later");', c: '#CE9178' },
    ],
    [
      { t: 'public ', c: '#569CD6' },
      { t: 'static ', c: '#569CD6' },
      { t: 'void ', c: '#569CD6' },
      { t: 'main', c: '#DCDCAA' },
      { t: '(String[] a) { }', c: '#D4D4D4' },
    ],
    [
      { t: 'let ', c: '#569CD6' },
      { t: 'x ', c: '#9CDCFE' },
      { t: '= ', c: '#D4D4D4' },
      { t: 'Some(42);', c: '#9CDCFE' },
    ],
    [
      { t: 'match ', c: '#C586C0' },
      { t: 'x ', c: '#9CDCFE' },
      { t: '{ ', c: '#D4D4D4' },
      { t: 'Some(n) ', c: '#9CDCFE' },
      { t: '=> ', c: '#569CD6' },
      { t: 'n + 1, ', c: '#D4D4D4' },
      { t: '_ => 0 ', c: '#9CDCFE' },
      { t: '}', c: '#D4D4D4' },
    ],
    [
      { t: 'SELECT ', c: '#569CD6' },
      { t: '* ', c: '#C586C0' },
      { t: 'FROM ', c: '#569CD6' },
      { t: 'users ', c: '#9CDCFE' },
      { t: 'WHERE ', c: '#569CD6' },
      { t: "id = 1; -- don't", c: '#CE9178' },
    ],
    [
      { t: 'git ', c: '#D4D4D4' },
      { t: 'commit ', c: '#CE9178' },
      { t: '-m ', c: '#D4D4D4' },
      { t: '"fix: off by one"', c: '#CE9178' },
    ],
    [
      { t: 'npm ', c: '#D4D4D4' },
      { t: 'run ', c: '#CE9178' },
      { t: 'build', c: '#DCDCAA' },
    ],
    [
      { t: 'docker ', c: '#569CD6' },
      { t: 'compose ', c: '#9CDCFE' },
      { t: 'up ', c: '#D4D4D4' },
      { t: '-d', c: '#B5CEA8' },
    ],
    [{ t: '// TODO: refactor this mess', c: '#6A9955' }],
    [{ t: '/* eslint-disable */', c: '#6A9955' }],
    [
      { t: '@', c: '#C586C0' },
      { t: 'Deprecated', c: '#DCDCAA' },
      { t: '("v2 ")', c: '#CE9178' },
    ],
    [
      { t: 'class ', c: '#569CD6' },
      { t: 'Bug ', c: '#4EC9B0' },
      { t: 'implements ', c: '#569CD6' },
      { t: 'ICrashable ', c: '#4EC9B0' },
      { t: '{ }', c: '#D4D4D4' },
    ],
    [
      { t: 'throw ', c: '#C586C0' },
      { t: 'new ', c: '#569CD6' },
      { t: 'Error', c: '#4EC9B0' },
      { t: '("oops");', c: '#CE9178' },
    ],
    [
      { t: 'try ', c: '#C586C0' },
      { t: '{ ', c: '#D4D4D4' },
      { t: 'await ', c: '#569CD6' },
      { t: 'fetch', c: '#DCDCAA' },
      { t: '(url); ', c: '#9CDCFE' },
      { t: '} ', c: '#D4D4D4' },
      { t: 'catch ', c: '#C586C0' },
      { t: '{ }', c: '#D4D4D4' },
    ],
    [
      { t: 'use ', c: '#C586C0' },
      { t: 'std::collections::HashMap;', c: '#CE9178' },
    ],
    [
      { t: 'go ', c: '#569CD6' },
      { t: 'func ', c: '#569CD6' },
      { t: 'main', c: '#DCDCAA' },
      { t: '() { ', c: '#D4D4D4' },
      { t: 'fmt.Println', c: '#DCDCAA' },
      { t: '("hi") ', c: '#CE9178' },
      { t: '}', c: '#D4D4D4' },
    ],
    [
      { t: 'console', c: '#9CDCFE' },
      { t: '.log', c: '#D4D4D4' },
      { t: '(data);', c: '#9CDCFE' },
    ],
    [
      { t: 'while ', c: '#C586C0' },
      { t: '(true) ', c: '#D4D4D4' },
      { t: '{ ', c: '#D4D4D4' },
      { t: 'break; ', c: '#C586C0' },
      { t: '}', c: '#D4D4D4' },
    ],
    [{ t: '// FIXME: memory leak somewhere here', c: '#6A9955' }],
    [
      { t: 'assert ', c: '#D4D4D4' },
      { t: 'x ', c: '#9CDCFE' },
      { t: '!= ', c: '#D4D4D4' },
      { t: 'null;', c: '#569CD6' },
    ],
    [
      { t: 'enum ', c: '#569CD6' },
      { t: 'State ', c: '#4EC9B0' },
      { t: '{ Menu, Play, GameOver }', c: '#9CDCFE' },
    ],
    [
      { t: 'canvas.', c: '#9CDCFE' },
      { t: 'getContext', c: '#DCDCAA' },
      { t: "('2d');", c: '#CE9178' },
    ],
    [
      { t: 'requestAnimationFrame', c: '#DCDCAA' },
      { t: '(loop);', c: '#D4D4D4' },
    ],
    [{ t: '{ "name": "extensionHost", "type": "launch" }', c: '#CE9178' }],
    [
      { t: 'sudo ', c: '#D4D4D4' },
      { t: 'rm ', c: '#F44747' },
      { t: '-rf ', c: '#CE9178' },
      { t: '/node_modules', c: '#6A9955' },
    ],
    [{ t: '// it works on my machine™', c: '#6A9955' }],
  ];

  const LEGACY_SNIPPETS = [
    'var x = eval(input);',
    '// @ts-ignore',
    'Thread.sleep(0);',
    'document.write(html);',
  ];

  let phase = 'menu';
  let camY = 0;
  let peakHeight = 0;
  let fragBonus = 0;
  let gameOver = false;
  /** @type {'' | 'fall' | 'enemy'} */
  let deathReason = '';
  let deathEnemyLabel = '';
  let rocketUntil = 0;
  let menuScroll = 0;
  /** After tapping a skin, Play button appears; game starts only when Play is pressed. */
  let menuPlayReady = false;
  /** After landing, brief grace so platform + bug overlap does not instantly kill. */
  let landEnemyGraceUntil = 0;
  const LAND_ENEMY_GRACE_MS = 480;
  let lastShot = 0;
  /** @type {{ x: number, y: number, vy: number }[]} */
  let bullets = [];
  /** @type {{ wy: number, wx: number, text: string, speed: number }[]} */
  let legacyFlyby = [];
  /** @type {{ x: number, y: number, vx: number, vy: number, life: number, color: string }[]} */
  let fireParticles = [];
  /** @type {{ x: number, y: number, vx: number, vy: number, life: number }[]} */
  let burstParticles = [];
  const player = { x: 0, y: 0, w: vz(28), h: vz(32), vx: 0, vy: 0, facing: 1 };

  /** @type {unknown[]} */
  let platforms = [];
  /** @type {{ x: number, y: number, w: number, h: number, phase: number, label: string, labelColor: string }[]} */
  let enemies = [];
  let audioCtx = null;

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function resize() {
    if (!canvasWrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvasWrap.getBoundingClientRect();
    const w = Math.max(120, Math.floor(rect.width));
    const h = Math.max(160, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w;
    H = h;
    if (phase === 'play' && !gameOver) {
      player.x = Math.min(Math.max(player.x, 10), W - player.w - 10);
    }
    clampMenuScroll();
  }

  function clampMenuScroll() {
    const { totalH, viewH } = menuMetrics();
    const maxScroll = Math.max(0, totalH - viewH);
    menuScroll = Math.max(0, Math.min(menuScroll, maxScroll));
  }

  function menuMetrics() {
    const cols = W >= 248 ? 2 : 1;
    const pad = vz(8);
    const cellH = vz(92);
    const rows = Math.ceil(SKIN_IDS.length / cols);
    const totalH = rows * cellH + vz(24);
    const MENU_TOP = vz(88);
    const MENU_PLAY_RESERVE = vz(56);
    const viewH = Math.max(40, H - MENU_TOP - MENU_PLAY_RESERVE);
    return { cols, pad, cellH, rows, totalH, MENU_TOP, viewH, MENU_PLAY_RESERVE };
  }

  function getMenuPlayLayout() {
    const { MENU_PLAY_RESERVE } = menuMetrics();
    const playH = vz(36);
    const playY = H - MENU_PLAY_RESERVE + (MENU_PLAY_RESERVE - playH) / 2;
    const playW = Math.min(vz(168), W - vz(24));
    const playX = (W - playW) / 2;
    return { playX, playY, playW, playH };
  }

  function hitMenuPlay(mx, my) {
    if (!menuPlayReady) return false;
    const { playX, playY, playW, playH } = getMenuPlayLayout();
    return mx >= playX && mx <= playX + playW && my >= playY && my <= playY + playH;
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(canvasWrap);
  }
  window.addEventListener('resize', resize);
  resize();

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume();
  }

  function playBoing() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.07);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.005, t + 0.1);
    o.start(t);
    o.stop(t + 0.11);
  }

  function playZap() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.setValueAtTime(880 + i * 220, t + i * 0.012);
      g.gain.setValueAtTime(0, t + i * 0.012);
      g.gain.linearRampToValueAtTime(0.09, t + i * 0.012 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.012 + 0.06);
      o.start(t + i * 0.012);
      o.stop(t + i * 0.012 + 0.07);
    }
  }

  function playShatter() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const dur = 0.09;
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.35));
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const f = audioCtx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(audioCtx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  function playRocketVroom() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const dur = 0.55;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(55, t);
    o.frequency.exponentialRampToValueAtTime(200, t + dur * 0.5);
    o.frequency.exponentialRampToValueAtTime(90, t + dur);
    g.gain.setValueAtTime(0.08, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.02, t + dur);
    o.start(t);
    o.stop(t + dur);

    const n = Math.floor(audioCtx.sampleRate * 0.35);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(2000, t);
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.1, t);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    src.connect(bp);
    bp.connect(g2);
    g2.connect(audioCtx.destination);
    src.start(t);
    src.stop(t + 0.35);
  }

  /** Dramatic sting when the run ends (enemy touch or fall). */
  function playGameOverDramatic() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const dur = 1.05;

    const out = audioCtx.createGain();
    out.gain.setValueAtTime(0.42, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);
    out.connect(audioCtx.destination);

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + dur * 0.88);
    lp.connect(out);

    const merge = audioCtx.createGain();
    merge.gain.value = 1;
    merge.connect(lp);

    const oLow = audioCtx.createOscillator();
    oLow.type = 'sawtooth';
    oLow.frequency.setValueAtTime(198, t);
    oLow.frequency.exponentialRampToValueAtTime(42, t + dur * 0.92);
    const gLow = audioCtx.createGain();
    gLow.gain.value = 0.26;
    oLow.connect(gLow);
    gLow.connect(merge);

    const oMid = audioCtx.createOscillator();
    oMid.type = 'triangle';
    oMid.frequency.setValueAtTime(155, t);
    oMid.frequency.exponentialRampToValueAtTime(48, t + dur * 0.92);
    const gMid = audioCtx.createGain();
    gMid.gain.value = 0.2;
    oMid.connect(gMid);
    gMid.connect(merge);

    const oSting = audioCtx.createOscillator();
    oSting.type = 'sine';
    oSting.frequency.setValueAtTime(554, t);
    oSting.frequency.exponentialRampToValueAtTime(117, t + 0.38);
    const gSting = audioCtx.createGain();
    gSting.gain.setValueAtTime(0.0001, t);
    gSting.gain.exponentialRampToValueAtTime(0.2, t + 0.025);
    gSting.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    oSting.connect(gSting);
    gSting.connect(merge);

    oLow.start(t);
    oMid.start(t);
    oSting.start(t);
    oLow.stop(t + dur);
    oMid.stop(t + dur);
    oSting.stop(t + 0.48);

    const nSamp = Math.floor(audioCtx.sampleRate * 0.1);
    const buf = audioCtx.createBuffer(1, nSamp, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < nSamp; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nSamp * 0.22));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 380;
    nf.Q.value = 0.85;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    noise.start(t);
    noise.stop(t + 0.11);
  }

  function setHudVisible(v) {
    if (!hudEl) return;
    if (v) hudEl.classList.remove('hud-hidden');
    else hudEl.classList.add('hud-hidden');
  }

  function syncScoreHud() {
    if (scoreEl) scoreEl.textContent = String(peakHeight + fragBonus);
  }

  function drawAnimatedCodeWallpaper(now) {
    ctx.save();
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, W, H);

    const fs = Math.max(vz(8), Math.min(vz(12), Math.floor(W / 26)));
    const lineH = fs + vz(5);
    ctx.font = `${fs}px Consolas, "Courier New", monospace`;
    ctx.textBaseline = 'top';

    const n = CODE_WALLPAPER.length;

    function drawLayer(scrollPx, alphaBase, xPad, colShift) {
      const sub = scrollPx % lineH;
      const rowStart = Math.floor(scrollPx / lineH);
      for (let r = -1; r * lineH - sub < H + lineH; r++) {
        const y = r * lineH - sub;
        const idx = ((rowStart + r + colShift) % n + n) % n;
        const line = CODE_WALLPAPER[idx];
        if (!line) continue;
        let x = xPad;
        const shimmer = 0.04 * Math.sin(now * 0.0012 + idx * 0.31);
        ctx.globalAlpha = Math.max(0.18, Math.min(0.52, alphaBase + shimmer));
        for (const seg of line) {
          ctx.fillStyle = seg.c;
          ctx.fillText(seg.t, x, y);
          x += ctx.measureText(seg.t).width;
          if (x > W - 8) break;
        }
      }
    }

    drawLayer(now * 0.018, 0.32, 10, 0);
    drawLayer(now * 0.029 + 120, 0.22, 12, (n * 3) >> 2);

    if (W > 200) {
      const drift = Math.sin(now * 0.0004) * 8;
      const gScroll = now * 0.012;
      const gSub = gScroll % (lineH * 2);
      const gRow0 = Math.floor(gScroll / (lineH * 2));
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.font = `${Math.max(vz(7), fs - 2)}px Consolas, monospace`;
      for (let r = -1; r * (lineH * 2) - gSub < H + lineH * 2; r++) {
        const y = r * (lineH * 2) - gSub;
        const gi = ((gRow0 + r) % n + n) % n;
        const gline = CODE_WALLPAPER[gi];
        if (!gline) continue;
        let gx = W * 0.48 + drift;
        for (const seg of gline) {
          ctx.fillStyle = seg.c;
          ctx.fillText(seg.t, gx, y);
          gx += ctx.measureText(seg.t).width;
          if (gx > W - 6) break;
        }
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function spawnLegacyFlyby() {
    legacyFlyby = [];
    let y = player.y;
    for (let i = 0; i < 22; i++) {
      y -= rnd(24, 52);
      legacyFlyby.push({
        wy: y,
        wx: rnd(4, W - 100),
        text: LEGACY_SNIPPETS[i % LEGACY_SNIPPETS.length],
        speed: rnd(0.35, 1),
      });
    }
  }

  function spawnFire() {
    const cx = player.x + player.w / 2;
    const foot = player.y + player.h;
    for (let i = 0; i < 5; i++) {
      fireParticles.push({
        x: cx + rnd(-6, 6),
        y: foot + rnd(0, 4),
        vx: rnd(-1.8, 1.8),
        vy: rnd(3, 8),
        life: 1,
        color: Math.random() < 0.45 ? '#ff9800' : Math.random() < 0.5 ? '#ff5722' : '#29b6f6',
      });
    }
  }

  function spawnBurst(wx, wy) {
    for (let i = 0; i < 10; i++) {
      burstParticles.push({
        x: wx,
        y: wy,
        vx: rnd(-3, 3),
        vy: rnd(-3, 3),
        life: 1,
      });
    }
  }

  /** Compact bugs — readable labels, fits sidebar. */
  function enemyMetrics(label) {
    if (label === 'Merge Conflict') return { w: vz(59), h: vz(22) };
    if (label === 'Memory Leak') return { w: vz(56), h: vz(22) };
    return { w: vz(43), h: vz(22) };
  }

  function pickEnemyLabel() {
    return ENEMY_LABELS[(Math.random() * ENEMY_LABELS.length) | 0];
  }

  function initWorld() {
    camY = 0;
    peakHeight = 0;
    fragBonus = 0;
    gameOver = false;
    deathReason = '';
    deathEnemyLabel = '';
    rocketUntil = 0;
    legacyFlyby = [];
    bullets = [];
    fireParticles = [];
    burstParticles = [];
    syncScoreHud();
    landEnemyGraceUntil = Date.now() + LAND_ENEMY_GRACE_MS;
    player.x = W / 2 - player.w / 2;
    player.y = H - vz(100);
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;

    platforms = [];
    enemies = [];

    firstPlatformRowY = H - vz(36);

    platforms.push({
      type: 'static',
      bracket: pickStaticPlatLabel(),
      x: W / 2 - vz(48),
      y: firstPlatformRowY,
      w: vz(96),
      h: vz(22),
    });

    function climbAt(y) {
      return firstPlatformRowY - y;
    }

    let py = firstPlatformRowY;
    for (let i = 0; i < 52; i++) {
      py -= rnd(VERT_GAP_MIN, VERT_GAP_MAX);
      const roll = Math.random();
      const safeBoot = climbAt(py) < SAFE_CLIMB_UNTIL;

      if (safeBoot) {
        if (roll < 0.1) {
          platforms.push({
            type: 'spring',
            label: pickSpringPlatLabel(),
            x: rnd(8, W - vz(148)),
            y: py,
            w: vz(138),
            h: vz(24),
          });
        } else {
          platforms.push({
            type: 'static',
            bracket: pickStaticPlatLabel(),
            x: rnd(8, W - vz(92)),
            y: py,
            w: vz(84) + Math.random() * vz(24),
            h: vz(22),
          });
        }
      } else if (roll < 0.08) {
        platforms.push({
          type: 'spring',
          label: pickSpringPlatLabel(),
          x: rnd(8, W - vz(148)),
          y: py,
          w: vz(138),
          h: vz(24),
        });
      } else if (roll < 0.12) {
        platforms.push({
          type: 'crack',
          label: pickCrackLabel(),
          x: rnd(10, W - vz(102)),
          y: py,
          w: vz(90) + Math.random() * vz(16),
          h: vz(24),
          crackBreakAt: 0,
        });
      } else if (roll < 0.22) {
        platforms.push({
          type: 'moving',
          label: pickMovingPlatLabel(),
          x: rnd(16, W - vz(112)),
          y: py,
          w: vz(118),
          h: vz(22),
          vx: Math.random() < 0.5 ? 1.55 : -1.55,
          phase: Math.random() * Math.PI * 2,
        });
      } else {
        platforms.push({
          type: 'static',
          bracket: pickStaticPlatLabel(),
          x: rnd(8, W - vz(92)),
          y: py,
          w: vz(82) + Math.random() * vz(28),
          h: vz(22),
        });
      }

      if (climbAt(py) >= ENEMY_MIN_CLIMB && Math.random() < 0.34) {
        const L = pickEnemyLabel();
        const m = enemyMetrics(L.text);
        enemies.push({
          x: rnd(16, W - m.w - 8),
          y: py - vz(80) - Math.random() * vz(14),
          w: m.w,
          h: m.h,
          phase: Math.random() * 7,
          label: L.text,
          labelColor: L.color,
        });
      }
    }
  }

  function extendWorldIfNeeded() {
    let topY = Infinity;
    for (const p of platforms) {
      if (p.y < topY) topY = p.y;
    }
    const targetTop = camY - H * 0.85;
    while (topY > targetTop) {
      topY -= rnd(VERT_GAP_MIN, VERT_GAP_MAX);
      const roll = Math.random();
      const climb = firstPlatformRowY - topY;
      const safeBoot = climb < SAFE_CLIMB_UNTIL;

      if (safeBoot) {
        if (roll < 0.1) {
          platforms.push({
            type: 'spring',
            label: pickSpringPlatLabel(),
            x: rnd(8, W - vz(148)),
            y: topY,
            w: vz(138),
            h: vz(24),
          });
        } else {
          platforms.push({
            type: 'static',
            bracket: pickStaticPlatLabel(),
            x: rnd(8, W - vz(92)),
            y: topY,
            w: vz(84) + Math.random() * vz(26),
            h: vz(22),
          });
        }
      } else if (roll < 0.08) {
        platforms.push({
          type: 'spring',
          label: pickSpringPlatLabel(),
          x: rnd(8, W - vz(148)),
          y: topY,
          w: vz(138),
          h: vz(24),
        });
      } else if (roll < 0.12) {
        platforms.push({
          type: 'crack',
          label: pickCrackLabel(),
          x: rnd(10, W - vz(102)),
          y: topY,
          w: vz(90) + Math.random() * vz(16),
          h: vz(24),
          crackBreakAt: 0,
        });
      } else if (roll < 0.22) {
        platforms.push({
          type: 'moving',
          label: pickMovingPlatLabel(),
          x: rnd(16, W - vz(112)),
          y: topY,
          w: vz(118),
          h: vz(22),
          vx: Math.random() < 0.5 ? 1.5 : -1.5,
          phase: Math.random() * Math.PI * 2,
        });
      } else {
        platforms.push({
          type: 'static',
          bracket: pickStaticPlatLabel(),
          x: rnd(8, W - vz(92)),
          y: topY,
          w: vz(82) + Math.random() * vz(28),
          h: vz(22),
        });
      }
      if (climb >= ENEMY_MIN_CLIMB && Math.random() < 0.34) {
        const L = pickEnemyLabel();
        const m = enemyMetrics(L.text);
        enemies.push({
          x: rnd(16, W - m.w - 8),
          y: topY - vz(78) - Math.random() * vz(10),
          w: m.w,
          h: m.h,
          phase: Math.random() * 7,
          label: L.text,
          labelColor: L.color,
        });
      }
    }

    const bottomLimit = camY + H + 240;
    platforms = platforms.filter((p) => p.y < bottomLimit);
    enemies = enemies.filter((e) => e.y < bottomLimit);
    legacyFlyby = legacyFlyby.filter((l) => l.wy < bottomLimit + 80);
  }

  function screenY(wy) {
    return wy - camY;
  }

  /** Same vertical bounds as drawing — no damage from off-screen bugs. */
  function enemyIsDrawnThisFrame(e) {
    const sy = screenY(e.y);
    if (sy < -H - vz(40) || sy > H + vz(90)) return false;
    return true;
  }

  function updateLegacyFlyby(dt) {
    if (Date.now() > rocketUntil) return;
    for (const leg of legacyFlyby) {
      leg.wy += leg.speed * (dt / 16) * 1.2;
    }
  }

  function updateFire(dt) {
    const wasRocket = Date.now() < rocketUntil;
    if (wasRocket) spawnFire();
    for (const p of fireParticles) {
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.life -= dt * 0.0035;
    }
    fireParticles = fireParticles.filter((p) => p.life > 0);
    for (const p of burstParticles) {
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.life -= dt * 0.0045;
    }
    burstParticles = burstParticles.filter((p) => p.life > 0);
  }

  function drawLegacyFlyby() {
    ctx.save();
    ctx.font = `${vz(9)}px Consolas, monospace`;
    ctx.textAlign = 'left';
    for (const leg of legacyFlyby) {
      const sy = screenY(leg.wy);
      if (sy < -vz(24) || sy > H + vz(24)) continue;
      ctx.fillStyle = 'rgba(78, 201, 176, 0.12)';
      ctx.fillRect(leg.wx, sy, Math.min(vz(116), W - leg.wx - 4), vz(15));
      ctx.fillStyle = 'rgba(206, 145, 120, 0.35)';
      ctx.fillText(leg.text, leg.wx + 3, sy + 3);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of fireParticles) {
      const sy = screenY(p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, sy - 2, 4, 5);
      ctx.restore();
    }
    for (const p of burstParticles) {
      const sy = screenY(p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#ce9178';
      ctx.fillRect(p.x - 2, sy - 2, 4, 4);
      ctx.restore();
    }
  }

  function drawAndroid(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    const u = 4;
    g.fillStyle = '#6ab344';
    g.fillRect(ox + u, 0, 5 * u, 5 * u);
    g.fillStyle = '#fff';
    g.fillRect(ox + 2 * u, u, u, u);
    g.fillRect(ox + 3.5 * u, u, u, u);
    g.fillStyle = '#234f1e';
    g.fillRect(ox + 2 * u + 1, u + 1, u - 2, Math.max(1, u - 2));
    g.fillRect(ox + 3.5 * u + 1, u + 1, u - 2, Math.max(1, u - 2));
    g.fillStyle = '#6ab344';
    g.fillRect(ox, 2 * u, u, 2 * u);
    g.fillRect(ox + 5 * u, 2 * u, u, 2 * u);
    g.fillStyle = '#5a9e38';
    g.fillRect(ox + u, 5 * u, 5 * u, u * 1.2);
    g.restore();
  }

  function drawApple(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    const u = 3;
    g.fillStyle = '#2d8c3c';
    g.fillRect(ox + 7 * u, -u, 2 * u, 2 * u);
    g.fillStyle = '#e53935';
    g.fillRect(ox + 2 * u, u, 7 * u, 8 * u);
    g.fillStyle = '#5c1818';
    g.fillRect(ox + 8 * u + 0.5, 3 * u, 3 * u - 1, 4 * u);
    g.fillStyle = '#ffcdd2';
    g.fillRect(ox + 8 * u, 3 * u, 2 * u, 3 * u);
    g.fillStyle = '#e53935';
    g.fillRect(ox + 3 * u, 2 * u, 2 * u, 2 * u);
    g.fillRect(ox + 6 * u, 4 * u, 2 * u, 2 * u);
    g.restore();
  }

  function drawSwiftBird(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    g.fillStyle = '#ff6d00';
    g.fillRect(ox + 6, 12, 16, 14);
    g.fillStyle = '#fff';
    g.fillRect(ox + 14, 14, 6, 6);
    g.fillStyle = '#1565c0';
    g.fillRect(ox + 18, 16, 4, 3);
    g.fillStyle = '#ff8a65';
    g.fillRect(ox + 2, 10, 10, 8);
    g.fillRect(ox + 20, 10, 10, 8);
    g.restore();
  }

  function drawFlutterBird(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    g.fillStyle = '#29b6f6';
    g.fillRect(ox + 10, 14, 12, 12);
    g.fillStyle = '#0553b1';
    g.fillRect(ox + 20, 17, 8, 3);
    g.fillStyle = '#7cb342';
    g.fillRect(ox + 4, 12, 8, 6);
    g.fillRect(ox + 22, 12, 8, 6);
    g.restore();
  }

  function drawPythonSnake(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    g.fillStyle = '#4caf50';
    g.fillRect(ox + 4, 8, 8, 8);
    g.fillRect(ox + 8, 12, 8, 8);
    g.fillRect(ox + 12, 16, 8, 8);
    g.fillRect(ox + 16, 12, 8, 8);
    g.fillRect(ox + 12, 6, 6, 6);
    g.fillStyle = '#2e7d32';
    g.fillRect(ox + 6, 10, 2, 2);
    g.fillRect(ox + 9, 10, 2, 2);
    g.restore();
  }

  function drawJSCube(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    const oy = 2;
    g.fillStyle = '#f7df1e';
    g.fillRect(ox + 4, oy, player.w - 8, player.h - 12);
    g.strokeStyle = '#bfa615';
    g.lineWidth = 2;
    g.strokeRect(ox + 4, oy, player.w - 8, player.h - 12);
    g.fillStyle = '#1e1e1e';
    g.font = `bold ${vz(13)}px Consolas, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('JS', ox + player.w / 2, oy + (player.h - 12) / 2);
    g.restore();
  }

  function drawKotlinK(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py);
    g.scale(player.facing, 1);
    const ox = -player.w / 2;
    g.fillStyle = '#7f52ff';
    g.fillRect(ox + 6, 6, 4, 22);
    g.fillRect(ox + 10, 12, 8, 4);
    g.fillRect(ox + 14, 8, 4, 4);
    g.fillRect(ox + 16, 16, 8, 4);
    g.fillRect(ox + 18, 20, 6, 8);
    g.fillStyle = '#b8a9ff';
    g.fillRect(ox + 7, 7, 2, 8);
    g.restore();
  }

  function drawRustGear(px, py) {
    const g = ctx;
    g.save();
    g.translate(px + player.w / 2, py + player.h / 2);
    g.scale(player.facing, 1);
    g.fillStyle = '#ce422b';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.save();
      g.rotate(a);
      g.fillRect(-3, -16, 6, 10);
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.fillStyle = '#8b4419';
    g.fill();
    g.beginPath();
    g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fillStyle = '#3d2314';
    g.fill();
    g.restore();
  }

  const SKINS = [
    { id: 'android', name: 'Android', draw: drawAndroid },
    { id: 'apple', name: 'Apple', draw: drawApple },
    { id: 'swift', name: 'Swift Bird', draw: drawSwiftBird },
    { id: 'flutter', name: 'Flutter Bird', draw: drawFlutterBird },
    { id: 'python', name: 'Python', draw: drawPythonSnake },
    { id: 'js', name: 'JS Cube', draw: drawJSCube },
    { id: 'kotlin', name: 'Kotlin', draw: drawKotlinK },
    { id: 'rust', name: 'Rust Gear', draw: drawRustGear },
  ];

  function drawSkinById(id, px, py) {
    const s = SKINS.find((x) => x.id === id) || SKINS[0];
    const pw = player.w;
    const ph = player.h;
    player.w = PLAYER_DRAW_W;
    player.h = PLAYER_DRAW_H;
    ctx.save();
    ctx.translate(px + pw / 2, py);
    ctx.scale(VIS, VIS);
    ctx.translate(-PLAYER_DRAW_W / 2, 0);
    s.draw(0, 0);
    ctx.restore();
    player.w = pw;
    player.h = ph;
  }

  function drawFlutterDartOnRocket(cx, cy) {
    const g = ctx;
    g.save();
    g.translate(cx, cy);
    g.scale(0.52, 0.52);
    g.fillStyle = '#0553B1';
    g.beginPath();
    g.moveTo(0, -18);
    g.lineTo(14, -4);
    g.lineTo(0, 10);
    g.lineTo(-14, -4);
    g.closePath();
    g.fill();
    g.fillStyle = '#29B6F6';
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(10, 0);
    g.lineTo(0, 10);
    g.lineTo(-10, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#7CB342';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(6, 0);
    g.lineTo(0, 6);
    g.lineTo(-6, 0);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawPixelRocket(px, py, now) {
    const cx = px + player.w / 2;
    const cy = py + player.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(player.facing, 1);
    const bodyW = vz(22);
    const bodyH = vz(38);
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(-bodyW / 2, -bodyH / 2 - 4, bodyW, bodyH);
    ctx.fillStyle = '#78909c';
    ctx.fillRect(-bodyW / 2 + 4, -bodyH / 2 + 2, bodyW - 8, bodyH - 14);
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(-6, -bodyH / 2 + 6, 12, 10);
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(0, -bodyH / 2 - 14);
    ctx.lineTo(7, -bodyH / 2 - 4);
    ctx.lineTo(-7, -bodyH / 2 - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#78909c';
    ctx.fillRect(-bodyW / 2 - 6, 4, 5, 14);
    ctx.fillRect(bodyW / 2 + 1, 4, 5, 14);
    drawFlutterDartOnRocket(bodyW / 2 - 2, -2);
    ctx.restore();

    const flicker = 0.82 + 0.18 * Math.sin(now / 35);
    ctx.save();
    ctx.globalAlpha = flicker;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#ff9800' : i % 3 === 1 ? '#fff176' : '#29b6f6';
      ctx.beginPath();
      ctx.ellipse(cx, py + player.h + 3 + i * 5.5, 4 + i * 0.38, 8 + i * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrackPlatform(p, sy, now) {
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.008);
    ctx.fillStyle = '#3d2020';
    ctx.fillRect(p.x, sy, p.w, p.h);
    ctx.fillStyle = `rgba(80, 35, 35, ${0.5 + 0.2 * pulse})`;
    ctx.fillRect(p.x + 2, sy + 2, p.w - 4, p.h - 4);
    ctx.strokeStyle = `rgba(255, 80, 80, ${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(p.x + 1, sy + 1, p.w - 2, p.h - 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zag = 5;
    for (let i = 0; i <= Math.ceil(p.w / zag); i++) {
      const px = p.x + i * zag;
      const py = sy + (i % 2 === 0 ? 2 : 5);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff6b6b';
    ctx.font = `700 ${vz(10)}px Consolas, monospace`;
    ctx.fillText(p.label, p.x + p.w / 2, sy + p.h / 2);
    ctx.fillStyle = 'rgba(255, 40, 40, 0.85)';
    ctx.font = `600 ${vz(7)}px Consolas, monospace`;
    ctx.fillText('CRACK', p.x + p.w / 2, sy + p.h - vz(5));
  }

  function drawPlatforms(now) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of platforms) {
      const sy = screenY(p.y);
      if (sy < -vz(44) || sy > H + vz(44)) continue;
      if (p.type === 'crack') {
        drawCrackPlatform(p, sy, now);
      } else if (p.type === 'moving') {
        ctx.fillStyle = '#252526';
        ctx.strokeStyle = '#3794ff';
        ctx.lineWidth = 2;
        ctx.fillRect(p.x, sy, p.w, p.h);
        ctx.strokeRect(p.x + 1, sy + 1, p.w - 2, p.h - 2);
        ctx.fillStyle = '#ce9178';
        const ml = p.label.length;
        ctx.font = `${ml > 12 ? `600 ${vz(8)}px` : ml > 9 ? `600 ${vz(9)}px` : `600 ${vz(10)}px`} Consolas, monospace`;
        ctx.fillText(p.label, p.x + p.w / 2, sy + p.h / 2);
      } else if (p.type === 'spring') {
        ctx.fillStyle = '#1b3d5f';
        ctx.strokeStyle = '#39c';
        ctx.fillRect(p.x, sy, p.w, p.h);
        ctx.strokeRect(p.x + 1, sy + 1, p.w - 2, p.h - 2);
        ctx.fillStyle = '#dcdcaa';
        ctx.font = `600 ${vz(9)}px Consolas, monospace`;
        ctx.fillText(p.label, p.x + p.w / 2, sy + p.h / 2);
      } else {
        ctx.fillStyle = '#2d2d2d';
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.fillRect(p.x, sy, p.w, p.h);
        ctx.strokeRect(p.x + 1, sy + 1, p.w - 2, p.h - 2);
        ctx.fillStyle = '#d4d4d4';
        const txt = p.bracket;
        const fs =
          txt.length > 8
            ? `600 ${vz(9)}px`
            : txt.length > 5
              ? `600 ${vz(10)}px`
              : `700 ${vz(13)}px`;
        ctx.font = `${fs} Consolas, monospace`;
        ctx.fillText(txt, p.x + p.w / 2, sy + p.h / 2);
      }
    }
    ctx.restore();
  }

  function drawBulletsFixed() {
    ctx.save();
    ctx.font = `bold ${vz(16)}px Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffcc';
    for (const b of bullets) {
      const sy = screenY(b.y);
      if (sy < -H - vz(60) || sy > H + vz(30)) continue;
      ctx.fillText(';', b.x, sy);
    }
    ctx.restore();
  }

  /** worldY = world space (same as player.y); must convert with screenY like platforms/player */
  function drawInsect(bx, worldY, w, h, now, ph, label, labelColor) {
    const hover = Math.sin(now / 260 + ph) * 6;
    const sy = screenY(worldY) + hover;
    const wing = Math.sin(now / 85 + ph) * 0.28 + 0.72;
    const fs = label.length > 12 ? vz(7) : vz(8);
    const labelY = sy - vz(5) + Math.sin(now / 200 + ph) * 1.5;

    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.font = `700 ${fs}px Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(label).width;
    const padX = vz(4);
    const padY = vz(2);
    const pillTop = labelY - fs - padY;
    const pillW = tw + padX * 2;
    const pillH = fs + padY * 2;
    const pillX = bx + w / 2 - pillW / 2;

    ctx.fillStyle = 'rgba(25, 12, 14, 0.94)';
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.88)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(pillX, pillTop, pillW, pillH);
    ctx.strokeRect(pillX + 0.5, pillTop + 0.5, pillW - 1, pillH - 1);

    ctx.fillStyle = 'rgba(100, 220, 255, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    const wingY = sy + h * 0.28;
    const wingRx = Math.max(7, w * 0.2) * wing;
    const wingRy = Math.max(4, h * 0.22);
    ctx.beginPath();
    ctx.ellipse(bx - 2, wingY, wingRx, wingRy, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bx + w + 2, wingY, wingRx, wingRy, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#ffab40';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 1, sy - 1, w + 2, h + 2);

    ctx.fillStyle = '#8d4a3a';
    ctx.fillRect(bx + 2, sy + 2, w - 4, h - 4);
    ctx.fillStyle = '#4a2518';
    const eyeOff = Math.max(5, w * 0.12);
    ctx.fillRect(bx + eyeOff, sy + h * 0.2, 3, 2);
    ctx.fillRect(bx + w - eyeOff - 3, sy + h * 0.2, 3, 2);
    ctx.fillStyle = '#ffccbc';
    const legStep = Math.max(5, Math.floor((w - 12) / 5));
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(bx + 3 + i * legStep, sy + h - 2, 2, 4 + i);
      ctx.fillRect(bx + w - 5 - i * legStep, sy + h - 2, 2, 4 + i);
    }

    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0a0a0a';
    ctx.strokeText(label, bx + w / 2, labelY);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeText(label, bx + w / 2, labelY);
    ctx.fillStyle = labelColor;
    ctx.fillText(label, bx + w / 2, labelY);
    ctx.restore();
  }

  function drawEnemies(now) {
    for (const e of enemies) {
      if (!enemyIsDrawnThisFrame(e)) continue;
      drawInsect(e.x, e.y, e.w, e.h, now, e.phase, e.label, e.labelColor);
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function enemyHitBox(e, now) {
    const hover = Math.sin(now / 260 + e.phase) * 6;
    return { x: e.x + 3, y: e.y + hover + 4, w: e.w - 6, h: e.h - 2 };
  }

  function tryLandOnPlatforms(prevBottom, wasRocket) {
    for (const p of platforms) {
      const sy = p.y;
      if (
        player.vy >= 0 &&
        prevBottom <= sy + 4 &&
        player.y + player.h >= sy &&
        player.y + player.h <= sy + p.h + vz(14)
      ) {
        const band = landBandForPlatform(p);
        const cx = player.x + player.w / 2;
        if (band.left <= band.right && cx >= band.left && cx <= band.right) {
          player.y = sy - player.h;
          if (p.type === 'crack' && !p.crackBreakAt) {
            p.crackBreakAt = Date.now() + CRACK_COLLAPSE_MS;
          }
          landEnemyGraceUntil = Date.now() + LAND_ENEMY_GRACE_MS;
          if (!wasRocket) {
            player.vy = p.type === 'spring' ? JUMP_SPRING : JUMP_V;
            playBoing();
          } else {
            player.vy = Math.min(player.vy, -9);
          }
          return;
        }
      }
    }
  }

  function tryShoot() {
    const clock = Date.now();
    if (clock - lastShot < SHOOT_COOLDOWN_MS) return;
    lastShot = clock;
    playZap();
    bullets.push({
      x: player.x + player.w / 2,
      y: player.y + player.h / 2,
      vy: BULLET_SPEED,
    });
  }

  function cullEnemiesRocket() {
    const clock = Date.now();
    if (clock >= rocketUntil) return;
    const pcx = player.x + player.w / 2;
    const mid = player.y + player.h * 0.45;
    const next = [];
    for (const e of enemies) {
      const ecx = e.x + e.w / 2;
      const ecy = e.y + e.h / 2;
      const col = Math.abs(ecx - pcx) < 68 + e.w / 2;
      const inPath = ecy < mid + 25 && ecy > mid - 1400;
      if (col && inPath) {
        spawnBurst(ecx, ecy);
        playShatter();
        fragBonus += 35;
        syncScoreHud();
        continue;
      }
      next.push(e);
    }
    enemies = next;
  }

  function updateBulletsAndHits(now, dt) {
    for (const b of bullets) {
      b.y += b.vy * (dt / 16);
    }
    const usedBullet = new Set();
    const nextEnemies = [];
    for (const e of enemies) {
      let killed = false;
      const hb = enemyHitBox(e, now);
      for (let i = 0; i < bullets.length; i++) {
        if (usedBullet.has(i)) continue;
        const b = bullets[i];
        const br = { x: b.x - 3, y: b.y - 8, w: 6, h: 12 };
        if (rectsOverlap(br, hb)) {
          killed = true;
          usedBullet.add(i);
          spawnBurst(e.x + e.w / 2, e.y + e.h / 2);
          playShatter();
          fragBonus += 30;
          break;
        }
      }
      if (!killed) nextEnemies.push(e);
    }
    enemies = nextEnemies;
    bullets = bullets.filter((_, i) => !usedBullet.has(i));
    const bulletMaxAbove = H + 450;
    bullets = bullets.filter((b) => {
      const sy = b.y - camY;
      return sy > -bulletMaxAbove;
    });
    syncScoreHud();
  }

  function update(now, dt) {
    if (phase !== 'play' || gameOver) return;
    const clock = Date.now();
    const wasRocket = clock < rocketUntil;

    if (wasRocket) {
      player.vy += ROCKET_EXTRA_VY;
      player.vy = Math.max(player.vy, -24);
    } else {
      player.vy += GRAVITY;
    }

    player.x += player.vx;
    if (player.x < -player.w + 10) player.x = W - 10;
    if (player.x > W - 10) player.x = -player.w + 10;

    const prevBottom = player.y + player.h;
    player.y += player.vy;
    tryLandOnPlatforms(prevBottom, wasRocket);

    cullEnemiesRocket();

    updateBulletsAndHits(now, dt);

    const pr = { x: player.x + 3, y: player.y + 2, w: player.w - 6, h: player.h - 4 };
    if (Date.now() >= landEnemyGraceUntil) {
      for (const e of enemies) {
        if (!enemyIsDrawnThisFrame(e)) continue;
        if (rectsOverlap(pr, enemyHitBox(e, now))) {
          deathReason = 'enemy';
          deathEnemyLabel = e.label || '';
          gameOver = true;
          playGameOverDramatic();
          return;
        }
      }
    }

    const pCenter = player.y + player.h / 2;
    const liftLine = camY + H * 0.4;
    if (pCenter < liftLine) {
      camY -= liftLine - pCenter;
    }

    const hRun = Math.round(-(player.y + player.h));
    if (hRun > peakHeight) {
      peakHeight = hRun;
      syncScoreHud();
    }

    for (const p of platforms) {
      if (p.type === 'moving') {
        p.phase = (p.phase || 0) + dt * 0.002;
        p.x += (p.vx || 0) * (dt / 16);
        if (p.x < 10 || p.x + p.w > W - 10) p.vx = -(p.vx || 0);
      }
    }

    extendWorldIfNeeded();

    const broke = Date.now();
    platforms = platforms.filter((p) => {
      if (p.type !== 'crack' || !p.crackBreakAt) return true;
      return broke < p.crackBreakAt;
    });

    if (player.y - camY > H + MAX_FALL_BELOW_CAM) {
      deathReason = 'fall';
      deathEnemyLabel = '';
      gameOver = true;
      playGameOverDramatic();
    }

    updateLegacyFlyby(dt);
    updateFire(dt);
  }

  function wrapFillTextCenter(ctx, text, cx, startY, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    let y = startY;
    for (const ln of lines) {
      ctx.fillText(ln, cx, y);
      y += lineHeight;
    }
  }

  function drawGame(now) {
    drawAnimatedCodeWallpaper(now);
    drawLegacyFlyby();
    drawPlatforms(now);
    drawBulletsFixed();
    drawParticles();

    const prY = screenY(player.y);
    if (Date.now() < rocketUntil) {
      drawPixelRocket(player.x, prY, now);
    } else {
      drawSkinById(selectedSkin, player.x, prY);
    }

    drawEnemies(now);

    if (gameOver) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d4d4d4';
      ctx.font = `700 ${vz(18)}px Segoe UI, sans-serif`;
      ctx.fillText('Game Over', W / 2, H / 2 - vz(38));
      ctx.font = `${vz(11)}px Segoe UI, sans-serif`;
      ctx.fillStyle = '#a0a0a0';
      {
        let why = '';
        if (deathReason === 'fall') {
          why = 'Fell too far — the view only follows you upward.';
        } else if (deathReason === 'enemy') {
          why = deathEnemyLabel
            ? `Touched a bug: ${deathEnemyLabel}`
            : 'Touched a bug enemy.';
        } else {
          why = '';
        }
        if (why) {
          const maxW = W - vz(16);
          wrapFillTextCenter(ctx, why, W / 2, H / 2 - vz(14), maxW, vz(14));
        }
      }
      ctx.font = `${vz(12)}px Segoe UI, sans-serif`;
      ctx.fillStyle = '#4ec9b0';
      ctx.fillText('Play again', W / 2, H / 2 + vz(10));
      ctx.fillStyle = '#ce9178';
      ctx.fillText('Main menu', W / 2, H / 2 + vz(34));
      ctx.restore();
    }
  }

  function drawMainMenu(now) {
    drawAnimatedCodeWallpaper(now);
    ctx.save();
    const { cols, pad, cellH, MENU_TOP, viewH, totalH, MENU_PLAY_RESERVE } = menuMetrics();
    const cellW = (W - pad * (cols + 1)) / cols;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ec9b0';
    ctx.font = `700 ${vz(16)}px Consolas, monospace`;
    ctx.fillText('Loop Jumper', W / 2, vz(18));
    ctx.font = `700 ${vz(13)}px Consolas, monospace`;
    ctx.fillText('Code Break', W / 2, vz(36));
    ctx.fillStyle = '#858585';
    ctx.font = `${vz(10)}px Consolas, monospace`;
    ctx.fillText('Pick a skin · Wheel to scroll', W / 2, vz(54));

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(vz(8), vz(72));
    ctx.lineTo(W - vz(8), vz(72));
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, MENU_TOP, W, viewH);
    ctx.clip();

    for (let i = 0; i < SKINS.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rx = pad + col * (cellW + pad);
      const ry = MENU_TOP + row * cellH - menuScroll;
      if (ry + cellH < MENU_TOP || ry > MENU_TOP + viewH) continue;
      const sel = selectedSkin === SKINS[i].id;
      ctx.fillStyle = sel
        ? 'rgba(18, 42, 40, 0.94)'
        : 'rgba(22, 22, 26, 0.92)';
      ctx.strokeStyle = sel ? '#4ec9b0' : 'rgba(100, 100, 108, 0.85)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(rx, ry + 4, cellW, cellH - 12);
      ctx.strokeRect(rx, ry + 4, cellW, cellH - 12);
      SKINS[i].draw(rx + cellW / 2 - vz(14), ry + vz(14));
      ctx.fillStyle = '#ccc';
      ctx.font = `${vz(10)}px Segoe UI, sans-serif`;
      ctx.fillText(SKINS[i].name, rx + cellW / 2, ry + cellH - vz(22));
    }
    ctx.restore();

    if (totalH > viewH) {
      const barH = viewH * (viewH / totalH);
      const barY = MENU_TOP + (menuScroll / Math.max(1, totalH - viewH)) * (viewH - barH);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(W - 5, MENU_TOP, 3, viewH);
      ctx.fillStyle = 'rgba(78,201,176,0.6)';
      ctx.fillRect(W - 5, barY, 3, Math.max(vz(16), barH));
    }

    const { playX, playY, playW, playH } = getMenuPlayLayout();
    if (menuPlayReady) {
      ctx.fillStyle = '#0e639c';
      ctx.strokeStyle = '#3794ff';
      ctx.lineWidth = 2;
      ctx.fillRect(playX, playY, playW, playH);
      ctx.strokeRect(playX + 1, playY + 1, playW - 2, playH - 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${vz(13)}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PLAY', W / 2, playY + playH / 2);
    } else {
      ctx.fillStyle = 'rgba(180, 180, 186, 0.55)';
      ctx.font = `${vz(11)}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select a skin', W / 2, H - MENU_PLAY_RESERVE / 2);
    }

    ctx.restore();
  }

  function menuSkinAt(mx, my) {
    const { cols, pad, cellH, MENU_TOP, viewH } = menuMetrics();
    if (my < MENU_TOP || my > MENU_TOP + viewH) return null;
    const cellW = (W - pad * (cols + 1)) / cols;
    const innerY = my - MENU_TOP + menuScroll;
    const row = Math.floor(innerY / cellH);
    const col = cols === 1 ? 0 : Math.floor((mx - pad) / (cellW + pad));
    if (col < 0 || col >= cols) return null;
    const lx = pad + col * (cellW + pad);
    if (mx < lx || mx > lx + cellW) return null;
    const idx = cols === 1 ? row : row * cols + col;
    if (idx < 0 || idx >= SKINS.length) return null;
    return SKINS[idx];
  }

  function startGameFromSkin(skinId) {
    selectedSkin = skinId;
    if (vscodeApi) vscodeApi.postMessage({ type: 'setSkin', skin: selectedSkin });
    phase = 'play';
    setHudVisible(true);
    initWorld();
    canvas.focus();
  }

  function hitGameOver(mx, my) {
    const mid = W / 2;
    if (Math.abs(mx - mid) > vz(100)) return;
    if (my >= H / 2 + vz(4) && my <= H / 2 + vz(24)) {
      gameOver = false;
      deathReason = '';
      deathEnemyLabel = '';
      initWorld();
      canvas.focus();
      return;
    }
    if (my >= H / 2 + vz(28) && my <= H / 2 + vz(54)) {
      gameOver = false;
      deathReason = '';
      deathEnemyLabel = '';
      phase = 'menu';
      menuPlayReady = true;
      setHudVisible(false);
      clampMenuScroll();
    }
  }

  function draw(now) {
    if (phase === 'menu') drawMainMenu(now);
    else drawGame(now);
  }

  let last = 0;
  function frame(now) {
    const dt = last ? Math.min(now - last, 32) : 16;
    last = now;
    update(now, dt);
    draw(now);
    requestAnimationFrame(frame);
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.type === 'saveBoost') {
      if (phase !== 'play' || gameOver) return;
      playRocketVroom();
      rocketUntil = Date.now() + ROCKET_DURATION_MS;
      player.vy = Math.min(player.vy - 5, -22);
      spawnLegacyFlyby();
    }
  });

  canvas.addEventListener('click', (ev) => {
    ensureAudio();
    const r = canvas.getBoundingClientRect();
    const mx = ((ev.clientX - r.left) / r.width) * W;
    const my = ((ev.clientY - r.top) / r.height) * H;
    if (phase === 'menu') {
      if (hitMenuPlay(mx, my)) {
        startGameFromSkin(selectedSkin);
        return;
      }
      const s = menuSkinAt(mx, my);
      if (s) {
        selectedSkin = s.id;
        menuPlayReady = true;
      }
      return;
    }
    if (gameOver) hitGameOver(mx, my);
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      if (phase !== 'menu') return;
      e.preventDefault();
      menuScroll += e.deltaY * 0.6;
      clampMenuScroll();
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (phase === 'menu') {
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && menuPlayReady) {
        e.preventDefault();
        startGameFromSkin(selectedSkin);
      }
      return;
    }
    if (phase === 'play' && !gameOver) {
      if (e.code === 'Space') {
        e.preventDefault();
        tryShoot();
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        player.vx = -MOVE_SPEED;
        player.facing = -1;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        player.vx = MOVE_SPEED;
        player.facing = 1;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key)) {
      player.vx = 0;
    }
  });

  setHudVisible(false);
  requestAnimationFrame(frame);
})();
