// Ranking do Dia: estatísticas de cada JOGADOR COM CONTA no dia (horário de Brasília). Uma linha por pessoa e por cabeça usada.
// Fica em memória (rápido) e é gravado no MongoDB Atlas quando existe (via db.js). Convidados não entram.
import { onDb, onFlush } from "./db.js";

export const dayKey = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });   // "2026-11-19"

const KEEP_DAYS = 90;   // o Atlas apaga sozinho os dias mais antigos que isso
let day = dayKey(), col = null;
let cache = new Map();         // sub (id da conta) -> documento do dia
const dirty = new Map();       // _id -> documento que ainda não foi gravado no banco

const blank = (key, name, sub, head) => ({ _id: day + "|" + key, v: 3, day, key, sub, name: name || "", head, plays: 0, wins: 0, winsTime: 0, winsElim: 0, best: 0, total: 0, secs: 0, upd: Date.now(), exp: new Date(Date.now() + KEEP_DAYS * 864e5) });

function roll() {   // virou o dia (meia-noite em Brasília): zera o cache; o que faltava gravar do dia anterior continua na fila
  const k = dayKey(); if (k === day) return false;
  day = k; cache = new Map(); loadDay(); return true;
}
export const checkDay = roll;

async function loadDay() {
  if (!col) return;
  const d = day;
  try {
    const arr = await col.find({ day: d, v: 3 }).toArray();
    if (d !== day) return;
    for (const x of arr) if (!cache.has(x.key)) cache.set(x.key, x);   // o que já está em memória (mais novo) prevalece
  } catch (e) { console.log("[ranking] falha ao ler o dia:", e.message); }
}

async function flush() {
  if (!col || !dirty.size) return;
  for (const [id, doc] of [...dirty]) {
    try { await col.replaceOne({ _id: id }, doc, { upsert: true }); if (dirty.get(id) === doc) dirty.delete(id); }
    catch (e) { console.log("[ranking] falha ao gravar:", e.message); return; }
  }
}
export { flush };
const touch = doc => { doc.upd = Date.now(); dirty.set(doc._id, doc); };

onFlush(flush);
onDb(async db => {
  const c = db.collection("daily");
  try { await c.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }); await c.createIndex({ day: 1 }); } catch (e) {}
  col = c; await loadDay();
});

// final: tamanho final (cm) | best: maior tamanho (cm) | win: venceu? | mode: "time" | "elim" | secs: tempo jogado
export function record(sub, { ci, name, head, final, best, win, mode, secs }) {
  if (!sub || ci == null) return; roll();
  const key = sub + ":" + ci;   // uma linha por personagem (até 3 por conta)
  let d = cache.get(key); if (!d) { d = blank(key, name, sub, head); cache.set(key, d); d.ci = ci; }
  if (name) d.name = name;
  if (head != null && head >= 0) d.head = head;
  d.plays++; d.total = Math.round((d.total + (final || 0)) * 10) / 10; d.best = Math.max(d.best, Math.round((best || 0) * 10) / 10); d.secs += Math.max(0, secs | 0);
  if (win) { d.wins++; if (mode === "elim") d.winsElim++; else d.winsTime++; }
  touch(d);
}
// um personagem trocou de nome: atualiza a linha de hoje dele
export function rename(sub, ci, name) { roll(); const d = cache.get(sub + ":" + ci); if (d) { d.name = name; touch(d); } }

// linhas do ranking: só quem jogou hoje; mais vitórias primeiro, depois melhor tamanho e mais partidas
export function rows() {
  roll();
  return [...cache.values()].filter(d => d.plays > 0)
    .sort((a, b) => b.wins - a.wins || b.best - a.best || b.plays - a.plays)
    .map(d => ({ n: d.name, h: d.head, w: d.wins, wt: d.winsTime, we: d.winsElim, p: d.plays, b: d.best, t: d.total, s: d.secs }));
}
export const today = () => { roll(); return day; };
