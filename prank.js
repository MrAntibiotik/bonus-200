// ====== НАЛАШТУВАННЯ ======
const SILENT_SECONDS = 4;     // скільки секунд відео йде без звуку
const BOOST = 2.5;            // підсилення звуку (1 = як у файлі)
const DODGES = 7;             // скільки разів кнопка "Вимкнути звук" тікає від курсора
const MOAN_SECONDS = 5;       // скільки триває "завантаження приватного контенту" зі стогоном
const PANIC_SECONDS = 5;      // скільки триває фейкова паніка
const LOUD_SECONDS = 15;      // скільки секунд гачі грає зі звуком, потім — «Тебе розіграли»
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

function startPrivate() {
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

  const vid = $('vid');
  const hasVideo = !videoFailed && !vid.error;

  if (hasVideo) {
    vid.currentTime = 0;
    vid.play().catch(() => {});
    setTimeout(() => {
      if (done) return;
      try {
        const src = audioCtx.createMediaElementSource(vid);
        const gain = audioCtx.createGain();
        gain.gain.value = BOOST;
        src.connect(gain).connect(audioCtx.destination);
      } catch (e) { /* без підсилення — теж ок */ }
      vid.muted = false;
      vid.volume = 1;
      $('prank').classList.add('loud');
      setTimeout(() => { if (!done) finish(); }, LOUD_SECONDS * 1000);
    }, SILENT_SECONDS * 1000);
  } else {
    // Немає media/prank.mp4 — показуємо заглушку і генеруємо ор самі
    vid.hidden = true;
    $('fallback').hidden = false;
    setTimeout(() => {
      if (done) return;
      synthScream();
      $('prank').classList.add('loud');
      setTimeout(() => { if (!done) finish(); }, LOUD_SECONDS * 1000);
    }, SILENT_SECONDS * 1000);
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

/* ---------- кнопка, що тікає ---------- */
let dodges = 0;
const mute = $('mute');
function dodge(e) {
  if (dodges >= DODGES) return;
  dodges++;
  if (e.type === 'touchstart') e.preventDefault();
  const w = window.innerWidth - mute.offsetWidth - 16;
  const h = window.innerHeight - mute.offsetHeight - 16;
  mute.style.transform = 'none';
  mute.style.left = 8 + Math.random() * w + 'px';
  mute.style.top = 8 + Math.random() * h + 'px';
  mute.style.bottom = 'auto';
  const labels = ['😏 Не-а', '🔇 Ще раз', '🏃 Лови', '🔇 Майже', '🙃 Мимо', '🔇 Ну давай', '🔇 Вимкнути звук'];
  mute.textContent = labels[(dodges - 1) % labels.length];
}
mute.addEventListener('mouseenter', dodge);
mute.addEventListener('touchstart', dodge, { passive: false });
mute.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dodges < DODGES) return;
  finish();
});

function finish() {
  done = true;
  const vid = $('vid');
  vid.pause(); vid.muted = true;
  stopSynth();
  $('moan').pause();
  audioCtx && audioCtx.suspend();
  $('prank').classList.remove('loud');
  mute.hidden = true;
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
