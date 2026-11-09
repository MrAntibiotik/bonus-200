// ====== НАЛАШТУВАННЯ ======
const BOOST = 2.5;            // підсилення звуку (1 = як у файлі)
const MAX_BUTTONS = 40;       // максимум кнопок-"закривашок" на екрані
const MOAN_SECONDS = 5;       // скільки триває "завантаження приватного контенту" зі стогоном
const PANIC_SECONDS = 5;      // скільки триває фейкова паніка
const FALLBACK_SECONDS = 15;  // скільки реве сирена, якщо немає media/prank.mp4
// ==========================

const $ = (id) => document.getElementById(id);
let done = false;
let started = false;
let audioCtx = null;
let videoFailed = false;
$('vid').addEventListener('error', () => { videoFailed = true; });

/* ---------- антураж банку ---------- */
let secs = 14 * 60 + 59;
setInterval(() => {
  secs = Math.max(0, secs - 1);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  $('timer').textContent = `00:${m}:${s}`;
}, 1000);

let left = 37;
setInterval(() => {
  if (left > 3 && Math.random() < 0.4) $('left').textContent = --left;
}, 2500);

$('openForm').onclick = () => { $('formModal').hidden = false; $('name').focus(); };
$('closeForm').onclick = () => { $('formModal').hidden = true; };

/* ---------- "реєстрація" (нічого нікуди не відправляється) ---------- */
$('register').onclick = () => {
  if (!$('robot').checked) {
    const c = document.querySelector('#formModal .card');
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    return;
  }
  startPrank();
};

function startPrank() {
  if (started) return;
  started = true;

  // Усе, що потребує кліку користувача, робимо ПРЯМО ЗАРАЗ
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  goFullscreen();
  const vid = $('vid');
  vid.muted = true;
  vid.play().catch(() => {});

  $('formModal').hidden = true;
  $('loading').hidden = false;

  const name = $('name').value.trim();
  const texts = ['Перевіряємо дані…', 'З’єднуємось з банком…', name ? `${name}, нараховуємо подарунок…` : 'Нараховуємо подарунок…'];
  texts.forEach((t, i) => setTimeout(() => { $('loadingText').textContent = t; }, i * 900));

  setTimeout(showAgeGate, texts.length * 900);
}

/* ---------- 18+ ---------- */
function showAgeGate() {
  $('loading').hidden = true;
  $('bank').hidden = true;
  $('age').hidden = false;
  window.scrollTo(0, 0);
}
document.querySelectorAll('#age .age-btn').forEach((b) => b.addEventListener('click', startPrivate));

let vidGain = null;
function unlockVideoAudio() {
  // Викликається прямо в кліку: дозволяє потім грати відео зі звуком (iOS теж)
  const vid = $('vid');
  try {
    const src = audioCtx.createMediaElementSource(vid);
    vidGain = audioCtx.createGain();
    vidGain.gain.value = 0;
    src.connect(vidGain).connect(audioCtx.destination);
  } catch (e) { vidGain = null; }
  vid.muted = false;
  if (!vidGain) vid.volume = 0;
  vid.play().then(() => vid.pause()).catch(() => {});
}

function startPrivate() {
  unlockVideoAudio();
  $('age').hidden = true;
  $('private').hidden = false;
  const moan = $('moan');
  moan.volume = 1;
  moan.play().catch(() => {});      // немає media/moan.mp3 — просто тиша
  const bar = $('privBar');
  let pct = 0;
  const iv = setInterval(() => {
    pct = Math.min(99, pct + Math.random() * 9);
    bar.style.width = pct + '%';
    $('privPct').textContent = Math.floor(pct) + '%';
  }, 250);
  setTimeout(() => { clearInterval(iv); startPanic(); }, MOAN_SECONDS * 1000);
}

/* ---------- фейкова паніка ---------- */
function startPanic() {
  const moan = $('moan');
  moan.pause();
  $('private').hidden = true;
  $('panic').hidden = false;
  const r = () => 10 + Math.floor(Math.random() * 240);
  $('fakeIp').textContent = `${r()}.${r()}.${r()}.${r()}`;
  synthScream();
  let pct = 0;
  const iv = setInterval(() => {
    pct = Math.min(100, pct + 4 + Math.random() * 6);
    $('sendPct').textContent = Math.floor(pct) + '%';
  }, 200);
  setTimeout(() => {
    clearInterval(iv);
    stopSynth();
    $('panicTitle').textContent = 'ЖАРТУЮ 😏';
    $('panicBody').hidden = true;
    setTimeout(() => { $('panic').hidden = true; reveal(); }, 1300);
  }, PANIC_SECONDS * 1000);
}


function reveal() {
  $('prank').hidden = false;
  $('prank').classList.add('loud');
  spawnButton(); spawnButton(); spawnButton();

  const vid = $('vid');
  if (!videoFailed && !vid.error) {
    vid.currentTime = 0;
    vid.muted = false;
    if (vidGain) vidGain.gain.value = BOOST; else vid.volume = 1;
    vid.play().catch(() => {});
    vid.addEventListener('ended', finish, { once: true });   // кінець відео — кінець пранку
  } else {
    vid.hidden = true;
    $('fallback').hidden = false;
    synthScream();
    setTimeout(finish, FALLBACK_SECONDS * 1000);
  }
}

/* ---------- синтезований "ор", якщо відео немає ---------- */
let synthNodes = [];
function synthScream() {
  const t = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 0.9;
  master.connect(audioCtx.destination);

  // сирена
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 3;
  lfoGain.gain.value = 400;
  osc.frequency.value = 700;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.connect(master);

  // шум
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const ng = audioCtx.createGain(); ng.gain.value = 0.35;
  noise.connect(ng).connect(master);

  osc.start(t); lfo.start(t); noise.start(t);
  synthNodes = [osc, lfo, noise];
}
function stopSynth() {
  synthNodes.forEach((n) => { try { n.stop(); } catch (_) {} });
  synthNodes = [];
}

/* ---------- фулскрін, який повертається ---------- */
function goFullscreen() {
  const el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el)?.catch?.(() => {});
}
document.addEventListener('click', () => {
  if (started && !done && !document.fullscreenElement && !document.webkitFullscreenElement) goFullscreen();
});

window.addEventListener('beforeunload', (e) => {
  if (started && !done) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- кнопки "закриття", жодна з яких не працює ---------- */
const LABELS = ['✕', '🔇 Вимкнути звук', 'Закрити', 'STOP', '⏸ Пауза', '❌ Вийти', '🔇', 'Вимкнути!!!', 'Назад', 'ОК', 'Скасувати', '🙏 Будь ласка'];
const TRICKS = ['jump', 'flip', 'spin', 'mirror', 'shrink', 'multiply'];
const layer = $('buttons');
const rnd = (a, b) => a + Math.random() * (b - a);

function place(btn) {
  btn.style.left = rnd(4, Math.max(8, window.innerWidth - btn.offsetWidth - 4)) + 'px';
  btn.style.top = rnd(4, Math.max(8, window.innerHeight - btn.offsetHeight - 4)) + 'px';
}

function spawnButton(near) {
  if (done || layer.children.length >= MAX_BUTTONS) return;
  const b = document.createElement('button');
  b.className = 'fake';
  b.textContent = LABELS[Math.floor(Math.random() * LABELS.length)];
  b.dataset.trick = TRICKS[Math.floor(Math.random() * TRICKS.length)];
  layer.appendChild(b);
  if (near) {
    b.style.left = Math.min(window.innerWidth - b.offsetWidth - 4, Math.max(4, near.offsetLeft + rnd(-90, 90))) + 'px';
    b.style.top = Math.min(window.innerHeight - b.offsetHeight - 4, Math.max(4, near.offsetTop + rnd(-90, 90))) + 'px';
  } else place(b);
  b.addEventListener('mouseenter', () => trick(b, false));
  b.addEventListener('touchstart', (e) => { e.preventDefault(); trick(b, true); }, { passive: false });
  b.addEventListener('click', (e) => { e.stopPropagation(); trick(b, true); });
}

function trick(b, pressed) {
  if (done) return;
  const t = b.dataset.trick;
  b.classList.remove('flip', 'spin', 'mirror', 'shrink', 'boing');
  void b.offsetWidth;
  if (t === 'jump') place(b);
  else if (t === 'multiply') { spawnButton(b); spawnButton(b); if (pressed) spawnButton(b); }
  else b.classList.add(t);
  b.classList.add('boing');
  // будь-яке натискання ще й плодить нову кнопку і міняє фокус кнопки
  if (pressed) {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) goFullscreen();
    spawnButton();
    b.dataset.trick = TRICKS[Math.floor(Math.random() * TRICKS.length)];
    b.textContent = ['😏 Не-а', '🙃 Мимо', '🤡 Ха', '👀 Ще?', '🫵 Лох'][Math.floor(Math.random() * 5)];
    setTimeout(() => { b.textContent = LABELS[Math.floor(Math.random() * LABELS.length)]; }, 700);
  }
}

// кнопки розбігаються самі по собі
setInterval(() => {
  if (done || $('prank').hidden) return;
  const all = layer.children;
  if (all.length) place(all[Math.floor(Math.random() * all.length)]);
  if (Math.random() < 0.3) spawnButton();
}, 1200);

function finish() {
  if (done) return;
  done = true;
  const vid = $('vid');
  vid.pause(); vid.muted = true;
  stopSynth();
  $('moan').pause();
  audioCtx && audioCtx.suspend();
  $('prank').classList.remove('loud');
  layer.hidden = true;
  $('gotcha').hidden = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

$('copyLink').onclick = () => {
  const url = location.href.split('#')[0];
  navigator.clipboard?.writeText(url).then(
    () => { $('copyLink').textContent = 'Скопійовано ✅'; },
    () => { prompt('Скопіюй посилання:', url); }
  );
};

/* ---------- пасхалки ---------- */
function showEgg() { $('egg').hidden = false; }
$('closeEgg').onclick = () => { $('egg').hidden = true; };
$('egg-dot').onclick = showEgg;                 // крапка після «© 2026 ШедіБанк»

let logoClicks = 0;
$('logo').onclick = () => { if (++logoClicks === 5) { logoClicks = 0; showEgg(); } };  // 5 кліків по лого

let typed = '';
document.addEventListener('keydown', (e) => {   // набрати "shedy" на клавіатурі
  typed = (typed + e.key.toLowerCase()).slice(-5);
  if (typed === 'shedy') showEgg();
});

console.log('%cЕй, хакере 👀 Набери "shedy" на сторінці.', 'font-size:16px;color:#1b5cff');
