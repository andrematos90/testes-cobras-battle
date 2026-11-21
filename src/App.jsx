import React, { useState, useRef, useEffect } from "react";
import { SK, SKIN, head, sHead, drawBody } from "./draw.js";
import { TERRAINS } from "./terrain.js";
import { HEAD_NAMES, NH, NSEL, NB, BODY_NAMES, TAPER, NAME_MAX } from "../shared/config.js";
import { sfx, startMusic, toggleMute } from "./sound.js";
import { fsOk, toggleFs } from "./fullscreen.js";
import * as voice from "./voice.jsx";
import { VoiceBar } from "./voice.jsx";
import { ST, getImg, resetStore, onSnap, onEvent, runGame } from "./play.js";

// id do navegador (por aba): permite voltar para a mesma cobra se a conexão cair
const RID = (() => { try { let r = sessionStorage.getItem("cobras_rid"); if (!r) { r = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem("cobras_rid", r); } return r; } catch (e) { return Math.random().toString(36).slice(2, 14) + "xx"; } })();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

// prévia grande da cobra (head < 0 = convidado: cabeça de bot, sem foto)
function Preview({ hd, b, w = 560, h = 190, sc = 2.4 }) {
  const r = useRef();
  useEffect(() => {
    const g = r.current.getContext("2d"), hx = w * .72;
    const NP = 14, pts = new Float32Array(NP * 2), V = [-1e9, 1e9, -1e9, 1e9];
    for (let j = 0; j < NP; j++) { pts[2 * j] = hx - j * 10.5 * sc; pts[2 * j + 1] = h / 2; }
    const im = hd >= 0 ? getImg(hd) : null;
    if (hd >= 0) for (const d of [-1, 1]) getImg((hd + d + NH) % NH);   // baixa as vizinhas: ao passar com as setas a próxima aparece na hora
    const dr = () => { g.clearRect(0, 0, w, h); drawBody(g, pts, NP, NP, 7 * sc, b, performance.now(), V, 1); if (im) head(g, hx, h / 2, 0, 7 * sc, b, im, 31 * sc); else sHead(g, hx, h / 2, 0, 7 * sc, SK[b].c); };
    dr(); const iv = SKIN[b].rb ? setInterval(dr, 60) : 0;
    if (im) im.addEventListener("load", dr); return () => { clearInterval(iv); im && im.removeEventListener("load", dr); };
  }, [hd, b]);
  return <canvas ref={r} width={w} height={h} className="pv" />;
}

const MODES = {
  time: { t: "⏱ Por tempo (10 min)", d: "Sem corações: quem morre renasce pequena, sem limite (bots também). Acaba quando fecha os 10 minutos e vale o tamanho de cada cobra nesse momento." },
  elim: { t: "💀 Eliminação (10 min)", d: "Cada jogador tem 3 corações; zerou, está fora. Bots não renascem. Se sobrar só 1 jogador vivo, ele vence; se os 10 minutos acabarem com mais de uma cobra viva, vence a maior. O tamanho final de cada cobra é a soma de todas as vidas dela." },
};
// o admin (online mais antigo) escolhe modo e terreno; os outros só veem
function ModePick({ lob, send, open }) {
  const tr = lob.terrain || "stone", m = lob.mode;
  if (open && lob.host) return (
    <div className="mode">
      <p className="s">👑 Você é o admin: escolha o modo e o terreno da partida</p>
      <div className="mbtns">{Object.entries(MODES).map(([k, v]) => <button key={k} className={"btn mb" + (m === k ? " on" : " g")} onClick={() => { sfx.click(); send({ t: "mode", m: k }); }}>{v.t}</button>)}</div>
      {m && <p className="s">{MODES[m].d}</p>}
      <div className="mbtns">{TERRAINS.map(([k, t]) => <button key={k} className={"btn mb" + (tr === k ? " on" : " g")} onClick={() => { sfx.click(); send({ t: "terrain", v: k }); }}>{t}</button>)}</div>
    </div>
  );
  return <div className="mode"><p className="s">{m ? <><b>Modo: {MODES[m].t}</b><br /></> : ""}Terreno: <b>{(TERRAINS.find(x => x[0] === tr) || TERRAINS[0])[1]}</b>{open && <><br />👑 Só o admin (o mais antigo online) escolhe o modo e o terreno.</>}</p></div>;
}

const fmtT = s => s >= 3600 ? (s / 3600).toFixed(1).replace(".", ",") + " h" : Math.max(1, Math.round(s / 60)) + " min";
// Ranking do Dia: só quem jogou hoje (horário de Brasília), com a foto da cabeça
function DailyRank({ data, onClose, refresh }) {
  const rows = data ? data.rows : null, dd = data && data.day ? data.day.split("-").reverse().join("/") : "";
  return (
    <div className="drw" onClick={onClose}>
      <div className="drp" onClick={e => e.stopPropagation()}>
        <h2>📅 Ranking do Dia {dd && <small>({dd})</small>}</h2>
        {!rows ? <p className="s">Carregando…</p> : !rows.length ? <p className="s">Ninguém com conta jogou hoje ainda. Entre com o Google e jogue uma partida para aparecer aqui!</p> : (
          <div className="drs"><table>
            <thead><tr><th>#</th><th></th><th>Jogador</th><th title="Vitórias (⏱ por tempo · 💀 eliminação)">🏆</th><th>Partidas</th><th>Maior</th><th style={{ whiteSpace: "normal" }}>Tamanho da sua Cobra</th><th>Tempo</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{r.h != null && <img className="rh" src={"/cobra" + (r.h + 1) + ".png"} alt="" onError={e => { e.target.style.visibility = "hidden"; }} />}</td>
                <td className="rn">{r.n}</td>
                <td><b>{r.w}</b>{r.w > 0 && <small> (⏱{r.wt} 💀{r.we})</small>}</td>
                <td>{r.p}</td><td>{r.b.toFixed(1)} cm</td><td>{r.t.toFixed(1)} cm</td><td>{fmtT(r.s)}</td>
              </tr>))}</tbody>
          </table></div>)}
        <div className="act"><button className="btn g" onClick={refresh}>↻ Atualizar</button><button className="btn" onClick={onClose}>Fechar</button></div>
        <p className="s">Uma linha por personagem (só contas; convidados não entram): vitórias, partidas, maior tamanho, tamanho da sua cobra (soma dos tamanhos finais) e tempo jogado hoje. Zera à meia-noite (Brasília).</p>
      </div>
    </div>
  );
}

function Board({ sb }) {
  return sb && sb.length ? <div className="sb"><b>🏆 Placar da sala (vitórias)</b><br />{sb.map(([n, w], i) => <span key={i}>{i + 1}. {n} — {w}</span>)}</div> : null;
}


// ---------- card único: a pessoa passa as opções e monta a cobra ----------
function Lobby({ lob, send, muted, setMuted, notice, clearNotice, openDr, err, clearErr, logout }) {
  const guest = lob.kind === "guest", chars = (lob.u && lob.u.chars) || [], MAXC = 3;
  const [ci, setCi] = useState(guest ? 0 : Math.min((lob.u && lob.u.sel) || 0, chars.length));   // personagem escolhido (até 3 por conta; igual a chars.length = novo)
  const c0 = chars[ci], [nm, setNm] = useState(c0 ? c0.nm : ""), [hd, setHd] = useState(c0 ? c0.head : Math.random() * NH | 0), [bd, setBd] = useState(guest ? (lsGet("cobras_gb") != null && Number.isInteger(+lsGet("cobras_gb")) ? +lsGet("cobras_gb") : lob.body) : (c0 ? c0.body : lob.body));
  const pick = i => { sfx.click(); clearErr(); setCi(i); const c = chars[i]; setNm(c ? c.nm : ""); setHd(c ? c.head : Math.random() * NH | 0); setBd(c ? c.body : Math.random() * NB | 0); };
  const fn = useRef(); const goH = d => { sfx.click(); setHd(h => (h + d + NH) % NH); }, goB = d => { sfx.click(); setBd(b => { const n = (b + d + NB) % NB; if (guest) lsSet("cobras_gb", String(n)); return n; }); };
  fn.current = { goH, goB };
  useEffect(() => {
    const f = e => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") fn.current.goB(-1); else if (e.key === "ArrowRight") fn.current.goB(1);
      else if (!guest && e.key === "ArrowUp") { e.preventDefault(); fn.current.goH(-1); } else if (!guest && e.key === "ArrowDown") { e.preventDefault(); fn.current.goH(1); }
    };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, [guest]);
  const st = lob.st, pend = lob.pend, full = lob.n >= lob.mx && !pend, open = st === "lobby" || st === "count";
  const cdv = lob.cd > 0 ? lob.cd : lob.pc;
  const okName = guest || nm.trim().length >= 2, can = pend || (okName && !full && st !== "end");
  const go = () => { sfx.click(); clearErr(); if (pend) send({ t: "cancel" }); else send(guest ? { t: "play", body: bd } : { t: "play", ci, nm, head: hd, body: bd }); };
  const msg = st === "lobby" ? "Nenhuma partida rolando. Clique em JOGAR: a contagem de 5 segundos começa e a partida inicia." : st === "count" ? "A partida já vai começar! Clique em JOGAR para entrar junto." : st === "play" ? "Partida em andamento! Clique em JOGAR: aparece a contagem de 5 segundos e você entra." : "Partida terminando... aguarde para entrar.";
  return (
    <div className="menu">
      {cdv > 0 && lob.pend !== undefined && (pend || lob.cd > 0) && <div id="cd" key={cdv}><small>{pend && lob.pc > 0 && !(lob.cd > 0) ? "Sua cobra entra em" : "A partida começa em"}</small>{cdv}</div>}
      <h1>🐍 Cobras.io online</h1>
      {notice && <div className="notice" onClick={clearNotice}>{notice}</div>}
      <div className="big">
        <div className="bh">{guest ? "👤 Convidado" : "🐍 Monte sua cobra"}</div>
        {!guest && <div className="chs">{Array.from({ length: Math.min(MAXC, chars.length + 1) }, (_, i) => <button key={i} disabled={pend} className={"btn chb" + (ci === i ? " on" : " g")} onClick={() => pick(i)}>{chars[i] ? chars[i].nm : "＋ Novo personagem"}</button>)}</div>}
        <Preview hd={guest ? -1 : hd} b={bd} />
        {!guest && <input className="nm big-nm" maxLength={NAME_MAX} value={nm} placeholder="Nome do personagem (único)" disabled={pend} onChange={e => setNm(e.target.value)} />}
        {err && <div className="err">{err}</div>}
        {!guest && <div className="ba"><button className="ab" disabled={pend} onClick={() => goH(-1)}>‹</button><span className="bn">Cabeça: {HEAD_NAMES[hd]}</span><button className="ab" disabled={pend} onClick={() => goH(1)}>›</button></div>}
        <div className="ba"><button className="ab" disabled={pend} onClick={() => goB(-1)}>‹</button><span className="bn">Corpo: {BODY_NAMES[bd]}</span><button className="ab" disabled={pend} onClick={() => goB(1)}>›</button></div>
        {guest && <p className="s">Convidado entra com cabeça de bot e nome sorteado, só escolhe o corpo e não aparece no Ranking do Dia. Entre com o Google para ter até 3 personagens salvos (nome, cabeça e corpo).</p>}
        <button className="btn go" disabled={!can} onClick={go}>{pend ? "Cancelar" : full ? "Partida cheia" : st === "play" ? "ENTRAR NA PARTIDA" : "JOGAR"}</button>
      </div>
      <p className="s">{full ? "A partida está cheia (10 jogadores). Aguarde alguém sair: o botão libera sozinho." : msg}</p>
      <ModePick lob={lob} send={send} open={open} />
      <Board sb={lob.sb} />
      <div className="act">
        <button className="btn g" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
        <button className="btn g" onClick={openDr}>📅 Ranking do Dia</button>
        {fsOk() && <button className="btn g fsb" onClick={() => toggleFs()}>⛶ Tela cheia</button>}
        {!pend && <button className="btn g" onClick={logout}>{guest ? "← Voltar" : "Sair da conta"}</button>}
      </div>
      {!fsOk() && /iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone && <p className="s ios">📱 iPhone: toque em Compartilhar → "Adicionar à Tela de Início" e abra pelo ícone para jogar em tela cheia.</p>}
      <p className="s">👥 Online agora: <b>{lob.on}</b> · Na partida: {lob.n} de {lob.mx}{lob.host ? " · 👑 Você é o admin" : ""}</p>
      <p className="s">← → trocam o corpo{guest ? "" : " e ↑ ↓ trocam a cabeça"}. No jogo: ← → (ou A D) giram a cobra; ↑ ↓ (ou W S) apontam para cima e para baixo. Acelerar: espaço, Shift ou clique. Mouse e dedo (joystick) também funcionam.</p>
    </div>
  );
}

// ---------- abertura (wallpaper + carregando) e entrada (Google / convidado) ----------
function Splash({ wait }) {
  return <div className="splash"><div className="ld"><div className="lb"><i /></div><small>{wait ? "Conectando ao servidor… pode levar até 1 minuto" : "Carregando…"}</small></div></div>;
}
function Login({ cid, dev, send, onGuest, onGoogle, authErr }) {
  const bx = useRef(), [bad, setBad] = useState("");
  const cb = useRef(); cb.current = onGoogle;
  useEffect(() => {
    if (!cid) return;
    const init = () => { try { window.google.accounts.id.initialize({ client_id: cid, callback: r => cb.current(r.credential) }); window.google.accounts.id.renderButton(bx.current, { theme: "filled_blue", size: "large", text: "signin_with", shape: "pill", locale: "pt-BR", width: 280 }); } catch (e) { setBad("Não foi possível carregar o botão do Google."); } };
    if (window.google && window.google.accounts) return init();
    let sc = document.getElementById("gsi"); if (!sc) { sc = document.createElement("script"); sc.id = "gsi"; sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; document.head.appendChild(sc); }
    sc.addEventListener("load", init); sc.addEventListener("error", () => setBad("Não foi possível carregar o login do Google (verifique a internet)."));
  }, [cid]);
  return (
    <div className="menu lg">
      <div className="lgb">
        <h1>🐍 Cobras Battle</h1>
        {cid ? <div ref={bx} className="gbtn" /> : <p className="s">Login com Google ainda não configurado no servidor.</p>}
        {(bad || authErr) && <div className="err">{bad || authErr}</div>}
        {dev && <button className="btn g" onClick={() => { const n = prompt("Nome de teste:"); if (n) send({ t: "auth", dev: n }); }}>(teste) entrar sem Google</button>}
        <button className="btn" onClick={onGuest}>Entrar como convidado</button>
        <p className="s">Com o Google você pode ter até 3 personagens (cada um com nome, cabeça e corpo salvos) e aparecer no Ranking do Dia. Como convidado você joga como um bot, só escolhe o corpo e não entra no ranking.</p>
      </div>
    </div>
  );
}

function Game({ send, muted, setMuted }) {
  const cv = useRef(), hud = useRef(), sc = useRef(), dd = useRef(), fin = useRef(), tail = useRef(), bn = useRef(), vg = useRef(), [conf, setConf] = useState(false);
  useEffect(() => { if (!conf) return; const t = setTimeout(() => setConf(false), 3000); return () => clearTimeout(t); }, [conf]);   // "Sair" pede um segundo toque para confirmar
  useEffect(() => runGame(cv.current, { hud: hud.current, sc: sc.current, dd: dd.current, fin: fin.current, tail: tail.current, bn: bn.current, vg: vg.current, send }), []);
  return (
    <div style={{ touchAction: "none" }}>
      <canvas ref={cv} style={{ touchAction: "none" }} />
      <div id="sc" ref={sc} />
      <div id="dd" ref={dd}>Você morreu 💀 e não tem mais vidas<br />aguardando o fim da partida...</div>
      <button id="fin" ref={fin} className="btn" onClick={() => send({ t: "fin" })}>Finalizar partida</button>
      <div id="tail" ref={tail} />
      <div id="vg" ref={vg} />
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
  const [scr, setScr] = useState("lobby"), [lob, setLob] = useState(null), [hi, setHi] = useState(null), [min, setMin] = useState(false), [end, setEnd] = useState(null), [muted, setMuted] = useState(false), [rc, setRc] = useState(0), [notice, setNotice] = useState(""), [err, setErr] = useState(""), [authErr, setAuthErr] = useState(""), [gk, setGk] = useState(0), [drOpen, setDrOpen] = useState(false), [drData, setDrData] = useState(null);
  const scrR = useRef("lobby"), rcR = useRef(false), kindR = useRef(null); scrR.current = scr;   // rc > 0: conexão caiu no meio da partida e estamos tentando voltar
  const wsr = useRef(null);
  useEffect(() => { const t = setTimeout(() => setMin(true), 2200); return () => clearTimeout(t); }, []);
  useEffect(() => { const f = () => startMusic(); window.addEventListener("pointerdown", f, { once: true }); return () => window.removeEventListener("pointerdown", f); }, []);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 7000); return () => clearTimeout(t); }, [err]);
  useEffect(() => {
    let ws, dead = false, pi;
    const open = () => {
      ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); wsr.current = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ t: "hello", rid: RID, tok: lsGet("cobras_tok") })); pi = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 20000); };
      ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.t === "lobby") { setLob(m); if (!rcR.current) setScr(s => m.st === "lobby" ? "lobby" : s === "end" || s === "play" ? s : "lobby"); }
        else if (m.t === "dr") setDrData(m);
        else if (m.t === "hi") {
          setHi(m); if (lsGet("cobras_tok") && !m.has) lsSet("cobras_tok", null);   // sessão antiga/inválida
          if (rcR.current && !m.resumed) { rcR.current = false; setRc(0); setScr("lobby"); setNotice("📡 A conexão caiu e a partida acabou (ou o servidor reiniciou) enquanto você estava fora. Clique em JOGAR para entrar de novo."); }
          if (!m.resumed && !m.has && kindR.current === "guest") ws.send(JSON.stringify({ t: "guest", b: +lsGet("cobras_gb") || 0 }));
        }
        else if (m.t === "auth") { if (m.ok) { lsSet("cobras_tok", m.tok); setAuthErr(""); startMusic(); } else setAuthErr(m.err || "Falha no login."); }
        else if (m.t === "err") setErr(m.m);
        else if (m.t === "start") { rcR.current = false; setRc(0); setNotice(""); setErr(""); resetStore(m); setGk(k => k + 1); setScr("play"); }
        else if (m.t === "left") setScr("lobby");
        else if (m.t === "vroster") voice.roster(m.p);
        else if (m.t === "vsig") voice.sig(m);
        else if (m.t === "vstat") voice.stat(m);
        else if (m.t === "ev") onEvent(m);
        else if (m.t === "s") onSnap(m);
        else if (m.t === "l") { ST.l = m.l; ST.lv++; }
        else if (m.t === "end") { setEnd(m); setScr("end"); m.w === ST.you ? sfx.win() : sfx.end(); }
      };
      ws.onclose = () => { clearInterval(pi); voice.reset(); voice.stat({ n: 0, sp: 0 }); setHi(null); if (!dead) { if (scrR.current === "play" || rcR.current) { rcR.current = true; setRc(n => n + 1); } setTimeout(open, 2000); } };
    };
    open();
    return () => { dead = true; clearInterval(pi); ws && ws.close(); };
  }, []);
  const send = o => { const w = wsr.current; if (w && w.readyState === 1) w.send(JSON.stringify(o)); };
  voice.bind(send);
  const openDr = () => { setDrOpen(true); send({ t: "dr" }); };
  const drModal = drOpen && <DailyRank data={drData} onClose={() => setDrOpen(false)} refresh={() => send({ t: "dr" })} />;
  const logout = () => { sfx.click(); kindR.current = null; lsSet("cobras_tok", null); send({ t: "logout" }); };

  if (scr === "play") return <><Game key={gk} send={send} muted={muted} setMuted={setMuted} /><VoiceBar />{rc > 0 && <div className="rcn"><div><i>🔄</i> Conexão perdida</div><div>Reconectando… (tentativa {rc})</div><small>Sua cobra continua jogando sozinha por até 45 segundos. Se o servidor estava dormindo, pode levar até 1 minuto para acordar. Não feche esta página.</small></div>}</>;
  if (scr === "end" && end) {
    const rank = end.l.map(([i, c]) => ({ n: ST.names[i], cm: c / 10, main: i < NSEL, me: i === ST.you }));
    return (
      <><VoiceBar /><div className="ov">
        <h1>🏆 Ranking final</h1>
        {end.md === "elim" && !end.te
          ? <p className="sub">{rank[0].main ? `🏁 Último jogador vivo: ${rank[0].n}` : "💀 Todos os jogadores foram eliminados"}</p>
          : <><p className="sub">Quem tem a maior cobra é {rank[0].n} com {rank[0].cm.toFixed(1)} cm{end.md === "elim" ? " (soma das vidas)" : ""}</p>
            <p className="sub">Quem tem a menor cobra é {rank[rank.length - 1].n} com {rank[rank.length - 1].cm.toFixed(1)} cm</p></>}
        <Rank rank={rank} />
        <Board sb={end.sb} />
        <button className="btn g" onClick={openDr}>📅 Ranking do Dia</button>
        <button className="btn" onClick={() => { sfx.click(); send({ t: "restart" }); }}>Reiniciar partida</button>
      </div>{drModal}</>
    );
  }
  if (!hi || !lob || !min) return <Splash wait={min} />;
  if (!lob.kind) return <><Login cid={hi.cid} dev={hi.dev} send={send} authErr={authErr} onGuest={() => { sfx.click(); startMusic(); kindR.current = "guest"; send({ t: "guest", b: +lsGet("cobras_gb") || 0 }); }} onGoogle={cred => { startMusic(); send({ t: "auth", cred }); }} /></>;
  return <><Lobby key={lob.kind} lob={lob} send={send} muted={muted} setMuted={setMuted} notice={notice} clearNotice={() => setNotice("")} openDr={openDr} err={err} clearErr={() => setErr("")} logout={logout} /><VoiceBar />{drModal}</>;
}
