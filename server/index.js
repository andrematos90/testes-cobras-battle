import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createGame } from "./game.js";
import * as daily from "./daily.js";
import * as accounts from "./accounts.js";
import { initDb } from "./db.js";
import { TICK, NSEL, NB, NH, HEAD_NAMES, BOT_NAMES, BOT_NAMES2, BOT_NAMES_EXTRA, COUNTDOWN, END_WAIT } from "../shared/config.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(dir, "../dist")));
app.use(express.static(path.join(dir, "../public")));
app.get("/health", (q, r) => r.send("ok"));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

let terrain = "stone";   // "stone" | "sand" | "grass" | ...: terreno do mapa, só o admin troca
let mode = "time";   // "time" | "elim": só o admin (online mais antigo que já escolheu entrar) troca
let teams = false;   // partida por equipe (2 equipes, sorteadas ao clicar em JOGAR); o admin liga/desliga a cada partida e volta a "não" quando a partida acaba
let state = "lobby", G = null, loop = null, tk = 0, cdN = 0, cdT = null, endT = null;   // state: lobby | count (contagem geral) | play | end
const slots = Array(NSEL).fill(null);   // vaga = cobra do jogo: ocupada por quem clicou em JOGAR (pend = ainda na contagem; inGame = jogando). Máximo NSEL pessoas (convidados contam)
const held = new Map();   // rid -> { ws, t }: jogador que perdeu a conexão no meio da partida; a vaga dele fica reservada por HOLD_MS (a cobra segue como bot)
const HOLD_MS = 45000;
const board = new Map();   // placar da sala (só contas): sub -> { n: nome, w: vitórias }; zera quando todo mundo sai
const boardList = () => [...board.values()].sort((a, b) => b.w - a.w).slice(0, 10).map(x => [x.n, x.w]);
const inGame = new Set();   // quem está de fato jogando
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const online = () => [...wss.clients].filter(w => w.readyState === 1);
const nameOf = w => w.kind === "guest" ? (w.gname || "Convidado") : (w.nm || "Jogador");
const adm = () => online().find(w => w.kind);   // admin = o mais antigo online que já entrou (conta ou convidado)
const pendN = () => slots.filter(w => w && w.pend).length;
const lc = x => String(x || "").trim().toLowerCase();
// convidado ganha um nome sorteado da lista dos bots que ninguém está usando agora
const ALLBOT = [...new Set([...BOT_NAMES, ...BOT_NAMES2, ...BOT_NAMES_EXTRA])];
function guestName() {
  const use = new Set(slots.filter(Boolean).map(w => lc(nameOf(w)))), ok = ALLBOT.filter(n => !use.has(lc(n)) && n.length <= 14);
  const l = ok.length ? ok : ALLBOT; return l[Math.random() * l.length | 0];
}
const lobbyMsg = ws => ({ t: "lobby", st: state, kind: ws.kind || null, u: ws.kind === "acc" ? accounts.publicUser(ws.user) : null, body: ws.body, you: slots.indexOf(ws), pend: !!ws.pend, pc: ws.pc || 0, n: slots.filter(Boolean).length, mx: NSEL, on: online().filter(w => w.kind).length, cd: cdN, mode, terrain, teams, tm: ws.team ?? -1, host: adm() === ws, sb: boardList() });
// equipe sorteada: vai para a que tem menos gente (diferença máxima de 1); empate = cara ou coroa
function pickTeam(ws) {
  const c = [0, 0]; for (const w of slots) if (w && w !== ws && w.team >= 0) c[w.team]++;
  return c[0] < c[1] ? 0 : c[1] < c[0] ? 1 : Math.random() < .5 ? 0 : 1;
}
const startMsg = me => ({ t: "start", you: me, names: G.names, sk: G.sk, heads: G.hd, md: mode, tr: terrain, tmode: !!G.team, tm: G.team ? G.tms() : [] });
// sala de voz: o servidor só diz quem está nela e repassa a sinalização WebRTC; o áudio vai direto entre os jogadores
let vseq = 0, vlast = "";
const vlist = () => online().filter(w => w.voice);
// vstat: quantas pessoas estão na conversa e se alguém está falando agora (todo mundo recebe, para o botão "Entrar na Conversa" piscar)
const vstat = (to) => { const l = vlist(), o = { t: "vstat", n: l.length, sp: l.filter(w => w.vsp).length }, k = o.n + "," + o.sp; if (to) return send(to, o); if (k === vlast) return; vlast = k; for (const w of wss.clients) send(w, o); };
const vroster = () => { const l = vlist(), p = l.map(w => ({ id: w.id, nm: vlabel(w) })); for (const w of l) send(w, { t: "vroster", p: p.filter(x => x.id !== w.id) }); vstat(); };
const bc = () => { for (const w of wss.clients) send(w, lobbyMsg(w)); vroster(); };
const humans = () => slots.filter(w => w && inGame.has(w));
const notify = (except, o) => { for (const w of inGame) if (w !== except) send(w, o); };   // avisos "entrou/saiu da partida"
const vlabel = w => w.kind ? nameOf(w) : "Jogador";

// ---------- entrada na partida ----------
// Quem clica em JOGAR ganha uma vaga na hora. Sem partida rolando: o primeiro inicia a contagem geral de 5 s. Com partida rolando: contagem de 5 s só dele e entra direto.
function startCount() {
  state = "count"; cdN = COUNTDOWN; bc();
  cdT = setInterval(() => { cdN--; if (cdN <= 0) { clearInterval(cdT); cdT = null; cdN = 0; start(); } else bc(); }, 1000);
}
function cancelCount() { clearInterval(cdT); cdT = null; cdN = 0; state = "lobby"; bc(); }
const checkCount = () => { if (state === "count" && !pendN()) cancelCount(); };   // a contagem só cancela se ninguém sobrar na fila
function stopPend(ws) { clearInterval(ws.pt); ws.pt = null; ws.pend = false; ws.pc = 0; }
function personalCount(ws) {   // partida em andamento: contagem de 5 s só para esta pessoa
  ws.pc = COUNTDOWN;
  ws.pt = setInterval(() => {
    if (ws.readyState !== 1) { cancelPend(ws); return; }
    ws.pc--;
    if (ws.pc <= 0) joinNow(ws); else send(ws, lobbyMsg(ws));
  }, 1000);
}
function cancelPend(ws) {   // desistiu (ou saiu): libera a vaga
  const me = slots.indexOf(ws); stopPend(ws); ws.team = -1; if (me >= 0) slots[me] = null;
  if (state === "count") checkCount();
  bc();
}
function joinNow(ws) {
  const me = slots.indexOf(ws); stopPend(ws);
  if (me < 0 || state !== "play" || !G) { if (me >= 0) slots[me] = null; return bc(); }   // a partida acabou durante a contagem
  ws.tin = Date.now(); inGame.add(ws);
  const chg = G.join(me, ws.body, ws.head, nameOf(ws), ws.kind === "guest", teams ? ws.team : -1);
  send(ws, startMsg(me));
  notify(ws, { t: "ev", k: "in", i: me, sk: ws.body, h: ws.head, nm: nameOf(ws), tm: teams ? ws.team : -1 });
  for (const c of chg) notify(null, { t: "ev", k: "hd", i: c.i, h: c.h, nm: c.nm });   // bots que repetiam a cabeça/nome de quem entrou trocam
  bc();
}

function reset() {
  for (const h of held.values()) clearTimeout(h.t); held.clear(); if (!online().length) board.clear();
  clearTimeout(loop); loop = null; clearTimeout(endT); endT = null; clearInterval(cdT); cdT = null; cdN = 0; G = null; state = "lobby"; mode = "time"; terrain = "stone"; teams = false;
  for (const w of wss.clients) { stopPend(w); w.team = -1; }
  slots.fill(null); inGame.clear(); bc();
}

function start() {
  for (const w of slots) if (w && w.pend) { stopPend(w); w.tin = Date.now(); }
  if (!slots.some(Boolean)) return reset();
  if (teams) for (const w of slots) if (w && !(w.team >= 0)) w.team = pickTeam(w);
  state = "play"; G = createGame(slots.map(w => !!w), slots.map(w => (w ? w.body : null)), mode, slots.map(w => (w ? w.head : null)), slots.map(w => (w ? nameOf(w) : null)), slots.map(w => !!w && w.kind === "guest"), teams ? slots.map(w => (w ? w.team : -1)) : null); tk = 0;
  inGame.clear(); slots.forEach(w => w && inGame.add(w));
  slots.forEach((w, i) => w && send(w, startMsg(i)));
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
      const r = G.result(), ww = slots[r.w], wl = r.l[0], tmg = !!r.teams;   // vitória só conta se quem ficou em 1º é um jogador humano (no modo eliminação, vivo); em partida por equipe NINGUÉM ganha vitória (placar da sala e Ranking do Dia)
      if (!tmg && ww && ww.user && inGame.has(ww) && (r.tm || wl[2])) { const k = ww.user.sub + ":" + ww.ci, e = board.get(k) || { n: "", w: 0 }; e.n = nameOf(ww); e.w++; board.set(k, e); }   // placar da sala: só contas
      { const fin = new Map(r.l.map(x => [x[0], x[1] / 10])), bst = new Map(G.lbBest().map(x => [x[0], x[1] / 10]));
        slots.forEach((w, i) => { if (w && inGame.has(w)) recordFor(w, i, fin.get(i), bst.get(i), !tmg && i === r.w && (r.tm || wl[2])); }); }   // Ranking do Dia
      humans().forEach(w => send(w, { t: "end", ...r, sb: boardList() }));
      endT = setTimeout(reset, END_WAIT * 1000);   // ranking fica na tela por um tempo e depois o lobby reabre sozinho (ninguém precisa clicar em Reiniciar)
      return;
    }
    next += TICK; const now = performance.now(); if (next < now - TICK * 5) next = now;
    loop = setTimeout(tick, Math.max(0, next - now));
  };
  loop = setTimeout(tick, TICK);
}

// Ranking do Dia: só contas (convidado não entra)
function recordFor(ws, i, final, best, win) {
  if (!ws.user) return;
  daily.record(ws.user.sub, { ci: ws.ci, name: ws.nm, head: ws.head, final, best, win: !!win, mode, secs: (Date.now() - (ws.tin || Date.now())) / 1000 });
}
// reconexão: quem caiu no meio da partida tem HOLD_MS para voltar e reassumir a mesma cobra (enquanto isso ela joga sozinha como bot)
function hold(ws) {
  const me = slots.indexOf(ws); if (G && me >= 0) G.drop(me);
  const t = setTimeout(() => { held.delete(ws.rid); if (inGame.has(ws)) leaveGame(ws); }, HOLD_MS); held.set(ws.rid, { ws, t });
}
function takeover(nw, old) {
  const me = slots.indexOf(old); if (me < 0 || !G) return -1;
  nw.team = old.team; nw.body = old.body; nw.head = old.head; nw.nm = old.nm; nw.user = old.user; nw.ci = old.ci; nw.kind = old.kind; nw.gname = old.gname; nw.tin = old.tin;
  slots[me] = nw; inGame.delete(old); inGame.add(nw);
  const h = held.get(old.rid); if (h) { clearTimeout(h.t); held.delete(old.rid); }
  G.resume(me); try { old.terminate(); } catch (e) {}
  return me;
}
// tira o jogador da partida: a cobra dele continua como bot e os outros recebem o aviso
function leaveGame(ws) {
  const me = slots.indexOf(ws);
  if (G && !G.over && me >= 0 && inGame.has(ws)) { const f = (G.lb().find(x => x[0] === me) || [0, 0])[1] / 10, b = (G.lbBest().find(x => x[0] === me) || [0, 0])[1] / 10; recordFor(ws, me, f, b, false); }   // saiu no meio: a partida conta, sem vitória
  inGame.delete(ws);
  if (me >= 0) { slots[me] = null; if (G) G.drop(me, true); notify(ws, { t: "ev", k: "out", i: me, tm: -1 }); }   // saiu de vez: a cobra vira bot sem equipe
  if (!humans().length && !slots.some(w => w && w.pend)) reset(); else bc();
}
const applyUser = (ws, ci) => { const u = ws.user; if (!u) return; ws.ci = ci ?? u.last ?? 0; const c = u.chars[ws.ci] || u.chars[0]; if (c) { ws.nm = c.nm; ws.head = c.head; ws.body = c.body; } };   // ci = personagem escolhido da conta
const okIdx = (v, n) => Number.isInteger(v) && v >= 0 && v < n;

wss.on("connection", ws => {
  ws.id = ++vseq; ws.voice = false; ws.vsp = false; vstat(ws); ws.body = Math.random() * NB | 0; ws.head = Math.random() * NH | 0; ws.nm = ""; ws.kind = null; ws.user = null; ws.pend = false; ws.pc = 0;
  send(ws, lobbyMsg(ws));
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const me = slots.indexOf(ws), playing = inGame.has(ws);
    if (m.t === "hello") {   // o navegador se apresenta (rid = aba, tok = sessão da conta); se ele estava numa partida e caiu, volta para a mesma cobra
      if (typeof m.rid === "string" && /^[\w-]{6,40}$/.test(m.rid)) ws.rid = m.rid;
      const u = m.tok ? accounts.userFromToken(m.tok) : null;
      if (u && !playing && !ws.pend) { ws.user = u; ws.kind = "acc"; applyUser(ws); }
      let me2 = -1;
      if (ws.rid && state === "play" && G && me < 0) {
        const old = (held.get(ws.rid) || {}).ws || [...wss.clients].find(w => w !== ws && w.rid === ws.rid && inGame.has(w));   // ou uma conexão antiga "meio morta" que ainda aparece aberta
        if (old && inGame.has(old) && slots.includes(old)) me2 = takeover(ws, old);
      }
      send(ws, { t: "hi", resumed: me2 >= 0, cid: accounts.clientId(), dev: accounts.devLogin(), has: !!u });
      if (me2 < 0) send(ws, lobbyMsg(ws));
      if (me2 >= 0) { send(ws, startMsg(me2)); bc(); }
    }
    else if (m.t === "ping") send(ws, { t: "pong", c: m.c });   // devolve o ping na hora (o navegador mede o tempo de ida e volta)
    else if (m.t === "auth" && !playing && !ws.pend) {   // login com Google: confere o token do Google e devolve a nossa sessão
      (async () => {
        try {
          const u = m.dev != null ? accounts.loginDev(m.dev) : await accounts.login(m.cred);
          if (ws.pend || inGame.has(ws)) return;
          ws.user = u; ws.kind = "acc"; applyUser(ws);
          send(ws, { t: "auth", ok: true, tok: accounts.makeToken(u.sub) }); send(ws, lobbyMsg(ws)); bc();
        } catch (e) { console.log("[login] recusado:", e.message); send(ws, { t: "auth", ok: false, err: "Não foi possível entrar com o Google. Tente de novo." }); }
      })();
    }
    else if (m.t === "guest" && !playing && !ws.pend) { ws.user = null; ws.kind = "guest"; ws.head = -1; if (okIdx(m.b, NB)) ws.body = m.b; bc(); }
    else if (m.t === "logout" && !playing && !ws.pend) { ws.user = null; ws.kind = null; send(ws, lobbyMsg(ws)); bc(); }
    else if (m.t === "dr") send(ws, { t: "dr", day: daily.today(), rows: daily.rows() });   // Ranking do Dia
    else if (m.t === "vjoin") { ws.voice = true; vroster(); }
    else if (m.t === "vleave") { ws.voice = false; ws.vsp = false; vroster(); }
    else if (m.t === "vsp") { if (ws.voice) { ws.vsp = !!m.on; vstat(); } }   // membro da conversa avisa quando começa/para de falar
    else if (m.t === "vsig") { const t = ws.voice && vlist().find(w => w.id === m.to); if (t && JSON.stringify(m.d ?? null).length < 12000) send(t, { t: "vsig", from: ws.id, d: m.d }); }
    else if (m.t === "mode" && (state === "lobby" || state === "count") && adm() === ws && (m.m === "time" || m.m === "elim")) { mode = m.m; bc(); }   // o admin escolhe o modo e o terreno
    else if (m.t === "teams" && (state === "lobby" || state === "count") && adm() === ws) {   // admin liga/desliga o modo por equipe; quem já clicou em JOGAR é sorteado de novo (ou volta a não ter equipe)
      teams = !!m.v; for (const w of slots) if (w) w.team = -1;
      if (teams) for (const w of slots) if (w) w.team = pickTeam(w);
      bc();
    }
    else if (m.t === "terrain" && (state === "lobby" || state === "count") && adm() === ws && ["stone", "sand", "grass", "snow", "lava", "night"].includes(m.v)) { terrain = m.v; bc(); }
    else if (m.t === "play" && ws.kind && !ws.pend && !playing) {   // JOGAR: monta a cobra e pega uma vaga
      if (state === "end") return send(ws, { t: "err", m: "A partida está terminando. Aguarde um instante." });
      if (ws.kind === "acc") {
        if (!ws.user) return;
        if (slots.some(w => w && w !== ws && w.user && w.user.sub === ws.user.sub)) return send(ws, { t: "err", m: "Esta conta já está jogando em outra aba ou aparelho." });
      }
      const free = slots.findIndex(x => !x);
      if (free < 0) return send(ws, { t: "err", m: "A partida está cheia (10 jogadores). Aguarde alguém sair." });
      if (ws.kind === "acc") {
        const r = accounts.setProfile(ws.user, { idx: m.ci, nm: m.nm, head: m.head, body: m.body });
        if (r.err) return send(ws, { t: "err", m: r.err, nm: 1 });
        if (r.renamed) { daily.rename(ws.user.sub, r.idx, ws.nm = ws.user.chars[r.idx].nm); const e = board.get(ws.user.sub + ":" + r.idx); if (e) e.n = ws.nm; }
        applyUser(ws, r.idx);
      } else { if (okIdx(m.body, NB)) ws.body = m.body; ws.head = -1; ws.gname = guestName(); }
      slots[free] = ws; ws.pend = true; ws.team = teams ? pickTeam(ws) : -1;
      if (state === "lobby") startCount(); else if (state === "play") personalCount(ws); else bc();
      bc();
    }
    else if (m.t === "cancel" && ws.pend) cancelPend(ws);
    else if (m.t === "leave" && state === "play" && playing) { send(ws, { t: "left" }); leaveGame(ws); }
    else if (m.t === "restart" && state === "end" && me >= 0) reset();
    else if (m.t === "fin" && state === "play" && playing && G) G.finish();
    else if (m.t === "in" && state === "play" && playing && G) G.input(me, +m.a || 0, !!m.b, !!m.k);
  });
  ws.on("close", () => {
    if (ws.voice) { ws.voice = false; ws.vsp = false; vroster(); }
    const me = slots.indexOf(ws), was = inGame.has(ws);
    if (state === "play" && was) { if (ws.rid && G) hold(ws); else leaveGame(ws); return; }   // com id: guarda a vaga para reconexão
    inGame.delete(ws); clearInterval(ws.pt);
    if (me >= 0) slots[me] = null;
    if (state === "count") { checkCount(); if (state === "count") bc(); }
    else if (state === "end" && !humans().length) reset();   // ninguém ficou para ver o ranking
    else bc();
    if (!online().length && !held.size) reset();   // ninguém online: encerra tudo e o jogo volta limpo
  });
});

let seenDay = daily.today();
setInterval(() => { const d = daily.today(); if (d !== seenDay) { seenDay = d; bc(); } }, 20000).unref();   // meia-noite: o Ranking do Dia zera
await Promise.race([initDb(), new Promise(r => setTimeout(r, 6000))]);   // carrega ranking e contas do banco antes de abrir o servidor (no máximo 6 s)
const port = process.env.PORT || 3000;
server.listen(port, () => console.log("Cobras.io no ar na porta " + port));
