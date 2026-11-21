// Conexão única com o MongoDB Atlas (variável MONGODB_URI). Quem precisa do banco (ranking do dia, contas) se registra com onDb().
// Sem MONGODB_URI (ou se o Atlas estiver fora do ar) tudo funciona em memória, só que não sobrevive a reinício do servidor.
const subs = [], flushers = [];
let db = null, uriLog = false;
export const onDb = fn => { subs.push(fn); if (db) fn(db).catch?.(() => {}); };   // fn(db) roda assim que o banco conecta (e de novo se reconectar)
export const onFlush = fn => flushers.push(fn);
export const flushAll = async () => { for (const f of flushers) { try { await f(); } catch (e) {} } };

// opts.db: banco já pronto (usado em testes), com .collection(nome)
export async function initDb(opts = {}) {
  if (opts.db) { db = opts.db; for (const f of subs) await f(db); }
  else await connect();
  setInterval(() => { flushAll(); }, 4000).unref();
  for (const sig of ["SIGTERM", "SIGINT"]) process.once(sig, async () => { try { await Promise.race([flushAll(), new Promise(r => setTimeout(r, 3000))]); } finally { process.exit(0); } });
}
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { if (!uriLog) { uriLog = true; console.log("[db] MONGODB_URI não definida: ranking e contas só em memória (somem quando o servidor reinicia)"); } return; }
  try {
    const { MongoClient } = await import("mongodb");
    const cl = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, appName: "cobras-online" });
    await cl.connect();
    db = cl.db(process.env.MONGODB_DB || "cobras"); console.log("[db] MongoDB conectado");
    for (const f of subs) await f(db);
  } catch (e) {
    console.log("[db] MongoDB indisponível (" + e.message + "): usando memória e tentando de novo em 60 s");
    db = null; setTimeout(connect, 60000).unref();
  }
}
