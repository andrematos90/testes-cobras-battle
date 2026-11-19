// Sala de voz direta (WebRTC, malha P2P): o áudio vai de jogador para jogador, o servidor só repassa a sinalização.
// O módulo vive fora do React para a voz continuar ligada ao passar do lobby para a partida e para o ranking.
import React, { useSyncExternalStore } from "react";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };   // sem TURN: ~10-20% das redes (4G, rede de empresa) podem não conectar
let send = () => {}, local = null, ac = null, needInit = false;
const peers = new Map();   // id -> { id, nm, pc, audio, an, sp, spT, st, q }
const S = { on: false, muted: false, err: "", self: false, list: [] };
let room = { n: 0, sp: 0 }, spTimer = 0;   // room: quantas pessoas na conversa e quantas falando (vindo do servidor, vale para quem ainda não entrou)
let snap = { ...S }; const subs = new Set();
const emit = () => {
  const list = [{ id: "me", nm: "Você", sp: S.self && !S.muted, st: "ok" }, ...[...peers.values()].map(p => ({ id: p.id, nm: p.nm, sp: p.sp, st: p.st }))];
  snap = { on: S.on, muted: S.muted, err: S.err, list, talk: room.sp > 0 }; subs.forEach(f => f());
};
const ctx = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());

// medidor de volume (quem está falando)
function meter(stream, cb) {
  try {
    const c = ctx(), an = c.createAnalyser(); an.fftSize = 512; c.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize); let hold = 0, cur = false;
    const iv = setInterval(() => {
      an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
      const now = performance.now(); if (m > 9) hold = now + 350; const on = now < hold; if (on !== cur) { cur = on; cb(on); }
    }, 120);
    return () => clearInterval(iv);
  } catch (e) { return () => {}; }
}

function mkPeer(id, nm) {
  let p = peers.get(id); if (p) { if (nm) p.nm = nm; return p; }
  p = { id, nm: nm || "Jogador", pc: null, audio: null, stop: null, sp: false, st: "…", q: [] }; peers.set(id, p); return p;
}
function mkPc(p) {
  const pc = new RTCPeerConnection(ICE); p.pc = pc;
  if (local) for (const t of local.getTracks()) pc.addTrack(t, local);
  pc.onicecandidate = e => { if (e.candidate) send({ t: "vsig", to: p.id, d: { ice: e.candidate } }); };
  pc.onconnectionstatechange = () => { p.st = pc.connectionState === "connected" ? "ok" : pc.connectionState === "failed" ? "failed" : "…"; emit(); };
  pc.ontrack = e => {
    const st = e.streams[0] || new MediaStream([e.track]);
    if (!p.audio) { p.audio = new Audio(); p.audio.autoplay = true; }
    p.audio.srcObject = st; p.audio.play().catch(() => {});
    p.stop?.(); p.stop = meter(st, on => { p.sp = on; emit(); });
  };
  return pc;
}
function drop(id) {
  const p = peers.get(id); if (!p) return;
  try { p.pc?.close(); } catch (e) {} p.stop?.(); if (p.audio) { p.audio.srcObject = null; } peers.delete(id);
}
async function call(p) {   // quem entra na sala liga para quem já estava nela
  const pc = mkPc(p);
  try { await pc.setLocalDescription(await pc.createOffer()); send({ t: "vsig", to: p.id, d: { sdp: pc.localDescription } }); } catch (e) { p.st = "failed"; emit(); }
}

export async function join() {
  if (S.on) return;
  if (!navigator.mediaDevices?.getUserMedia) { S.err = "Microfone indisponível (o site precisa abrir em https)"; emit(); return; }
  try { local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { S.err = e && e.name === "NotAllowedError" ? "Permita o microfone no navegador" : "Não achei um microfone"; emit(); return; }
  S.err = ""; S.on = true; S.muted = false; needInit = true;
  S.stopSelf = meter(local, on => { S.self = on; if (!S.muted) send({ t: "vsp", on }); emit(); });
  send({ t: "vjoin" }); emit();
}
export function leave() {
  if (!S.on) return; send({ t: "vleave" }); reset();
}
export function toggleMute() { if (!local) return; S.muted = !S.muted; local.getAudioTracks().forEach(t => { t.enabled = !S.muted; }); if (S.muted) send({ t: "vsp", on: false }); emit(); }
// fecha tudo (sair da voz ou perder a conexão com o servidor)
export function reset() {
  for (const id of [...peers.keys()]) drop(id);
  S.stopSelf?.(); S.stopSelf = null; local?.getTracks().forEach(t => t.stop()); local = null; S.on = false; S.self = false; S.muted = false; needInit = false; emit();
}
export function bind(fn) { send = fn; }
// estado da conversa vindo do servidor: o botão pisca enquanto alguém fala (segura 3 s para não ficar piscando a cada pausa)
export function stat(m) {
  clearTimeout(spTimer);
  if (m.sp > 0) { room = { n: m.n, sp: m.sp }; emit(); }
  else { room = { n: m.n, sp: room.sp }; emit(); spTimer = setTimeout(() => { room = { n: room.n, sp: 0 }; emit(); }, 3000); }
}

// lista de quem está na sala (o servidor manda sem você)
export function roster(list) {
  if (!S.on) return;
  const ids = new Set(list.map(x => x.id));
  for (const id of [...peers.keys()]) if (!ids.has(id)) drop(id);
  const fresh = [];
  for (const x of list) { const had = peers.has(x.id); mkPeer(x.id, x.nm); if (!had) fresh.push(peers.get(x.id)); }
  if (needInit) { needInit = false; for (const p of peers.values()) if (!p.pc) call(p); }   // primeira lista depois de entrar: ligo para todos
  emit();
}
export async function sig(m) {
  if (!S.on) return;
  const p = mkPeer(m.from), d = m.d || {};
  try {
    if (d.sdp) {
      if (d.sdp.type === "offer") {
        const pc = p.pc || mkPc(p);
        await pc.setRemoteDescription(d.sdp);
        await pc.setLocalDescription(await pc.createAnswer()); send({ t: "vsig", to: p.id, d: { sdp: pc.localDescription } });
      } else if (p.pc) await p.pc.setRemoteDescription(d.sdp);
      for (const c of p.q.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
    } else if (d.ice) {
      if (p.pc && p.pc.remoteDescription) await p.pc.addIceCandidate(d.ice).catch(() => {}); else p.q.push(d.ice);
    }
  } catch (e) { p.st = "failed"; }
  emit();
}

export function VoiceBar() {
  const v = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => snap);
  const b = (e, fn) => { fn(); e.currentTarget.blur(); };   // tira o foco: a barra de espaço (acelerar) não deve "clicar" no botão
  return (
    <div id="voice">
      <div className="vrow">
        {!v.on
          ? <button tabIndex={-1} className={"vb" + (v.talk ? " blink" : "")} onClick={e => b(e, join)}>🎤 Entrar na Conversa</button>
          : <><button tabIndex={-1} className={"vb" + (v.muted ? " mu" : " live")} onClick={e => b(e, toggleMute)}>{v.muted ? "🔇 Mudo" : "🎙️ Microfone"}</button>
            <button tabIndex={-1} className="vb" onClick={e => b(e, leave)}>✖ Sair</button></>}
      </div>
      {v.err && <div className="verr">{v.err}</div>}
      {v.on && v.list.length > 1 && <div className="vl">{v.list.map(p => <div key={p.id} className={p.sp ? "sp" : ""}>{p.sp ? "🔊" : "·"} {p.nm}{p.st === "failed" ? " ⚠ sem conexão" : ""}</div>)}</div>}
    </div>
  );
}
