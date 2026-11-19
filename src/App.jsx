import React, { useState, useRef, useEffect } from "react";
import { SK, SKIN, head, drawBody } from "./draw.js";
import { TERRAINS } from "./terrain.js";
import { HEAD_NAMES, NH, NSEL, NB, BODY_NAMES, TAPER, SLOT_COLORS, NAME_MAX, HEAD_UNIQUE } from "../shared/config.js";
import { sfx, startMusic, toggleMute } from "./sound.js";
import { fsOk, toggleFs } from "./fullscreen.js";
import * as voice from "./voice.jsx";
import { VoiceBar } from "./voice.jsx";
import { ST, getImg, resetStore, onSnap, onEvent, runGame } from "./play.js";

// id do navegador (por aba): permite voltar para a mesma cobra se a conexão cair; preferências (nome, cabeça, corpo) ficam salvas no navegador
const RID = (() => { try { let r = sessionStorage.getItem("cobras_rid"); if (!r) { r = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem("cobras_rid", r); } return r; } catch (e) { return Math.random().toString(36).slice(2, 14) + "xx"; } })();
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem("cobras_prefs")) || {}; } catch (e) { return {}; } };
const savePrefs = o => { try { localStorage.setItem("cobras_prefs", JSON.stringify({ ...loadPrefs(), ...o })); } catch (e) {} };

function Preview({ hd, b, empty, w = 220, h = 70, sc = 1 }) {
  const r = useRef();
  useEffect(() => {
    const g = r.current.getContext("2d"), hx = w * .68;
    if (empty) {   // retângulo livre: só o formato da cobra, vazio (sem foto, sem cor)
      g.clearRect(0, 0, w, h); g.fillStyle = "#2b3566";
      for (let i = 30; i > 0; i--) { g.beginPath(); g.arc(hx - i * 3.3 * sc, h / 2, 7 * sc * TAPER(i, 31), 0, 6.2832); g.fill(); }
      g.beginPath(); g.ellipse(hx, h / 2, 21 * sc, 17 * sc, 0, 0, 6.2832); g.fill();
      g.strokeStyle = "#2b3566"; g.lineWidth = 3; g.beginPath(); g.moveTo(hx + 22 * sc, h / 2); g.lineTo(hx + 34 * sc, h / 2); g.lineTo(hx + 39 * sc, h / 2 - 4 * sc); g.moveTo(hx + 34 * sc, h / 2); g.lineTo(hx + 39 * sc, h / 2 + 4 * sc); g.stroke();
      return;
    }
    const im = getImg(hd);
    for (const d of [-1, 1]) getImg((hd + d + NH) % NH);   // já baixa as cabeças vizinhas: ao passar com as setas a próxima aparece na hora
    const NP = 14, pts = new Float32Array(NP * 2), V = [-1e9, 1e9, -1e9, 1e9];   // prévia desenhada com o mesmo desenho do corpo do jogo
    for (let j = 0; j < NP; j++) { pts[2 * j] = hx - j * 10.5 * sc; pts[2 * j + 1] = h / 2; }
    const dr = () => { g.clearRect(0, 0, w, h); drawBody(g, pts, NP, NP, 7 * sc, b, performance.now(), V, 1); head(g, hx, h / 2, 0, 7 * sc, b, im, 31 * sc); };
    dr(); const iv = SKIN[b].rb ? setInterval(dr, 60) : 0;
    im.addEventListener("load", dr); return () => { clearInterval(iv); im.removeEventListener("load", dr); };
  }, [hd, b, empty]);
  return <canvas ref={r} width={w} height={h} />;
}

// controles da cobra escolhida: cabeça (‹ ›), corpo (‹ ›) e nome. Teclado: ← → passam o corpo, ↑ ↓ passam a cabeça. No celular: deslizar na linha do corpo.
function Controls({ lob, send }) {
  const { head, body, you } = lob, [nm, setNm] = useState(lob.nm || ""), inp = useRef();
  useEffect(() => { if (document.activeElement !== inp.current) setNm(lob.nm || ""); }, [lob.nm]);   // nome aplicado pelo servidor (ex.: o salvo no navegador) aparece no campo
  const taken = lob.heads.filter((x, k) => x != null && k !== you);
  const goB = (e, d) => { e && e.stopPropagation(); sfx.click(); const b = (body + d + NB) % NB; savePrefs({ b }); send({ t: "body", b }); };
  const goH = (e, d) => {   // pula as cabeças que outro jogador já está usando
    e && e.stopPropagation(); let h = head;
    for (let i = 0; i < NH; i++) { h = (h + d + NH) % NH; if (!HEAD_UNIQUE || !taken.includes(h)) break; }
    sfx.click(); savePrefs({ h }); send({ t: "head", h });
  };
  const tx = useRef(null);
  const fn = useRef(); fn.current = { goB, goH };
  useEffect(() => {
    const f = e => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") fn.current.goB(null, -1); else if (e.key === "ArrowRight") fn.current.goB(null, 1);
      else if (e.key === "ArrowUp") { e.preventDefault(); fn.current.goH(null, -1); } else if (e.key === "ArrowDown") { e.preventDefault(); fn.current.goH(null, 1); }
    };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, []);
  return (
    <div className="ctl" onClick={e => e.stopPropagation()}>
      <div className="ba">
        <button className="ab" onClick={e => goH(e, -1)}>‹</button>
        <span className="bn">Escolha a Cabeça</span>
        <button className="ab" onClick={e => goH(e, 1)}>›</button>
      </div>
      <div className="ba" onTouchStart={e => { tx.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (tx.current == null) return; const d = e.changedTouches[0].clientX - tx.current; tx.current = null; if (Math.abs(d) > 40) goB(e, d < 0 ? 1 : -1); }}>
        <button className="ab" onClick={e => goB(e, -1)}>‹</button>
        <span className="bn">Escolha o Corpo</span>
        <button className="ab" onClick={e => goB(e, 1)}>›</button>
      </div>
      <input ref={inp} className="nm" maxLength={NAME_MAX} value={nm} placeholder="Inserir Nome" onClick={e => e.stopPropagation()}
        onChange={e => { setNm(e.target.value); savePrefs({ nm: e.target.value }); send({ t: "nm", n: e.target.value }); }} />
    </div>
  );
}

const MODES = {
  time: { t: "⏱ Por tempo (10 min)", d: "Sem corações: quem morre renasce pequena, sem limite (bots também). Acaba quando fecha os 10 minutos e vale o tamanho de cada cobra nesse momento." },
  elim: { t: "💀 Eliminação (sem tempo)", d: "Sem relógio. Cada jogador tem 3 corações; zerou, está fora. Bots não renascem. Ganha o último jogador vivo." },
};
// o primeiro a entrar no link escolhe o modo; os outros só veem qual foi escolhido
function ModePick({ lob, send, open }) {
  const m = lob.mode;
  if (open && lob.host) return (   // só o admin (quem entrou primeiro no link) escolhe o modo
    <div className="mode">
      <p className="s">👑 Você é o admin: escolha o modo da partida</p>
      <div className="mbtns">{Object.entries(MODES).map(([k, v]) => <button key={k} className={"btn mb" + (m === k ? " on" : " g")} onClick={() => { sfx.click(); send({ t: "mode", m: k }); }}>{v.t}</button>)}</div>
      {m && <p className="s">{MODES[m].d}</p>}
      <p className="s">Terreno do mapa</p>
      <div className="mbtns">{TERRAINS.map(([k, t]) => <button key={k} className={"btn mb" + ((lob.terrain || "stone") === k ? " on" : " g")} onClick={() => { sfx.click(); send({ t: "terrain", v: k }); }}>{t}</button>)}</div>
    </div>
  );
  return <div className="mode"><p className="s">{m ? <><b>Modo: {MODES[m].t}</b><br />{MODES[m].d}</> : ""}<br />Terreno: <b>{(TERRAINS.find(x => x[0] === (lob.terrain || "stone")) || TERRAINS[0])[1]}</b><br />{open && "👑 Só o admin (quem entrou primeiro no link) pode trocar o modo e o terreno."}</p></div>;
}

function Board({ sb }) {
  return sb && sb.length ? <div className="sb"><b>🏆 Placar da sala (vitórias)</b><br />{sb.map(([n, w], i) => <span key={i}>{i + 1}. {n} — {w}</span>)}</div> : null;
}

function Lobby({ lob, send, muted, setMuted, notice, clearNotice }) {
  const prevYou = useRef(-1);
  useEffect(() => {   // ao escolher uma cobra, reaplica o nome/cabeça/corpo que a pessoa usou da última vez
    if (prevYou.current < 0 && lob.you >= 0) {
      const p = loadPrefs();
      if (Number.isInteger(p.b) && p.b >= 0 && p.b < NB && p.b !== lob.body) send({ t: "body", b: p.b });
      if (Number.isInteger(p.h) && p.h >= 0 && p.h < NH && p.h !== lob.head) send({ t: "head", h: p.h });
      if (typeof p.nm === "string" && p.nm !== (lob.nm || "")) send({ t: "nm", n: p.nm });
    }
    prevYou.current = lob.you;
  }, [lob.you]);
  const you = lob.you, rd = lob.ready, n = lob.slots.filter(Boolean).length, nr = rd.filter(Boolean).length, open = lob.st === "lobby";
  const live = lob.st === "play", count = lob.st === "count", pickable = open || live, full = lob.slots.every(Boolean);   // live: partida em andamento (dá para entrar numa cobra livre)
  return (
    <div className="menu">
      {lob.cd > 0 && <div id="cd" key={lob.cd}><small>A partida começa em</small>{lob.cd}</div>}
      <h1>🐍 Cobras.io online</h1>
      {notice && <div className="notice" onClick={clearNotice}>{notice}</div>}
      <p className="s">{open ? "Escolha um retângulo livre, passe a cabeça e o corpo com as setas ‹ › (e digite um nome, se quiser) e clique em PRONTO. Assim que alguém clicar em PRONTO, a contagem de 5 segundos começa e a partida inicia; quem não estiver pronto entra depois pelo botão ENTRAR NA PARTIDA. As cobras não escolhidas viram bots. " : live ? (full ? "Partida em andamento e todas as cobras estão ocupadas. Aguarde alguém sair ou o fim da partida." : "Partida em andamento! Escolha um retângulo livre, escolha cabeça e corpo com as setas ‹ › e clique em ENTRAR NA PARTIDA.") : count ? "A partida já vai começar! Quem ainda não clicou em PRONTO pode clicar agora para entrar junto." : "Partida terminando... aguarde para entrar."}</p>
      <ModePick lob={lob} send={send} open={open} />
      <Board sb={lob.sb} />
      <div className="cards">
        {Array.from({ length: NSEL }, (_, k) => {
          const mine = you === k, taken = lob.slots[k] && !mine, free = !lob.slots[k], col = SLOT_COLORS[k];
          const hd = mine ? lob.head : lob.heads[k] ?? 0, bd = mine ? lob.body : lob.bodies[k] ?? 0;
          const nm = mine ? (lob.nm || HEAD_NAMES[lob.head]) : taken ? lob.names[k] : "";
          return (
            <div key={k} className={"card" + (mine ? " on" : "") + (taken ? " off" : "") + (free ? " free" : "")} style={{ "--c": col }}
              onClick={() => { if (!pickable || taken) return; sfx.click(); send({ t: "pick", slot: mine ? -1 : k }); }}>
              {mine && <i className="pin">▼</i>}
              {lob.adm === k && <i className="adm" title="Admin">👑</i>}
              <span className="ic">{rd[k] ? "✔" : taken ? "🔒" : free ? "＋" : ""}</span>
              <b className="cn">{nm || "\u00a0"}</b>
              <div><Preview hd={hd} b={bd} empty={free} /></div>
              {mine && pickable && <Controls key={lob.you} lob={lob} send={send} />}
            </div>
          );
        })}
      </div>
      <div className="act">
      <button className="btn" style={you >= 0 ? { background: SLOT_COLORS[you], color: "#04210f", boxShadow: "0 0 14px #39ff1488" } : null} disabled={you < 0 || !lob.mode || !(open || live || count)} onClick={() => { sfx.click(); send({ t: live ? "join" : "ready" }); }}>{live ? "ENTRAR NA PARTIDA" : rd[you] ? "Cancelar" : "PRONTO"}</button>
      <button className="btn g" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
      {fsOk() && <button className="btn g fsb" onClick={() => toggleFs()}>⛶ Tela cheia</button>}
      </div>
      {!fsOk() && /iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone && <p className="s ios">📱 iPhone: toque em Compartilhar → "Adicionar à Tela de Início" e abra pelo ícone para jogar em tela cheia.</p>}
      <p className="s">👥 Online agora: <b>{lob.on}</b> · Com cobra: {n} · Prontos: {nr}{lob.host ? " · 👑 Você é o admin" : lob.adm < 0 ? " · 👑 O admin ainda não escolheu cobra" : ""}</p>
      <p className="s">No lobby: ← → trocam o corpo e ↑ ↓ trocam a cabeça. Teclado no jogo: ← → (ou A D) giram a cobra enquanto seguradas; ↑ ↓ (ou W S) apontam para cima e para baixo, e junto com ← → fazem a diagonal. Acelerar: espaço, Shift ou clique. Mouse e dedo (joystick) também funcionam.</p>
    </div>
  );
}

function Game({ send, muted, setMuted }) {
  const cv = useRef(), hud = useRef(), sc = useRef(), dd = useRef(), fin = useRef(), tail = useRef(), bn = useRef(), [conf, setConf] = useState(false);
  useEffect(() => { if (!conf) return; const t = setTimeout(() => setConf(false), 3000); return () => clearTimeout(t); }, [conf]);   // "Sair" pede um segundo toque para confirmar
  useEffect(() => runGame(cv.current, { hud: hud.current, sc: sc.current, dd: dd.current, fin: fin.current, tail: tail.current, bn: bn.current, send }), []);
  return (
    <div style={{ touchAction: "none" }}>
      <canvas ref={cv} style={{ touchAction: "none" }} />
      <div id="sc" ref={sc} />
      <div id="dd" ref={dd}>Você morreu 💀 e não tem mais vidas<br />aguardando o fim da partida...</div>
      <button id="fin" ref={fin} className="btn" onClick={() => send({ t: "fin" })}>Finalizar partida</button>
      <div id="tail" ref={tail} />
      <div id="bn" ref={bn} />
      <div id="hud" ref={hud} />
      <div id="mt" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</div>
      {fsOk() && <div id="fs" onClick={() => toggleFs()}>⛶</div>}
      <div id="out" onClick={() => { sfx.click(); if (conf) send({ t: "leave" }); else setConf(true); }}>{conf ? "Confirmar saída?" : "Sair"}</div>
      <div id="rot">↻ Gire o celular na horizontal</div>
      <div id="bt">⚡</div>
    </div>
  );
}

function Rank({ rank }) {
  const cols = []; for (let i = 0; i < rank.length; i += 10) cols.push(rank.slice(i, i + 10));
  return (
    <div>
      <div className="tb">{cols.map((c, ci) => (
        <div key={ci} className="tc">{c.map((r, n) => (
          <div key={n} className={"tr" + (r.me ? " me" : "")}>
            <span className="pos">{ci * 10 + n + 1}</span>
            <span className="nm2">{r.main && <b className="ar">▶ </b>}{r.n}</span>
            <span className="cm">{r.cm.toFixed(1)} cm</span>
          </div>))}
        </div>))}
      </div>
    </div>
  );
}

export default function App() {
  const [scr, setScr] = useState("conn"), [lob, setLob] = useState(null), [end, setEnd] = useState(null), [muted, setMuted] = useState(false), [rc, setRc] = useState(0), [notice, setNotice] = useState(""), [gk, setGk] = useState(0);
  const scrR = useRef("conn"), rcR = useRef(false); scrR.current = scr;   // rc > 0: conexão caiu no meio da partida e estamos tentando voltar (tentativa nº)
  const wsr = useRef(null);
  useEffect(() => {
    const f = () => startMusic(); window.addEventListener("pointerdown", f, { once: true }); return () => window.removeEventListener("pointerdown", f);
  }, []);
  useEffect(() => {
    let ws, dead = false, pi;
    const open = () => {
      ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); wsr.current = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ t: "hello", rid: RID })); pi = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 20000); };
      ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.t === "lobby") { setLob(m); if (!rcR.current) setScr(s => (m.st === "lobby" || s === "conn") ? "lobby" : s); }
        else if (m.t === "hi") { if (rcR.current && !m.resumed) { rcR.current = false; setRc(0); setScr("lobby"); setNotice("📡 A conexão caiu e a partida acabou (ou o servidor reiniciou) enquanto você estava fora. Escolha uma cobra para entrar de novo."); } }
        else if (m.t === "start") { rcR.current = false; setRc(0); setNotice(""); resetStore(m); setGk(k => k + 1); setScr("play"); }
        else if (m.t === "left") setScr("lobby");
        else if (m.t === "vroster") voice.roster(m.p);
        else if (m.t === "vsig") voice.sig(m);
        else if (m.t === "vstat") voice.stat(m);
        else if (m.t === "ev") onEvent(m);
        else if (m.t === "s") onSnap(m);
        else if (m.t === "l") { ST.l = m.l; ST.lv++; }
        else if (m.t === "end") { setEnd(m); setScr("end"); m.w === ST.you ? sfx.win() : sfx.end(); }
      };
      ws.onclose = () => { clearInterval(pi); voice.reset(); voice.stat({ n: 0, sp: 0 }); if (!dead) { if (scrR.current === "play" || rcR.current) { rcR.current = true; setRc(n => n + 1); } else setScr("conn"); setTimeout(open, 2000); } };
    };
    open();
    return () => { dead = true; clearInterval(pi); ws && ws.close(); };
  }, []);
  const send = o => { const w = wsr.current; if (w && w.readyState === 1) w.send(JSON.stringify(o)); };
  voice.bind(send);

  if (scr === "conn" || !lob) return <div className="menu"><h1>Conectando…</h1><p className="s">O servidor grátis pode levar até 1 minuto para acordar. Aguarde.</p></div>;
  if (scr === "lobby") return <><Lobby lob={lob} send={send} muted={muted} setMuted={setMuted} notice={notice} clearNotice={() => setNotice("")} /><VoiceBar /></>;
  if (scr === "play") return <><Game key={gk} send={send} muted={muted} setMuted={setMuted} /><VoiceBar />{rc > 0 && <div className="rcn"><div><i>🔄</i> Conexão perdida</div><div>Reconectando… (tentativa {rc})</div><small>Sua cobra continua jogando sozinha por até 45 segundos. Se o servidor estava dormindo, pode levar até 1 minuto para acordar. Não feche esta página.</small></div>}</>;
  const rank = end.l.map(([i, c]) => ({ n: ST.names[i], cm: c / 10, main: i < NSEL, me: i === ST.you }));
  return (
    <><VoiceBar /><div className="ov">
      <h1>🏆 Ranking final</h1>
      {end.md === "elim"
        ? <p className="sub">{rank[0].main ? `🏁 Último jogador vivo: ${rank[0].n}` : "💀 Todos os jogadores foram eliminados"}</p>
        : <><p className="sub">Quem tem a maior cobra é {rank[0].n} com {rank[0].cm.toFixed(1)} cm</p>
          <p className="sub">Quem tem a menor cobra é {rank[rank.length - 1].n} com {rank[rank.length - 1].cm.toFixed(1)} cm</p></>}
      <Rank rank={rank} />
      <Board sb={end.sb} />
      <button className="btn" onClick={() => { sfx.click(); send({ t: "restart" }); }}>Reiniciar partida</button>
    </div></>
  );
}
