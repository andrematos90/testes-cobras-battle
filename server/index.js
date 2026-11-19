import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createGame } from "./game.js";
import { TICK, NSEL, NB, NH, HEAD_NAMES, HEAD_UNIQUE, NAME_MAX, COUNTDOWN, END_WAIT } from "../shared/config.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(dir, "../dist")));
app.use(express.static(path.join(dir, "../public")));
app.get("/health", (q, r) => r.send("ok"));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

let terrain = "stone";   // "stone" | "sand" | "grass": terreno do mapa, só o admin troca
let mode = "time";   // "time" | "elim": só o admin (primeiro online) troca. Começa em "time" para a partida poder iniciar mesmo se o admin estiver ausente
let state = "lobby", G = null, loop = null, tk = 0, cdN = 0, cdT = null, cdPart = null, endT = null;   // state: lobby | count (contagem) | play | end
const slots = Array(NSEL).fill(null);
const held = new Map();   // rid -> { ws, t }: jogador que perdeu a conexão no meio da partida; a vaga dele fica reservada por HOLD_MS (a cobra segue como bot)
const HOLD_MS = 45000;
const board = new Map();   // placar da sala: chave do jogador -> { n: nome, w: vitórias }; zera quando todo mundo sai
const boardList = () => [...board.values()].sort((a, b) => b.w - a.w).slice(0, 10).map(x => [x.n, x.w]);
const ready = new Set(), inGame = new Set();   // inGame: quem está de fato jogando (quem escolheu cobra mas ainda não entrou fica de fora)
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const online = () => [...wss.clients].filter(w => w.readyState === 1);
const nameOf = w => w.nm || HEAD_NAMES[w.head];   // nome digitado ou, se vazio, o nome da cabeça
// cabeça livre mais próxima da preferida (duas pessoas não usam a mesma cabeça ao mesmo tempo)
const freeHead = (pref, ws) => { if (!HEAD_UNIQUE) return pref; const used = new Set(slots.filter(w => w && w !== ws).map(w => w.head)); for (let d = 0; d < NH; d++) { const h = (pref + d) % NH; if (!used.has(h)) return h; } return pref; };
const cleanName = v => String(v ?? "").replace(/[\u0000-\u001f<>&"]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
const lobbyMsg = ws => ({ t: "lobby", st: state, slots: slots.map(w => !!w), ready: slots.map(w => !!w && ready.has(w)), bodies: slots.map(w => (w ? w.body : null)), heads: slots.map(w => (w ? w.head : null)), names: slots.map(w => (w ? nameOf(w) : null)), body: ws.body, head: ws.head, nm: ws.nm, sb: boardList(), you: slots.indexOf(ws), on: online().length, cd: cdN, mode, terrain, host: online()[0] === ws, adm: slots.indexOf(online()[0]) });   // host: você é o admin (o online mais antigo); adm: qual retângulo é do admin (-1 = sem cobra)
// sala de voz: o servidor só diz quem está nela e repassa a sinalização WebRTC; o áudio vai direto entre os jogadores
let vseq = 0, vlast = "";
const vlist = () => online().filter(w => w.voice);
// vstat: quantas pessoas estão na conversa e se alguém está falando agora (todo mundo recebe, para o botão "Entrar na Conversa" piscar)
const vstat = (to) => { const l = vlist(), o = { t: "vstat", n: l.length, sp: l.filter(w => w.vsp).length }, k = o.n + "," + o.sp; if (to) return send(to, o); if (k === vlast) return; vlast = k; for (const w of wss.clients) send(w, o); };
const vroster = () => { const l = vlist(), p = l.map(w => ({ id: w.id, nm: slots.includes(w) ? nameOf(w) : "Jogador" })); for (const w of l) send(w, { t: "vroster", p: p.filter(x => x.id !== w.id) }); vstat(); };
const bc = () => { for (const w of wss.clients) send(w, lobbyMsg(w)); vroster(); };
const humans = () => slots.filter(w => w && inGame.has(w));
const notify = (except, o) => { for (const w of inGame) if (w !== except) send(w, o); };   // avisos "entrou/saiu da partida"

// basta UMA pessoa online escolher cobra e clicar em PRONTO: corre a contagem e a partida começa (quem não clicou em PRONTO fica de fora e entra depois)
const someReady = () => [...ready].some(w => w.readyState === 1);
const tryStart = () => { if (state === "lobby" && mode && someReady()) startCount(); };
function startCount() {
  state = "count"; cdN = COUNTDOWN; cdPart = new Set(ready); bc();
  cdT = setInterval(() => { cdN--; if (cdN <= 0) { clearInterval(cdT); cdT = null; cdN = 0; cdPart = null; start(); } else bc(); }, 1000);
}
function cancelCount() { clearInterval(cdT); cdT = null; cdN = 0; cdPart = null; state = "lobby"; bc(); }
// a contagem só é cancelada se NINGUÉM ficar pronto (quem clica em PRONTO durante a contagem também entra)
const checkCount = () => { if (state === "count" && !someReady()) cancelCount(); };

function reset() { for (const h of held.values()) clearTimeout(h.t); held.clear(); if (!online().length) board.clear(); clearTimeout(loop); loop = null; clearTimeout(endT); endT = null; clearInterval(cdT); cdT = null; cdN = 0; cdPart = null; G = null; state = "lobby"; mode = "time"; terrain = "stone"; slots.fill(null); ready.clear(); inGame.clear(); bc(); }

function start() {
  for (let i = 0; i < NSEL; i++) if (slots[i] && !ready.has(slots[i])) slots[i] = null;   // quem escolheu cobra mas não clicou em PRONTO perde a vaga (fica no lobby e pode entrar depois)
  state = "play"; G = createGame(slots.map(w => !!w), slots.map(w => (w ? w.body : null)), mode, slots.map(w => (w ? w.head : null)), slots.map(w => (w ? nameOf(w) : null))); tk = 0;
  inGame.clear(); slots.forEach(w => w && inGame.add(w));
  slots.forEach((w, i) => w && send(w, { t: "start", you: i, names: G.names, sk: G.sk, heads: G.hd, md: mode, tr: terrain }));
  for (const w of wss.clients) if (!slots.includes(w)) send(w, lobbyMsg(w));
  // relógio sem deriva: cada tick é agendado para start + n*TICK (setInterval acumulava atraso e causava trancos no cliente)
  let next = performance.now() + TICK;
  const tick = () => {
    G.step(TICK / 16.667); tk++;
    for (const d of G.dead) { const w = slots[d[2]]; if (w && inGame.has(w)) notify(null, { t: "ev", k: "die", i: d[2] }); }   // jogador humano morreu: aviso "broxou!" para todos na partida (bots não geram aviso)
    const on = online().length;
    slots.forEach((w, i) => { if (!w || !inGame.has(w) || w.readyState !== 1) return; send(w, { ...G.snap(i), on, k: tk }); if (tk % 12 === 1) send(w, { t: "l", l: G.lb() }); });
    if (G.over) {
      loop = null; state = "end";
      const r = G.result(), ww = slots[r.w], wl = r.l[0];   // vitória só conta se quem ficou em 1º é um jogador humano (no modo eliminação, vivo)
      if (ww && inGame.has(ww) && (r.tm || wl[2])) { const k = ww.rid || ww.id, e = board.get(k) || { n: "", w: 0 }; e.n = nameOf(ww); e.w++; board.set(k, e); }
      humans().forEach(w => send(w, { t: "end", ...r, sb: boardList() }));
      endT = setTimeout(reset, END_WAIT * 1000);   // ranking fica na tela por um tempo e depois o lobby reabre sozinho (ninguém precisa clicar em Reiniciar)
      return;
    }
    next += TICK; const now = performance.now(); if (next < now - TICK * 5) next = now;
    loop = setTimeout(tick, Math.max(0, next - now));
  };
  loop = setTimeout(tick, TICK);
}

// reconexão: quem caiu no meio da partida tem HOLD_MS para voltar e reassumir a mesma cobra (enquanto isso ela joga sozinha como bot)
function hold(ws) {
  const me = slots.indexOf(ws); if (G && me >= 0) G.drop(me);
  const t = setTimeout(() => { held.delete(ws.rid); if (inGame.has(ws)) leaveGame(ws); }, HOLD_MS); held.set(ws.rid, { ws, t });
}
function takeover(nw, old) {
  const me = slots.indexOf(old); if (me < 0 || !G) return -1;
  nw.body = old.body; nw.head = old.head; nw.nm = old.nm;
  slots[me] = nw; inGame.delete(old); inGame.add(nw); if (ready.has(old)) { ready.delete(old); ready.add(nw); }
  const h = held.get(old.rid); if (h) { clearTimeout(h.t); held.delete(old.rid); }
  G.resume(me); try { old.terminate(); } catch (e) {}
  return me;
}
// tira o jogador da partida: a cobra dele continua como bot e os outros recebem o aviso
function leaveGame(ws) {
  const me = slots.indexOf(ws); inGame.delete(ws);
  if (me >= 0) { slots[me] = null; ready.delete(ws); if (G) G.drop(me); notify(ws, { t: "ev", k: "out", i: me }); }
  if (!humans().length) reset(); else bc();
}

wss.on("connection", ws => {
  ws.id = ++vseq; ws.voice = false; ws.vsp = false; vstat(ws); ws.body = Math.random() * NB | 0; ws.head = Math.random() * NH | 0; ws.nm = "";
  state === "lobby" ? bc() : send(ws, lobbyMsg(ws));
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const me = slots.indexOf(ws), playing = inGame.has(ws);
    if (m.t === "hello") {   // o navegador se apresenta com um id; se ele estava numa partida e caiu, volta para a mesma cobra
      if (typeof m.rid === "string" && /^[\w-]{6,40}$/.test(m.rid)) ws.rid = m.rid;
      let me2 = -1;
      if (ws.rid && state === "play" && G && me < 0) {
        const old = (held.get(ws.rid) || {}).ws || [...wss.clients].find(w => w !== ws && w.rid === ws.rid && inGame.has(w));   // ou uma conexão antiga "meio morta" que ainda aparece aberta
        if (old && inGame.has(old) && slots.includes(old)) me2 = takeover(ws, old);
      }
      send(ws, { t: "hi", resumed: me2 >= 0 });
      if (me2 >= 0) { send(ws, { t: "start", you: me2, names: G.names, sk: G.sk, heads: G.hd, md: mode, tr: terrain }); bc(); }
    }
    else if (m.t === "vjoin") { ws.voice = true; vroster(); }
    else if (m.t === "vleave") { ws.voice = false; ws.vsp = false; vroster(); }
    else if (m.t === "vsp") { if (ws.voice) { ws.vsp = !!m.on; vstat(); } }   // membro da conversa avisa quando começa/para de falar
    else if (m.t === "vsig") { const t = ws.voice && vlist().find(w => w.id === m.to); if (t && JSON.stringify(m.d ?? null).length < 12000) send(t, { t: "vsig", from: ws.id, d: m.d }); }
    else if (m.t === "pick" && (state === "lobby" || state === "play") && !playing) {   // durante a partida dá para escolher uma cobra livre e entrar
      if (me >= 0) { slots[me] = null; ready.delete(ws); }
      if (Number.isInteger(m.slot) && m.slot >= 0 && m.slot < NSEL && !slots[m.slot] && m.slot !== me) { slots[m.slot] = ws; ws.head = freeHead(ws.head, ws); }
      bc();
    } else if (m.t === "mode" && state === "lobby" && online()[0] === ws && (m.m === "time" || m.m === "elim")) {   // só o admin (quem entrou primeiro e ainda está online) troca o modo; se ele sair, o próximo mais antigo vira admin
      mode = m.m; bc();
    } else if (m.t === "terrain" && state === "lobby" && online()[0] === ws && ["stone", "sand", "grass", "snow", "lava", "night"].includes(m.v)) {   // só o admin troca o terreno
      terrain = m.v; bc();
    } else if (m.t === "body" && (state === "lobby" || state === "play") && !playing) {
      if (Number.isInteger(m.b) && m.b >= 0 && m.b < NB) { ws.body = m.b; bc(); }
    } else if (m.t === "head" && (state === "lobby" || state === "play") && !playing && me >= 0) {   // trocar a cabeça (só quem já tem retângulo; cabeça de outro jogador é recusada)
      if (Number.isInteger(m.h) && m.h >= 0 && m.h < NH && freeHead(m.h, ws) === m.h) { ws.head = m.h; bc(); }
    } else if (m.t === "nm" && (state === "lobby" || state === "play") && !playing && me >= 0) {   // nome digitado (vazio = usa o nome da cabeça)
      ws.nm = cleanName(m.n); bc();
    } else if (m.t === "ready" && (state === "lobby" || state === "count") && me >= 0 && mode) {
      ready.has(ws) ? ready.delete(ws) : ready.add(ws); bc();
      state === "count" ? checkCount() : tryStart();
    } else if (m.t === "join" && state === "play" && me >= 0 && !playing && G) {
      inGame.add(ws); const chg = G.join(me, ws.body, ws.head, nameOf(ws));
      send(ws, { t: "start", you: me, names: G.names, sk: G.sk, heads: G.hd, md: mode, tr: terrain });
      notify(ws, { t: "ev", k: "in", i: me, sk: ws.body, h: ws.head, nm: nameOf(ws) });
      for (const c of chg) notify(null, { t: "ev", k: "hd", i: c.i, h: c.h, nm: c.nm });   // bots que repetiam a cabeça/nome de quem entrou trocam
      bc();
    } else if (m.t === "leave" && state === "play" && playing) {
      send(ws, { t: "left" }); leaveGame(ws);
    } else if (m.t === "restart" && state === "end" && me >= 0) {
      reset();
    } else if (m.t === "fin" && state === "play" && playing && G) {
      G.finish();
    } else if (m.t === "in" && state === "play" && playing && G) {
      G.input(me, +m.a || 0, !!m.b, !!m.k);
    }
  });
  ws.on("close", () => {
    if (ws.voice) { ws.voice = false; ws.vsp = false; vroster(); }
    const me = slots.indexOf(ws), was = inGame.has(ws);
    if (state === "play" && was) { if (ws.rid && G) hold(ws); else leaveGame(ws); return; }   // com id: guarda a vaga para reconexão
    inGame.delete(ws);
    if (me >= 0) { slots[me] = null; ready.delete(ws); }
    if (state === "count") { checkCount(); if (state === "count") bc(); tryStart(); }
    else if (state === "lobby") { bc(); tryStart(); }
    else if (state === "play") bc();   // alguém que só tinha escolhido uma cobra libera a vaga
    else if (state === "end" && !humans().length) reset();   // ninguém ficou para ver o ranking
    if (!online().length && !held.size) reset();   // ninguém online: encerra tudo (partida, contagem, modo) e o jogo volta limpo
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log("Cobras.io no ar na porta " + port));
