// Ranking do Dia: estatísticas de cada jogador humano no dia (horário de Brasília) + trava de cabeça e corpo por dia.
// Tudo fica em memória (rápido) e é gravado no MongoDB Atlas quando a variável MONGODB_URI existe, para sobreviver ao servidor dormir/reiniciar.
// Sem MONGODB_URI (ou se o Atlas estiver fora do ar) o jogo funciona normalmente, só que o ranking do dia fica em memória.

export const dayKey = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });   // "2026-11-19"

const KEEP_DAYS = 90;   // o Atlas apaga sozinho os dias mais antigos que isso
let day = dayKey(), col = null, uriLog = false;
let cache = new Map();         // pid (código do navegador) -> documento do dia
const dirty = new Map();       // _id -> documento que ainda não foi gravado no banco

const blank = (pid, name) => ({ _id: day + "|" + pid, day, pid, name: name || "", head: null, body: null, lock: null, plays: 0, wins: 0, winsTime: 0, winsElim: 0, best: 0, total: 0, secs: 0, upd: Date.now(), exp: new Date(Date.now() + KEEP_DAYS * 864e5) });

function roll() {   // virou o dia (meia-noite em Brasília): zera o cache; o que faltava gravar do dia anterior continua na fila
  const k = dayKey(); if (k === day) return false;
  day = k; cache = new Map(); loadDay(); return true;
}
export const checkDay = roll;

async function loadDay() {
  if (!col) return;
  const d = day;
  try {
    const arr = await col.find({ day: d }).toArray();
    if (d !== day) return;
    for (const x of arr) if (!cache.has(x.pid)) cache.set(x.pid, x);   // o que já está em memória (mais novo) prevalece
  } catch (e) { console.log("[ranking] falha ao ler o dia:", e.message); }
}

export async function flush() {
  if (!col || !dirty.size) return;
  for (const [id, doc] of [...dirty]) {
    try { await col.replaceOne({ _id: id }, doc, { upsert: true }); if (dirty.get(id) === doc) dirty.delete(id); }
    catch (e) { console.log("[ranking] falha ao gravar:", e.message); return; }
  }
}
const touch = doc => { doc.upd = Date.now(); dirty.set(doc._id, doc); };

// opts.collection: coleção já pronta (usado em testes). Normalmente usa MONGODB_URI.
export async function initDaily(opts = {}) {
  if (opts.collection) { col = opts.collection; await loadDay(); }
  else await connect();
  setInterval(() => { flush(); }, 4000).unref();
  for (const sig of ["SIGTERM", "SIGINT"]) process.once(sig, async () => { try { await Promise.race([flush(), new Promise(r => setTimeout(r, 3000))]); } finally { process.exit(0); } });
}
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { if (!uriLog) { uriLog = true; console.log("[ranking] MONGODB_URI não definida: ranking do dia só em memória (zera quando o servidor reinicia)"); } return; }
  try {
    const { MongoClient } = await import("mongodb");
    const cl = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, appName: "cobras-online" });
    await cl.connect();
    const c = cl.db(process.env.MONGODB_DB || "cobras").collection("daily");
    await c.createIndex({ exp: 1 }, { expireAfterSeconds: 0 });
    await c.createIndex({ day: 1 });
    col = c; console.log("[ranking] MongoDB conectado");
    await loadDay();
  } catch (e) {
    console.log("[ranking] MongoDB indisponível (" + e.message + "): usando memória e tentando de novo em 60 s");
    col = null; setTimeout(connect, 60000).unref();
  }
}

// ---------- trava de cabeça e corpo ----------
const get = pid => { roll(); return cache.get(pid); };
export const lockOf = pid => { const d = pid && get(pid); return d && d.lock ? d.lock : null; };   // { h, b } ou null
export function lockedHeadsExcept(pid) {   // cabeças que outras pessoas já travaram hoje
  roll(); const s = new Set(); for (const d of cache.values()) if (d.lock && d.pid !== pid) s.add(d.lock.h); return s;
}
// trava a cabeça e o corpo da pessoa para o resto do dia (chamado quando ela entra na 1ª partida do dia); não trava se outra pessoa já tem essa cabeça
export function lockFor(pid, head, body, name) {
  if (!pid) return null; roll();
  let d = cache.get(pid); if (!d) { d = blank(pid, name); cache.set(pid, d); }
  if (d.lock) return d.lock;
  if (lockedHeadsExcept(pid).has(head)) return null;
  d.lock = { h: head, b: body }; d.head = head; d.body = body; if (name) d.name = name; touch(d); return d.lock;
}

// ---------- estatísticas ----------
// final: tamanho final (cm) | best: maior tamanho (cm) | win: venceu? | mode: "time" | "elim" | secs: tempo jogado
export function record(pid, { name, head, body, final, best, win, mode, secs }) {
  if (!pid) return; roll();
  let d = cache.get(pid); if (!d) { d = blank(pid, name); cache.set(pid, d); }
  if (name) d.name = name;
  if (d.lock) { d.head = d.lock.h; d.body = d.lock.b; } else { if (head != null) d.head = head; if (body != null) d.body = body; }
  d.plays++; d.total = Math.round((d.total + (final || 0)) * 10) / 10; d.best = Math.max(d.best, Math.round((best || 0) * 10) / 10); d.secs += Math.max(0, secs | 0);
  if (win) { d.wins++; if (mode === "elim") d.winsElim++; else d.winsTime++; }
  touch(d);
}

// linhas do ranking: só quem jogou hoje; mais vitórias primeiro, depois melhor tamanho e mais partidas
export function rows() {
  roll();
  return [...cache.values()].filter(d => d.plays > 0)
    .sort((a, b) => b.wins - a.wins || b.best - a.best || b.plays - a.plays)
    .map(d => ({ n: d.name, h: d.head, w: d.wins, wt: d.winsTime, we: d.winsElim, p: d.plays, b: d.best, t: d.total, s: d.secs }));
}
export const today = () => { roll(); return day; };
