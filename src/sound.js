// Efeitos sonoros gerados pelo navegador (não precisa de arquivos) + trilha em /musica.mp3
let ac, mu = null, muted = false;
const ctx = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
function tone(f, d, type = "sine", v = .12, sl = 0, dl = 0) {
  if (muted) return;
  try {
    const c = ctx(); if (c.state !== "running") { c.resume(); return; }   // contexto ainda bloqueado: não empilha osciladores que disparariam todos juntos depois
    const t = c.currentTime + dl, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (sl) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + sl), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
export const sfx = {
  eat: () => tone(700, .07, "triangle", .1, 350),
  pop: () => { tone(220, .1, "square", .05, 200); tone(440, .12, "triangle", .06, 0, .05); },
  boost: () => tone(110, .12, "sawtooth", .04, 60),
  death: () => { tone(400, .6, "sawtooth", .15, -330); tone(120, .7, "square", .08, -60, .1); },
  alert: () => { for (let i = 0; i < 3; i++) { tone(880, .12, "square", .07, 0, i * .25); tone(660, .12, "square", .07, 0, i * .25 + .12); } },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, "triangle", .14, 0, i * .15)),
  end: () => [392, 330, 262].forEach((f, i) => tone(f, .35, "triangle", .12, 0, i * .2)),
  click: () => tone(520, .05, "square", .06),
};
// som do aviso "bateu no seu rabo": coloque o arquivo rabo.mp3 na pasta public (se não existir, toca o alerta sintético)
let rb = null, rbBad = false, rbT = 0;
export function playRabo() {
  if (muted) return;
  const n = performance.now(); if (n - rbT < 800) return; rbT = n;
  if (rbBad) return sfx.alert();
  try { ctx().resume(); rb.currentTime = 0; rb.play().catch(() => sfx.alert()); } catch (e) { sfx.alert(); }
}
export function startMusic() {
  if (!rb) { rb = new Audio("/rabo.mp3"); rb.preload = "auto"; rb.onerror = () => { rbBad = true; };
    try { const c = ctx(), gn = c.createGain(); gn.gain.value = 1.4; c.createMediaElementSource(rb).connect(gn); gn.connect(c.destination); } catch (e) {} }   // rabo.mp3 40% mais alto (volume do <audio> já está no máximo, então o ganho de 1.4 é feito pelo WebAudio) }
  if (mu) return;
  mu = new Audio("/musica.mp3"); mu.loop = true; mu.volume = .1008; mu.muted = muted;   // volume .1008 = mais 40% mais baixa que .168 (originalmente .28)
  mu.play().catch(() => {});
}
export function toggleMute() { muted = !muted; if (mu) mu.muted = muted; return muted; }
