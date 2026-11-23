// Contas: login com Google (só confere o ID token do Google, sem senha) + perfil salvo (nome único, cabeça e corpo).
// A sessão no navegador é um token assinado por nós (HMAC), guardado no localStorage. Usuários ficam em memória e no MongoDB (coleção "users").
import crypto from "crypto";
import { onDb, onFlush } from "./db.js";
import { today } from "./daily.js";
import { NAME_MAX, NH, NB } from "../shared/config.js";

const b64u = b => Buffer.from(b).toString("base64url");
const SECRET = crypto.createHash("sha256").update("cobras:" + (process.env.SESSION_SECRET || process.env.MONGODB_URI || crypto.randomBytes(16).toString("hex"))).digest();
if (!process.env.SESSION_SECRET && !process.env.MONGODB_URI) console.log("[contas] SESSION_SECRET não definida: quem estava logado precisará entrar de novo quando o servidor reiniciar");
const TOKEN_DAYS = 90;

export const clientId = () => process.env.GOOGLE_CLIENT_ID || "";
export const devLogin = () => process.env.DEV_LOGIN === "1";   // só para testes; em produção fica desligado

const users = new Map(), byName = new Map(), dirty = new Map();   // sub -> usuário | nome minúsculo -> sub | sub -> usuário ainda não gravado
let col = null;
const nk = n => String(n || "").trim().toLowerCase();
export const cleanName = v => String(v ?? "").replace(/[\u0000-\u001f<>&"]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

onFlush(flush);
onDb(async db => {
  const c = db.collection("users");
  col = c;
  try { for (const u of await c.find({}).toArray()) if (!users.has(u._id)) put(u); console.log("[contas] " + users.size + " conta(s) carregada(s)"); }
  catch (e) { console.log("[contas] falha ao ler contas:", e.message); }
});
async function flush() {
  if (!col || !dirty.size) return;
  for (const [id, u] of [...dirty]) {
    try { await col.replaceOne({ _id: id }, u, { upsert: true }); if (dirty.get(id) === u) dirty.delete(id); }
    catch (e) { console.log("[contas] falha ao gravar:", e.message); return; }
  }
}
export { flush };
export const MAX_CHARS = 3;   // uma conta pode ter até 3 personagens (cada um com nome único, cabeça e corpo)
function put(u) {
  u.sub = u._id; users.set(u._id, u);
  if (!u.chars) { u.chars = u.nm ? [{ nm: u.nm, nmKey: u.nmKey, head: u.head ?? 0, body: u.body ?? 0 }] : []; u.last = 0; }   // conta antiga: vira o personagem 1
  u.chars.forEach((c, i) => byName.set(c.nmKey, u._id + "#" + i));
}
const save = u => { dirty.set(u._id, u); };

export const publicUser = u => u ? { chars: u.chars.map(c => ({ nm: c.nm, head: c.head, body: c.body, lk: c.lockDay === today() ? 1 : 0 })), sel: u.last || 0 } : null;

// ---------- sessão (token nosso) ----------
export function makeToken(sub) {
  const p = b64u(JSON.stringify({ s: sub, e: Date.now() + TOKEN_DAYS * 864e5 }));
  return p + "." + crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
}
export function userFromToken(tok) {
  if (typeof tok !== "string" || tok.length > 600) return null;
  const [p, sg] = tok.split("."); if (!p || !sg) return null;
  const ok = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  if (sg.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(sg), Buffer.from(ok))) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.e > Date.now() ? users.get(o.s) || null : null; } catch { return null; }
}

// ---------- Google ----------
let certs = null, certsExp = 0, certsProvider = null;
export const _setCerts = fn => { certsProvider = fn; certs = null; certsExp = 0; };   // testes
async function getCerts() {
  if (certsProvider) return certsProvider();
  if (certs && Date.now() < certsExp) return certs;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs"); if (!r.ok) throw new Error("certs " + r.status);
  const j = await r.json(), m = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  certs = j.keys || []; certsExp = Date.now() + (m ? +m[1] : 3600) * 1000; return certs;
}
// confere assinatura (RS256), emissor, público (nosso Client ID) e validade do ID token do Google
export async function verifyGoogle(cred) {
  const id = clientId(); if (!id) throw new Error("Login com Google não configurado no servidor");
  if (typeof cred !== "string" || cred.length > 5000) throw new Error("credencial inválida");
  const parts = cred.split("."); if (parts.length !== 3) throw new Error("credencial inválida");
  const head = JSON.parse(Buffer.from(parts[0], "base64url").toString()), pay = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (head.alg !== "RS256") throw new Error("algoritmo inválido");
  const jwk = (await getCerts()).find(k => k.kid === head.kid); if (!jwk) throw new Error("chave desconhecida");
  const okSig = crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
  if (!okSig) throw new Error("assinatura inválida");
  if (pay.aud !== id) throw new Error("público inválido");
  if (pay.iss !== "accounts.google.com" && pay.iss !== "https://accounts.google.com") throw new Error("emissor inválido");
  if (!(pay.exp * 1000 > Date.now())) throw new Error("credencial expirada");
  if (!pay.sub) throw new Error("sem identificação");
  return { sub: "g" + pay.sub };   // do Google guardamos só o identificador (nunca e-mail nem nome)
}
function getOrCreate(sub) {
  let u = users.get(sub);
  if (!u) { u = { _id: sub, sub, chars: [], last: 0, created: Date.now() }; users.set(sub, u); save(u); }
  return u;
}
export async function login(cred) { const g = await verifyGoogle(cred); return getOrCreate(g.sub); }
export function loginDev(name) {   // só com DEV_LOGIN=1
  if (!devLogin()) throw new Error("login de teste desligado");
  return getOrCreate("dev-" + nk(name).replace(/[^\w-]/g, "").slice(0, 30));
}

// ---------- perfil ----------
// Cada personagem (até 3 por conta) tem nome único (sem diferenciar maiúsculas); cabeça e corpo são livres. idx = qual personagem; idx == chars.length cria um novo.
export function setProfile(u, { idx, nm, head, body }) {
  if (!Number.isInteger(idx) || idx < 0 || idx > u.chars.length || idx >= MAX_CHARS) return { err: "Personagem inválido." };
  const n = cleanName(nm);
  if (n.length < 2) return { err: "Digite um nome (mínimo 2 letras)." };
  const k = nk(n), owner = byName.get(k), me = u.sub + "#" + idx;
  if (owner && owner !== me) return { err: "Esse nome já está em uso. Cada personagem precisa de um nome só dele." };
  let c = u.chars[idx]; const isNew = !c;
  if (isNew) c = { nm: "", nmKey: null, head: Math.random() * NH | 0, body: Math.random() * NB | 0 };
  if (!Number.isInteger(head) || head < 0 || head >= NH) head = c.head;
  if (!Number.isInteger(body) || body < 0 || body >= NB) body = c.body;
  // nome e cabeça de cada personagem ficam TRAVADOS até o dia seguinte (meia-noite em Brasília) depois de salvos; o corpo continua livre
  const td = today(), changed = isNew || c.nm !== n || c.head !== head;
  if (!isNew && c.lockDay === td && changed) return { err: "O nome e a cabeça deste personagem só podem ser mudados amanhã (a partir da meia-noite, horário de Brasília). O corpo você pode trocar quando quiser." };
  if (changed && u.chars.some((o, j) => j !== idx && o && o.head === head)) return { err: "Cada personagem precisa de uma cabeça diferente das outras dos seus personagens." };
  if (c.nmKey && c.nmKey !== k) byName.delete(c.nmKey);
  const renamed = c.nm !== n;
  if (changed) c.lockDay = td;
  c.nm = n; c.nmKey = k; c.head = head; c.body = body; u.chars[idx] = c; u.last = idx; byName.set(k, me); save(u);
  return { ok: true, renamed, idx };
}
