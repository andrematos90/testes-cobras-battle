import { SK, FE, C, head, sHead, esc, condomIcon, condomSleeve, condomGeo, condomShed, pillIcon, wiggle, drawBody, WAVE_STEP, cardIcon, CARD_COL } from "./draw.js";
import { CHAO_URL } from "./chaoData.js";
import { makeTile } from "./terrain.js";
import { sfx, playRabo } from "./sound.js";
import { WD, NSEL, NH, LIVES, TAPER, TICK, INV_TIME, VIEW_SPAN } from "../shared/config.js";

// as fotos originais têm ~1250x1250 px (1 MB cada). Desenhar isso reduzido a cada quadro era pesado: ao carregar, guardamos uma miniatura quadrada 256x256 (m.sm) e só ela é usada no jogo
// as cabeças são carregadas só quando alguém precisa delas (são 15 fotos grandes: no lobby carrega a que está sendo vista e as vizinhas; no jogo, só as dos jogadores)
const IMGS = [];
export const getImg = k => IMGS[k] || (IMGS[k] = (() => {
  const m = new Image(); m.decoding = "async";
  m.onload = () => { const q = Math.min(m.naturalWidth, m.naturalHeight), c = document.createElement("canvas"); c.width = c.height = 256; const t = c.getContext("2d"); t.imageSmoothingQuality = "high"; t.drawImage(m, (m.naturalWidth - q) / 2, (m.naturalHeight - q) / 2, q, q, 0, 0, 256, 256); m.sm = c; };
  m.src = "/cobra" + (k + 1) + ".png"; return m;   // se a foto não existir (ainda), a cobra usa a cabeça padrão com olhos
})());
// imagens dos cards: card1.png (diminui) e card2.png (cresce) na pasta public (se faltar alguma, aparece um card genérico colorido com o número)
export const CARD_IMGS = [0, 1].map(i => {
  const m = new Image(); m.decoding = "async";
  m.onload = () => { const k = Math.min(1, 320 / Math.max(m.naturalWidth, m.naturalHeight)), c = document.createElement("canvas"); c.width = Math.max(1, m.naturalWidth * k | 0); c.height = Math.max(1, m.naturalHeight * k | 0); const t = c.getContext("2d"); t.imageSmoothingQuality = "high"; t.drawImage(m, 0, 0, c.width, c.height); m.sm = c; };
  m.src = "/card" + (i + 1) + ".png"; return m;
});
export const ST = { snakes: new Map(), food: [], m: [], l: [], lv: 0 };
export function resetStore(m) {
  Object.assign(ST, { fl: {}, hm: 0, tr: m.tr || "stone", you: m.you, names: m.names, sk: m.sk, heads: m.heads, snakes: new Map(), food: [], m: [], l: [], lv: 0, x: 0, y: 0, al: 1, ag: 0, md: m.md, tl: 600, n: 50, lf: m.md === "elim" ? LIVES : -1, hp: 0, shed: [], pw: [], pl: [], hits: [], tails: [], P: null, kl: 0, pb: 2.2, jv: 0, la: performance.now(), lastC: 0, shake: 0, dead: false, drops: 0, tp: 0, te: 0 });
}

export const CHAO = new Image(); CHAO.src = CHAO_URL;
// ---- efeitos visuais (só no navegador) ----
const PS = [], RG = [];
function spark(x, y, col, n, sp, life) {
  for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, v = (.4 + Math.random()) * sp; PS.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: life * (.6 + Math.random() * .6), m: life, c: col, s: 2 + Math.random() * 3 }); }
  if (PS.length > 700) PS.splice(0, PS.length - 700);
}
function boom(x, y, i) {
  const c = SK[ST.sk[i]].c;
  spark(x, y, c, 36, 9, 40); spark(x, y, "#ffffff", 14, 12, 28); spark(x, y, "#39ff14", 14, 7, 45);
  RG.push({ x, y, r: 10, l: 22, m: 22, c });
  const me = ST.snakes.get(ST.you);
  if (i === ST.you) ST.shake = Math.max(ST.shake, 22);
  else if (me && Math.hypot(me.cur[0] - x, me.cur[1] - y) < 400) ST.shake = Math.max(ST.shake, 9);
}
const FALL = new Map();   // sorvetes caindo: posição -> instante em que apareceram
const EMO = [];   // cada emoji da comida vira um sprite 1 vez (fillText de emoji com escala nova a cada quadro re-rasteriza a fonte colorida = lento)
const emo = k => EMO[k] || (EMO[k] = (() => { const c = document.createElement("canvas"); c.width = c.height = 80; const t = c.getContext("2d"); t.font = "60px sans-serif"; t.textAlign = "center"; t.textBaseline = "middle"; t.fillText(FE[k], 40, 42); return c; })());
const R = c => 10 + Math.min(c, 30) * 1.5 + Math.max(0, c - 30) * .3;

export function onSnap(m) {
  ST.x = m.x; ST.y = m.y; ST.al = m.al; ST.sp = m.sp; ST.hd = m.hd; ST.on = m.on; ST.tl = m.tl; ST.n = m.n; ST.m = m.m; ST.food = m.f;
  ST.ag = m.ag; ST.lf = m.lf; ST.hp = m.hp; ST.pw = m.pw; ST.pl = m.pl; ST.cd = m.cd || [];
  for (const [x, y, i, t] of m.cp || []) {   // alguém pegou um card
    spark(x, y, CARD_COL[t] || "#fff", 30, 8, 40); spark(x, y, "#ffffff", 16, 6, 30);
    if (i === ST.you) sfx.pop();
  }
  for (const [x, y, i] of m.pp || []) {   // alguém pegou a pílula Tadala
    spark(x, y, "#38bdf8", 26, 7, 36); spark(x, y, "#fde047", 16, 6, 32);
    if (i === ST.you) sfx.pop();
  }
  for (const [x, y, i, h] of m.pop || []) {
    if (h > 0) spark(x, y, "#ffffff", 14, 6, 26);
    else {   // estourou: a camisinha fica no chão com a ponta rasgada
      spark(x, y, "#ffffff", 40, 10, 50); spark(x, y, "#fbcfe8", 24, 8, 44); ST.shake = 6;
      const s0 = ST.snakes.get(i); if (s0) { const im0 = i < NSEL && ST.heads[i] >= 0 ? getImg(ST.heads[i]) : null, hd0 = im0 && im0.sm ? 50 : R(s0.c) * 1.5; ST.shed.push({ ...condomGeo(s0.cur, s0.a, R(s0.c), hd0), t0: performance.now() }); }
    }
    if (i === ST.you) sfx.pop();
  }
  for (const [x, y, i] of m.pk || []) { spark(x, y, "#ffffff", 24, 7, 36); spark(x, y, "#fbcfe8", 14, 5, 30); if (i === ST.you) sfx.pop(); }
  for (const [x, y, i] of m.ea || []) spark(x, y, SK[ST.sk[i]].c, i === ST.you ? 7 : 4, 4, 22);
  for (const [x, y, i] of m.dx || []) { boom(x, y, i); if (i === ST.you) sfx.death(); }   // a selecionável renasce na hora: o som vem do evento de morte
  for (const [x, y, i] of m.ht || []) ST.hits.push([x, y, i]);   // alguém bateu no meu corpo (o aviso só aparece se foi fora da tela)
  // buffer de reprodução: guarda os últimos snapshots (k = número do tick do servidor). O cabeçote ST.P (em ticks) anda um pouco atrás do snapshot mais novo
  // e muda de velocidade de leve (ver loop) para absorver oscilação da rede e engasgos do servidor sem congelar
  const arr = performance.now(); ST.jv += (Math.abs(arr - ST.la - TICK) - ST.jv) * .05; ST.la = arr; ST.pb = Math.min(4, 2.2 + ST.jv / 30);
  ST.kl = m.k; if (ST.P == null) ST.P = m.k - ST.pb;
  const seen = new Set();
  for (const [i, c, a, p, sh, iv, tn, sf] of m.ns) {
    seen.add(i); let s = ST.snakes.get(i);
    const e = { k: m.k, p: Float32Array.from(p) };
    if (!s) { s = { h: [e], cur: new Float32Array(e.p.length), w: new Float32Array(e.p.length), ph: 0 }; ST.snakes.set(i, s); }
    else { s.h.push(e); if (s.h.length > 14) s.h.shift(); }
    s.c = c / 10; s.a = a; s.sh = sh; s.iv = iv || 0; s.tn = tn || p.length / 2; s.sf = sf || 0;   // tn: total de pontos do corpo (o servidor manda só o trecho perto da tela)
  }
  for (const k of [...ST.snakes.keys()]) if (!seen.has(k)) ST.snakes.delete(k);
  const me = ST.snakes.get(ST.you), now = performance.now();
  if (me) { if (me.c > ST.lastC && now - ST.te > 50) { sfx.eat(); ST.te = now; } ST.lastC = me.c; }
  if (!m.al && !ST.dead) { ST.dead = true; sfx.death(); }
  let d = 0; for (let k = 2; k < m.f.length; k += 3) if (m.f[k] === 4) d++;
  if (d > ST.drops + 3 && now - ST.tp > 400) { sfx.pop(); ST.tp = now; } ST.drops = d;
}

// banner grande no meio da tela (faltam 60 s, mini-eventos...)
let bnEl = null, bnT = 0;
export function banner(h, col, ms = 3200) {
  if (!bnEl) return;
  bnEl.innerHTML = h; bnEl.style.color = col || "#fff"; bnEl.classList.remove("on"); void bnEl.offsetWidth; bnEl.classList.add("on");
  clearTimeout(bnT); bnT = setTimeout(() => bnEl && bnEl.classList.remove("on"), ms);
}
// aviso "fulano entrou/saiu da partida" (mesmo estilo do aviso de batida no rabo)
export function onEvent(m) {
  if (m.sk != null) ST.sk[m.i] = m.sk;
  if (m.h != null) { ST.heads[m.i] = m.h; ST.names[m.i] = m.nm || ST.names[m.i]; }   // quem entrou traz a cabeça e o nome que escolheu
  if (m.k === "hd") return;   // troca silenciosa de cabeça/nome de um bot
  ST.tails.push({ h: `<span style="color:#4ade80">${esc(ST.names[m.i])}</span> ${m.k === "in" ? "entrou na partida" : m.k === "die" ? "broxou!" : "saiu da partida"}`, until: performance.now() + 3000 });
}

const RABO_SND_MAX_CM = 35, ALERT_BIG_CM = 120, ALERT_GAP = 8000;   // som do rabo só até 35 cm; acima de 120 cm os alertas visuais têm intervalo de 8 s

export function runGame(cv, { hud, sc, dd, fin, tail, bn, vg, send }) {
  bnEl = bn; let lastVg = "";
  const g = cv.getContext("2d", { alpha: false });   // canvas opaco: o navegador não precisa compor transparência (mais leve no PC)
  let TILE = null, TILE_K = null, VW, VH, raf, fr = 0, lv = -1, lt = performance.now(), ainit = false; const cam = { x: ST.x, y: ST.y }; let zk = 1;
  const mob = matchMedia("(pointer:coarse)").matches; let sal = 0;   // celular/tablet: interface menor, zoom mais aberto, tela sempre ligada
  const rs = () => { VW = cv.width = innerWidth; VH = cv.height = innerHeight; sal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sal")) || 0; }; rs();
  let lastTail = "", lastSc = "", lastAlert = -1e9;
  const zb = () => Math.max(mob ? .7 : .9, Math.min(1.5, Math.min(VW, VH) / (mob ? 520 : 450))), zm = () => zb() * zk;
  let wl = null; const lock = () => navigator.wakeLock?.request("screen").then(l => { wl = l; }).catch(() => {});
  if (mob) { lock(); document.addEventListener("visibilitychange", lock); }
  const inp = { a: 0, b: false }, ky = {}, joy = { on: false, id: null, x: 0, y: 0, px: 0, py: 0 }; let kto, bid = null;
  const anyK = () => ky.l || ky.r || ky.u || ky.d;
  const mv = e => {
    if (e.pointerType === "touch") {
      if (joy.on && e.pointerId === joy.id) { const dx = e.clientX - joy.x, dy = e.clientY - joy.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 50 / d); joy.px = dx * k; joy.py = dy * k; if (d > 8) inp.a = Math.atan2(dy, dx); }
      return;
    }
    if (anyK()) return; inp.a = Math.atan2(e.clientY - VH / 2, e.clientX - VW / 2);
  };
  const pd = e => {
    const t = e.target; if (t.closest && t.closest("#mt, #fs, #out, #fin, #voice")) return;
    if (t.closest && t.closest("#bt")) { inp.b = true; bid = e.pointerId; return; }
    if (e.pointerType === "touch") { if (!joy.on) { joy.on = true; joy.id = e.pointerId; joy.x = e.clientX; joy.y = e.clientY; joy.px = joy.py = 0; } }
    else { mv(e); inp.b = true; }
  };
  const pu = e => { if (e.pointerId === bid) { inp.b = false; bid = null; return; } if (e.pointerType === "touch") { if (e.pointerId === joy.id) joy.on = false; } else inp.b = false; };
  const KM = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", KeyA: "l", KeyD: "r", KeyW: "u", KeyS: "d" };
  const BK = ["Space", "ShiftLeft", "ShiftRight"];
  const kd = e => { if (e.code === "F3") { dbg = !dbg; e.preventDefault(); return; } if (BK.includes(e.code)) { e.preventDefault(); if (!e.repeat) inp.b = true; } else if (KM[e.code]) { e.preventDefault(); if (!e.repeat) ky[KM[e.code]] = true; } };
  const ku = e => { if (BK.includes(e.code)) inp.b = false; else if (KM[e.code]) ky[KM[e.code]] = false; };
  let dbg = false, dms = 0, fps = 0, fw = performance.now(), fc = 0;   // F3: mostra FPS e tempo de desenho (ajuda a achar o que pesa no seu PC)
  const bl = () => { ky.l = ky.r = ky.u = ky.d = false; inp.b = false; };
  const W = window;
  W.addEventListener("resize", rs); W.addEventListener("pointermove", mv); W.addEventListener("pointerdown", pd); W.addEventListener("pointerup", pu);
  W.addEventListener("pointercancel", pu); W.addEventListener("keydown", kd); W.addEventListener("keyup", ku); W.addEventListener("blur", bl);
  const si = setInterval(() => send({ t: "in", a: +inp.a.toFixed(2), b: inp.b, k: !!anyK() }), 33);
  const bi = setInterval(() => { if (inp.b && ST.al) sfx.boost(); }, 140);

  function draw() {
    const me = ST.snakes.get(ST.you);
    const P = ST.P;
    for (const s of ST.snakes.values()) {
      const h = s.h; let b = h.length - 1; while (b > 0 && h[b - 1].k >= P) b--;   // h[b] = primeiro snapshot com k >= P
      const e1 = h[b], e0 = h[Math.max(0, b - 1)], a0 = e0.p, a1 = e1.p;
      let al = b > 0 ? Math.min(1, Math.max(0, (P - e0.k) / (e1.k - e0.k))) : 1;
      if (Math.hypot(a0[0] - a1[0], a0[1] - a1[1]) > 300) al = 1;   // renasceu em outro ponto: sem interpolar o "teletransporte"
      if (s.cur.length !== a1.length) s.cur = new Float32Array(a1.length);
      const c = s.cur; for (let k = 0; k < c.length; k++) c[k] = k < a0.length ? a0[k] + (a1[k] - a0[k]) * al : a1[k];
    }
    const spS = !me && ST.sp >= 0 ? ST.snakes.get(ST.sp) : null;   // morto: acompanha a maior cobra
    if (me) { cam.x = me.cur[0]; cam.y = me.cur[1]; } else if (spS) { cam.x += (spS.cur[0] - cam.x) * .1; cam.y += (spS.cur[1] - cam.y) * .1; } else { cam.x += (ST.x - cam.x) * .1; cam.y += (ST.y - cam.y) * .1; }
    zk += (Math.min(1, Math.min(VW, VH) / VIEW_SPAN(me ? me.c : spS ? spS.c : 0) / zb()) - zk) * .04;   // afasta/aproxima a câmera suavemente conforme o tamanho da cobra que está sendo vista
    const z = zm(), hw = VW / 2 / z + 80, hh = VH / 2 / z + 80, cx = cam.x, cy = cam.y;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#0b1020"; g.fillRect(0, 0, VW, VH);
    const sx = (Math.random() - .5) * ST.shake * 2, sy = (Math.random() - .5) * ST.shake * 2;
    g.translate(VW / 2 + sx, VH / 2 + sy); g.scale(z, z); g.translate(-cx, -cy);
    if (TILE_K !== ST.tr) { TILE_K = ST.tr; TILE = null; }   // terreno escolhido pelo admin: pedra (imagem), areia ou grama (geradas por código)
    if (!TILE && ST.tr && ST.tr !== "stone") TILE = makeTile(ST.tr);
    else if (!TILE && CHAO.complete && CHAO.naturalWidth) { TILE = document.createElement("canvas"); TILE.width = TILE.height = 256; const tg = TILE.getContext("2d"); tg.drawImage(CHAO, 0, 0, 256, 256); tg.fillStyle = "rgba(11,16,32,.25)"; tg.fillRect(0, 0, 256, 256); }
    if (TILE) for (let gx = Math.floor((cx - hw) / 256); gx * 256 < cx + hw; gx++) for (let gy = Math.floor((cy - hh) / 256); gy * 256 < cy + hh; gy++) g.drawImage(TILE, gx * 256, gy * 256, 257, 257); g.strokeStyle = "#ef4444"; g.lineWidth = 10; g.strokeRect(-WD / 2, -WD / 2, WD, WD);
        g.textAlign = "center";
    const f = ST.food, ft = performance.now() / 260;
    for (let k = 0; k < f.length; k += 3) {
      const x = f[k], y = f[k + 1]; if (Math.abs(x - cx) > hw || Math.abs(y - cy) > hh) continue;
      const pl = 1 + .15 * Math.sin(ft + x * .013 + y * .017);   // cada comida pulsa em um ritmo defasado
      if (f[k + 2] === 4) { g.fillStyle = "#39ff1455"; C(g, x, y, 24 * pl); g.fillStyle = "#39ff14"; C(g, x, y, 15 * pl); g.fillStyle = "#eaffe0"; C(g, x - 5 * pl, y - 5 * pl, 5 * pl); }
      else if (f[k + 2] === 6) {   // sorvete caindo do céu: cai acelerando (~0,9 s) com sombra crescendo no chão e um respingo ao pousar
        const key = x * 20011 + y; let t0 = FALL.get(key); if (t0 == null) { if (FALL.size > 400) FALL.clear(); FALL.set(key, t0 = performance.now()); }
        const u = Math.min(1, (performance.now() - t0) / 900), oy = -720 * (1 - u * u);
        g.fillStyle = "rgba(0,0,0," + (.08 + .22 * u).toFixed(2) + ")"; g.beginPath(); g.ellipse(x, y + 12, 8 + 16 * u, 3 + 6 * u, 0, 0, 6.2832); g.fill();
        if (u > .2 && u < 1) { g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + oy - 70 * (1 - u)); g.lineTo(x, y + oy - 20); g.stroke(); }   // rastro de queda
        const sz = 48 * (.7 + .3 * u); g.globalAlpha = Math.min(1, .3 + u * 1.2); g.drawImage(emo(5), x - sz / 2, y + oy - sz / 2, sz, sz); g.globalAlpha = 1;
        if (u >= 1 && !FALL.get("d" + key)) { FALL.set("d" + key, 1); spark(x, y, "#fde68a", 5, 2.2, 18); }
      }
      else { g.fillStyle = "rgba(255,255,255,.14)"; C(g, x, y, 22 * pl); const sz = 48 * pl; g.drawImage(emo(f[k + 2]), x - sz / 2, y - sz / 2, sz, sz); }
    }
    for (let k = 0; k < ST.pw.length; k++) { const q = ST.pw[k]; if (Math.abs(q[0] - cx) < hw + 80 && Math.abs(q[1] - cy) < hh + 80) condomIcon(g, q[0], q[1], 110, performance.now()); }
    for (const q of ST.pl) if (Math.abs(q[0] - cx) < hw + 80 && Math.abs(q[1] - cy) < hh + 80) pillIcon(g, q[0], q[1], 110, performance.now());
    for (const q of ST.cd || []) if (Math.abs(q[0] - cx) < hw + 120 && Math.abs(q[1] - cy) < hh + 120) cardIcon(g, q[0], q[1], 130, performance.now(), q[2], CARD_IMGS[q[2]], q[3]);
    for (const sd of ST.shed) { const q = sd.pts[1] || sd.pts[0]; if (Math.abs(q[0] - cx) < hw + 300 && Math.abs(q[1] - cy) < hh + 300) condomShed(g, sd, performance.now()); }
    g.textBaseline = "alphabetic";
    const now2 = performance.now(), VB = [cx - hw, cx + hw, cy - hh, cy + hh];
    for (const [i, s] of ST.snakes) {
      const r = R(s.c), d = SK[ST.sk[i]].d, c = s.cur, n = c.length / 2;
      const im = i < NSEL && ST.heads[i] >= 0 ? getImg(ST.heads[i]) : null, ph = im && im.sm, hd = ph ? 50 : r * 1.5;   // hd = raio da cabeça
      if (s.iv > 0 && (INV_TIME - s.iv / 100) % .8 >= .4) g.globalAlpha = .25;   // renasceu: pisca 3 vezes (fantasma)
      const tn = s.tn || n;
      if (!s.w || s.w.length !== c.length) s.w = new Float32Array(c.length);
      if (s.lx !== undefined) { const dd = Math.hypot(c[0] - s.lx, c[1] - s.ly); if (dd < 300) s.ph += WAVE_STEP(r, dd); }   // a onda anda conforme a cabeça anda (parou = não ondula)
      s.lx = c[0]; s.ly = c[1];
      const w = wiggle(c, n, tn, r, s.ph, s.w);   // ondulação de serpente (só visual)
      if (s.sh > 0) condomSleeve(g, w, s.a, r, hd, s.sh, 0);
      s.pa = s.sf ? 0 : 1;   // Tadala ativa: o pulsar para na hora e o corpo fica duro
      if (s.sf) { if (s.ft == null) s.ft = now2; } else s.ft = null;   // Tadala: congela também o relógio das cores (o arco-íris para de correr/brilhar)
      drawBody(g, w, n, tn, r, ST.sk[i], s.sf ? s.ft : now2, VB, s.pa);
      if (im) head(g, c[0], c[1], s.a, r, ST.sk[i], im); else sHead(g, c[0], c[1], s.a, r, SK[ST.sk[i]].c);
      if (s.sh > 0) condomSleeve(g, w, s.a, r, hd, s.sh, 1);
      g.globalAlpha = 1;
      g.fillStyle = "#fff"; g.font = "bold 14px system-ui";
      g.fillText(ST.names[i], c[0], c[1] - hd - 6);
      if (i < NSEL && ST.heads[i] === 6) {   // cabeça cobra7.png: frase piscando em cima do nome
        if (((performance.now() / 450) | 0) % 2 === 0) { g.font = "bold 15px system-ui"; g.lineWidth = 4; g.lineJoin = "round"; g.strokeStyle = "#000"; g.fillStyle = "#fde047"; g.strokeText("Vai regular comida pro Down?", c[0], c[1] - hd - 26); g.fillText("Vai regular comida pro Down?", c[0], c[1] - hd - 26); }
      }
    }
    for (const r of RG) { const a = r.l / r.m; g.globalAlpha = a; g.strokeStyle = r.c; g.lineWidth = 5 * a + 1; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 6.2832); g.stroke(); }
    for (const p of PS) { const a = Math.max(0, p.l / p.m); g.globalAlpha = a; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s * (a + .3), 0, 6.2832); g.fill(); }
    g.globalAlpha = 1;
    // minimapa
    g.setTransform(1, 0, 0, 1, 0, 0);
    const ms = mob ? Math.min(90, VH * .27) : Math.min(480, VH * .5, VW * .34), mx = (mob ? 10 : 12) + sal, my = VH - ms - (mob ? 8 : 12), k = ms / WD, M = v => (v + WD / 2) * k, u = mob ? 1 : Math.max(1, ms / 240);   // PC: minimapa grande (até 480px) e translúcido
    g.globalAlpha = mob ? 1 : .42;
    g.fillStyle = "#000a"; g.fillRect(mx, my, ms, ms); g.strokeStyle = "#fff8"; g.lineWidth = 2; g.strokeRect(mx, my, ms, ms);
    g.save(); g.beginPath(); g.rect(mx, my, ms, ms); g.clip();
    for (const [i, x, y] of ST.m) {
      const s = ST.snakes.get(i), mine = i === ST.you; g.strokeStyle = SK[ST.sk[i]].c;
      if (s) { g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = Math.max((mine ? 3 : 2) * u, R(s.c) * 2 * k); g.beginPath(); for (let j = 0; j < s.cur.length; j += 2) { const px = mx + M(s.cur[j]), py = my + M(s.cur[j + 1]); j ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
      const hx = mx + M(x), hy = my + M(y);
      if (mine) { g.strokeStyle = "#fff"; g.lineWidth = 2 * u; g.beginPath(); g.arc(hx, hy, 8 * u, 0, 6.2832); g.stroke(); } else { g.fillStyle = SK[ST.sk[i]].c; C(g, hx, hy, 3.5 * u); }
    }
    g.restore(); g.globalAlpha = 1;
    if (joy.on) { g.strokeStyle = "#fff6"; g.lineWidth = 3; g.beginPath(); g.arc(joy.x, joy.y, 50, 0, 6.2832); g.stroke(); g.fillStyle = "#fff8"; C(g, joy.x + joy.px, joy.y + joy.py, 22); }
  }
  function loop() {
    const now = performance.now(), dts = Math.min(.1, (now - lt) / 1000); lt = now;
    const m0 = ST.snakes.get(ST.you); if (!ainit && m0) { inp.a = m0.a; ainit = true; }
    // ← → (A D) sozinhas: giram a cobra enquanto seguradas. ↑ ↓ (W S): apontam para cima/baixo, e junto com ← → fazem a diagonal.
    const dx = (ky.r ? 1 : 0) - (ky.l ? 1 : 0), dy = (ky.d ? 1 : 0) - (ky.u ? 1 : 0);
    if (dy) { const t = Math.atan2(dy, dx), d = Math.atan2(Math.sin(t - inp.a), Math.cos(t - inp.a)), st = 6 * dts; inp.a += Math.max(-st, Math.min(st, d)); }
    else if (dx) inp.a += dx * 4 * dts;
    inp.a = Math.atan2(Math.sin(inp.a), Math.cos(inp.a));
    if (ST.P != null) {   // cabeçote de reprodução: ~1 tick a cada 40 ms, acelera/desacelera até 50% para manter a folga (pb ticks) e nunca passa do snapshot mais novo
      const lead = ST.kl - ST.P;
      ST.P = lead > 10 ? ST.kl - ST.pb : Math.min(ST.kl, ST.P + dts * 1000 / TICK * (1 + Math.max(-.5, Math.min(.5, (lead - ST.pb) * .2))));
    }
    const f = dts * 60;
    for (const p of PS) { p.x += p.vx * f; p.y += p.vy * f; const d = Math.pow(.94, f); p.vx *= d; p.vy *= d; p.l -= f; }
    for (let k = PS.length - 1; k >= 0; k--) if (PS[k].l <= 0) PS.splice(k, 1);
    for (const r of RG) { r.r += 6 * f; r.l -= f; }
    for (let k = RG.length - 1; k >= 0; k--) if (RG[k].l <= 0) RG.splice(k, 1);
    ST.shake *= Math.pow(.9, f); if (ST.shake < .3) ST.shake = 0;
    for (const [x, y, i] of ST.hits.splice(0)) { const z = zm(); if (Math.abs(x - cam.x) > VW / 2 / z || Math.abs(y - cam.y) > VH / 2 / z) {   // batida fora da tela
      if (ST.lastC > ALERT_BIG_CM && now - lastAlert < ALERT_GAP) continue;   // cobra muito grande: no máximo 1 alerta a cada 8 s, mesmo com mais batidas
      lastAlert = now; ST.tails.push({ h: `<span style="color:#4ade80">${esc(ST.names[i])}</span> bateu no seu rabo`, until: now + 3000 });
      if (ST.lastC <= RABO_SND_MAX_CM) playRabo();   // acima de 35 cm só o aviso visual (o som tocaria direto)
    } }
    const t0 = performance.now();
    try { draw(); } catch (e) { if (!loop.err) { loop.err = 1; console.error("erro ao desenhar:", e); } }   // um erro não pode congelar o jogo
    dms += (performance.now() - t0 - dms) * .1; fc++; if (now - fw >= 1000) { fps = fc * 1000 / (now - fw); fc = 0; fw = now; }
    if (dbg) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#000c"; g.fillRect(VW / 2 - 150, 4, 300, 22); g.fillStyle = "#4ade80"; g.font = "bold 13px monospace"; g.textAlign = "center"; g.fillText("FPS " + fps.toFixed(0) + " | desenho " + dms.toFixed(1) + " ms | jitter " + ST.jv.toFixed(1) + " ms", VW / 2, 19); }
    if (++fr % 10 === 0) {
      const tl = ST.tl;
      // avisos de tensão: reta final no modo por tempo; última vida e duelo final no modo eliminação (cada um aparece uma vez por partida)
      if (tl >= 0) for (const t of [60, 30, 10]) if (tl <= t && tl > t - 6 && !ST.fl[t]) { ST.fl[t] = 1; banner(t === 60 ? "⏳ Falta 1 minuto!" : t === 30 ? "⏳ 30 segundos!" : "🔥 Últimos 10 segundos!", t === 10 ? "#f87171" : "#fbbf24", t === 10 ? 3000 : 2600); }
      if (ST.lf === 0 && ST.al && !ST.fl.last) { ST.fl.last = 1; banner("💔 Última vida!", "#f87171"); }
      // bordas vermelhas piscando nos 4 cantos: últimos 60 s (mais rápido nos últimos 10), última vida ou duelo final
      const lvl = tl >= 0 && tl <= 10 ? 2 : (tl >= 0 && tl <= 60) || (ST.lf >= 0 && ST.al && (ST.lf === 0 || (ST.md === "elim" && ST.hd === 2 && ST.hm > 2))) ? 1 : 0, vc = lvl ? "on l" + lvl : "";
      if (vc !== lastVg) { lastVg = vc; vg.className = vc; }
      if (ST.md === "elim") { ST.hm = Math.max(ST.hm, ST.hd || 0); if (ST.hd === 2 && ST.hm > 2 && !ST.fl.duel) { ST.fl.duel = 1; banner("⚔️ Só restam 2 jogadores vivos!", "#fbbf24"); } }
      const it = (ic, v) => `<span class="it"><i>${ic}</i>${v}</span>`;   // cada indicador num bloco com espaço entre o ícone e o valor
      const sh = (ST.lf >= 0 ? `<span class="hr">${Array.from({ length: LIVES }, (_, k) => `<span>${k < ST.lf ? "♥" : "♡"}</span>`).join("")}</span>` : "") + it("📏", ST.lastC.toFixed(1) + " cm") + it("🐍", ST.n) + (tl >= 0 ? it("⏱", String(tl / 60 | 0).padStart(2, "0") + ":" + String(tl % 60).padStart(2, "0")) : "") + it("👥", ST.on || 1);   // por tempo: sem corações; eliminação: sem relógio
      if (sh !== lastSc) { lastSc = sh; sc.innerHTML = sh; }   // só mexe no DOM quando o texto muda
      if (ST.lv !== lv) {
        lv = ST.lv;
        // ranking lateral: sempre os 10 primeiros; se eu estiver mais abaixo, mostra "⋮" e uma faixa ao redor de mim (metade acima, metade abaixo) até encher o painel
        const all = [...ST.l].sort((a, b) => b[2] - a[2] || b[1] - a[1]), tot = all.length;
        const cs = getComputedStyle(hud), avail = (parseFloat(cs.maxHeight) || 400) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), rh = hud.firstElementChild ? hud.firstElementChild.offsetHeight || 16 : 16;
        const cap = Math.max(10, Math.floor(avail / rh));   // quantas linhas cabem
        const mi = Math.max(0, all.findIndex(r => r[0] === ST.you));
        let rows;   // lista de índices (ou -1 = reticências)
        if (tot <= cap || mi < cap - 1) rows = all.slice(0, Math.min(tot, cap)).map((_, n) => n);
        else {
          const rem = cap - 10 - 1, bef = rem >> 1; let a = mi - bef, z = a + rem - 1;
          if (z > tot - 1) { z = tot - 1; a = z - rem + 1; }
          rows = [...Array(10).keys(), -1]; for (let n = Math.max(10, a); n <= z; n++) rows.push(n);
        }
        hud.innerHTML = rows.map(n => {
          if (n < 0) return "<div style='opacity:.5;text-align:center;line-height:.6'>⋮</div>";
          const [i, c, a, hm] = all[n], nm = hm ? "<span style='color:#fde047'>" + esc(ST.names[i]) + "</span>" : esc(ST.names[i]);   // todos os jogadores humanos em amarelo
          return "<div " + (i === ST.you ? "data-me " : "") + "style='opacity:" + (a ? 1 : .4) + "'><span style='display:inline-block;width:1.1em'>" + (i === ST.you ? "▶" : "") + "</span>" + (n + 1) + ". " + (i === ST.you ? "<b>" + nm + "</b>" : nm) + " " + (c / 10).toFixed(1) + " cm</div>";
        }).join("");
      }
      ST.tails = ST.tails.filter(q => q.until > now).slice(-3);
      const th = ST.tails.map(q => `<div>${q.h}</div>`).join("");
      if (th !== lastTail) { lastTail = th; tail.innerHTML = th; tail.style.fontSize = ""; if (th) tail.style.fontSize = parseFloat(getComputedStyle(tail).fontSize) * Math.min(1, innerWidth * .94 / tail.offsetWidth) + "px"; }   // tamanho grande, mas encolhe só o necessário para caber em uma linha
      dd.style.display = ST.al ? "none" : "block";
      fin.style.display = !ST.al && ST.hd === 0 ? "block" : "none";   // todos os humanos morreram: dá para finalizar a partida
      if (!ST.al) dd.innerHTML = "Você morreu 💀 e não tem mais vidas<br />" + (ST.sp >= 0 ? "👀 Acompanhando <b>" + esc(ST.names[ST.sp]) + "</b> (a maior cobra)<br />" : "") + "aguardando o fim da partida...";
    }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return () => {
    wl?.release?.(); document.removeEventListener("visibilitychange", lock);
    cancelAnimationFrame(raf); clearInterval(si); clearInterval(bi); clearTimeout(kto);
    W.removeEventListener("resize", rs); W.removeEventListener("pointermove", mv); W.removeEventListener("pointerdown", pd); W.removeEventListener("pointerup", pu);
    W.removeEventListener("pointercancel", pu); W.removeEventListener("keydown", kd); W.removeEventListener("keyup", ku); W.removeEventListener("blur", bl);
  };
}