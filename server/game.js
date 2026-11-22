import { WD, TIME, NS, NSEL, NH, HEAD_NAMES, BOT_NAMES, BOT_NAMES2, BOT_NAMES_EXTRA, LIVES, NB, CONDOMS, CONDOM_HITS, TAPER, DROP_V, INV_TIME, PILLS, PILL_STIFF, PILL_MAX_CM, PILL_BACK, TURN_R0, TURN_RK, EAT_PAD, MAX_DROPS, BODY_MAX, CARD_BACK, CARD_START_CM, CARD_SHRINK_SECS, CARD_GROW_TIERS, FOOD_HOT, FOOD_BG, FOOD_HOT_MOVE, CARD_SHRINK_TO, CARD_GROW_SECS, CARD_GROW_ACCEL, CARDS_POR_TIPO, CARD_BOOST_BELOW_CM, CARD_BOOST_TO_CM, CARD_BOOST_SECS, VIEW_SPAN } from "../shared/config.js";

// card 3 (furacão): chance de a partida ter furacão, quantos cards no máximo (sorteia de 1 até HUR_MAX, cada um num momento diferente), janela de tempo em que aparecem (s), tempo de voo, tempo total sem controle, fração do tamanho que sobra ao bater no canto
const HUR_TESTE = false;   // true = MODO TESTE: 8 cards de furacão desde o começo de TODA partida (voltam 15 s depois de pegos). Mude para false para voltar ao normal (30% das partidas, 1 a 3 cards)
const HUR_CHANCE = .30, HUR_MAX = 3, HUR_AT = [60, 540], HUR_FLY = 2.5, HUR_STUN = 3, HUR_KEEP = .2;
const BIG_FROM = 100, BIG_FULL = 200, BIG_BONUS = .5;   // aceleração das cobras grandes (cm de onde começa, cm onde chega ao máximo, bônus máximo = 50%)
export function createGame(human, bodies = [], mode = "time", heads = [], pnames = [], guests = []) {
  const TM = mode === "time";   // "time": 10 min, renasce sem limite (bots também), vale o tamanho no fim | "elim": sem tempo, 3 vidas, bots não renascem, vence o último humano vivo
  let elimN = 0;   // quantos humanos já foram eliminados de vez (modo elim)
  const rnd = n => (Math.random() - .5) * n;
    const R = s => { const x = s.cm / 4.76; return 10 + Math.min(x, 30) * 1.5 + Math.max(0, x - 30) * .3; };   // espessura cresce 4,76x mais devagar (a grossura que era de 42 cm agora é de ~200 cm)
  const L = s => Math.max(8, 14 + (s.cm * 10 | 0));
  // comida guardada em grade de células (rápido para buscar perto)
  const CS = 200, grid = new Map();
  let nfood = 0, drops = [];
  const key = (x, y) => Math.max(0, (x + WD / 2) / CS | 0) * 100 + Math.max(0, (y + WD / 2) / CS | 0);
  const add = f => { const k = key(f.x, f.y); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(f); nfood++; return f; };
  const near = (x, y, r, fn) => {
    const o = WD / 2, x0 = Math.max(0, (x + o - r) / CS | 0), x1 = Math.min(52, (x + o + r) / CS | 0),
      y0 = Math.max(0, (y + o - r) / CS | 0), y1 = Math.min(52, (y + o + r) / CS | 0);
    for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) { const c = grid.get(a * 100 + b); if (c) fn(c); }
  };
  // pontos de comida: cada um tem um peso (muito / médio / pouco / quase nada) e um raio; posições sorteadas a cada partida e um ponto muda de lugar de tempos em tempos
  const HOT = [], hpos = () => ({ x: rnd(WD - 1400), y: rnd(WD - 1400) });
  for (const [n, w, r] of FOOD_HOT) for (let i = 0; i < n; i++) HOT.push({ ...hpos(), w: w * (.75 + Math.random() * .5), r });
  let hotTot = HOT.reduce((a, h) => a + h.w, 0), hm = FOOD_HOT_MOVE[0] + Math.random() * (FOOD_HOT_MOVE[1] - FOOD_HOT_MOVE[0]);
  const lim = WD / 2 - 50;
  const nf = () => {
    let x, y;
    if (Math.random() < FOOD_BG) { x = rnd(WD - 100); y = rnd(WD - 100); }
    else {
      let t = Math.random() * hotTot, h = HOT[HOT.length - 1]; for (const q of HOT) { t -= q.w; if (t <= 0) { h = q; break; } }
      const a = Math.random() * 6.2832, d = h.r * Math.pow(Math.random(), .8);
      x = Math.max(-lim, Math.min(lim, h.x + Math.cos(a) * d)); y = Math.max(-lim, Math.min(lim, h.y + Math.cos(a - 1.5708) * d));
    }
    return { x, y, v: 1 + (Math.random() * 2 | 0), e: Math.random() * 4 | 0 };
  };
  for (let i = 0; i < 1800; i++) add(nf());

  // cabeça e nome de cada uma das cobras selecionáveis: jogadores usam a escolha deles; as vagas sem jogador (bots) ganham cabeças que ninguém está usando
  const hdUsed = new Set(); for (let i = 0; i < NSEL; i++) if (human[i]) hdUsed.add(heads[i]);
  const lc = x => String(x || "").trim().toLowerCase();
  const hNames = new Set(); for (let i = 0; i < NSEL; i++) if (human[i]) hNames.add(lc(pnames[i] || HEAD_NAMES[heads[i]]));   // nomes dos humanos: nenhum bot pode ter o mesmo
  const hdFree = []; for (let h = 0; h < NH; h++) if (!hdUsed.has(h) && !hNames.has(lc(HEAD_NAMES[h]))) hdFree.push(h);
  const HD = []; for (let i = 0; i < NSEL; i++) HD.push(human[i] && heads[i] != null ? heads[i] : hdFree.length ? hdFree.shift() : i % NH);
  // lista dinâmica: junta todas as listas de nomes (sem repetir) e embaralha a cada partida; cada bot pega o próximo nome da fila
  const HN = new Set(HEAD_NAMES.map(lc));   // nomes de cabeças (de jogadores) também ficam fora da lista dos bots
  const BN = [...new Set([...BOT_NAMES, ...BOT_NAMES2, ...BOT_NAMES_EXTRA])].filter(n => !HN.has(lc(n)) && !hNames.has(lc(n)));
  for (let k = BN.length - 1; k > 0; k--) { const j = Math.random() * (k + 1) | 0; [BN[k], BN[j]] = [BN[j], BN[k]]; }
  const mk = i => {
    const x = rnd(WD * .6), y = rnd(WD * .6);
    const s = { i, sk: i < NSEL ? (bodies[i] ?? (i * 2) % NB) : Math.random() * NB | 0, nm: i < NSEL ? (human[i] && pnames[i] ? pnames[i] : HEAD_NAMES[HD[i]]) : BN[(i - NSEL) % BN.length],
      x, y, a: Math.random() * 6.28, ta: 0, cm: .1, segs: [],
      bot: !(i < NSEL && human[i]), guest: i < NSEL && !!human[i] && !!guests[i], lives: !TM && i < NSEL && human[i] ? LIVES : 0, hp: 0, gr: 0, ex: 0, inv: 0, stf: 0, best: 0, alive: true, t: 0, boost: false, cr: false, inp: { a: 0, b: false, k: false }, lx: x, ly: y, fin: 0, dd: 0, tr: [], t0: 0, fx: null, mk: 0, rr: 10, nn: 5, bx0: 0, bx1: 0, by0: 0, by1: 0 };
    for (let j = 0; j < 14; j++) s.segs.push({ x, y });
    return s;
  };
  const sn = []; for (let i = 0; i < NS; i++) sn.push(mk(i));
  const respawnQ = [];
  // CORPO = rastro da cabeça: a cabeça deixa uma trilha de pontos e cada segmento fica a uma distância fixa (gap) ao longo dela.
  // Assim o corpo INTEIRO acompanha a curva (antes cada segmento só andava quando o da frente esticava, e o rabo das cobras grandes ficava parado)
  const layout = (s, gap, n) => {
    const tr = s.tr, sg = s.segs, m = tr.length;
    if (m === 0 || Math.hypot(s.x - tr[m - 2], s.y - tr[m - 1]) >= Math.max(3, gap * .25)) tr.push(s.x, s.y);
    const put = (k, x, y) => { const q = sg[k]; if (q) { q.x = x; q.y = y; } else sg[k] = { x, y }; };
    put(0, s.x, s.y);
    let px = s.x, py = s.y, cnt = 1, need = gap, i = tr.length - 2;
    while (cnt < n && i >= s.t0) {
      const qx = tr[i], qy = tr[i + 1], dx = qx - px, dy = qy - py, d = Math.sqrt(dx * dx + dy * dy);
      if (d >= need) { const f = need / d; px += dx * f; py += dy * f; put(cnt++, px, py); need = gap; }
      else { need -= d; px = qx; py = qy; i -= 2; }
    }
    if (cnt < n) { while (cnt < Math.min(n, 14)) put(cnt++, px, py); }   // rastro ainda curto (acabou de nascer/crescer): o rabo fica na origem e o corpo vai saindo dela
    else { s.t0 = Math.max(0, i); if (s.t0 > 2000 && s.t0 > tr.length / 2) { tr.splice(0, s.t0); s.t0 = 0; } }   // rastro antigo além do rabo não é mais necessário
    sg.length = cnt;
  };
  // grade espacial do CORPO das cobras (reconstruída a cada tick, sem alocar): colisão e desvio dos bots olham só as células perto da cabeça,
  // em vez de varrer todos os segmentos de todas as cobras (era isso que travava com cobras de 300-800 cm)
  const BCS = 256, GN = Math.ceil((WD + 2000) / BCS) + 1, gHead = new Int32Array(GN * GN);
  let gNext = new Int32Array(16384), gVal = new Int32Array(16384), gCnt = 0, stamp = 0;
  const gc = v => Math.min(GN - 1, Math.max(0, (v + WD / 2 + 1000) / BCS | 0));
  const buildBodyGrid = () => {
    gHead.fill(-1); gCnt = 0;
    for (const o of sn) {
      if (!o.alive) continue;
      const sg = o.segs;
      for (let k = 0; k < sg.length; k += 2) {
        if (gCnt >= gNext.length) { const nn = new Int32Array(gCnt * 2), nv = new Int32Array(gCnt * 2); nn.set(gNext); nv.set(gVal); gNext = nn; gVal = nv; }
        const c = gc(sg[k].x) * GN + gc(sg[k].y);
        gNext[gCnt] = gHead[c]; gHead[c] = gCnt; gVal[gCnt] = k * 64 + o.i; gCnt++;
      }
    }
  };
  const pw = []; const npw = t => ({ x: rnd(WD - 600), y: rnd(WD - 600), t });   // camisinhas no mapa (cada uma some para sempre depois de pega)
  for (let i = 0; i < CONDOMS; i++) pw.push(npw(0));
  const pills = [], npill = () => ({ x: rnd(WD - 600), y: rnd(WD - 600), gone: false, back: 0 });   // pílulas Tadala
  for (let i = 0; i < PILLS; i++) pills.push(npill());
  // cards flutuantes: t = 0 diminui até o tamanho inicial (imagem 1), t = 1 cresce 50% (imagem 2); CARDS_POR_TIPO de cada no mapa
  // posição dos cards: das 14 candidatas sorteadas fica a mais distante dos outros cards (assim não aparecem juntos e se espalham pelo mapa todo)
  const ncard = (t, id) => {
    let bx = 0, by = 0, bd = -1;
    for (let q = 0; q < 14; q++) { const x = rnd(WD - 600), y = rnd(WD - 600); let md = 1e18; for (const o of cards) if (!o.gone && o.id !== id) md = Math.min(md, (o.x - x) ** 2 + (o.y - y) ** 2); if (md > bd) { bd = md; bx = x; by = y; } }
    return { x: bx, y: by, t, id, gone: false, back: 0 };
  };
  const cards = []; for (let t = 0; t < 2; t++) for (let k = 0; k < CARDS_POR_TIPO; k++) cards.push(ncard(t, cards.length));
  let el = 0, ag = 0, evT = 20 + Math.random() * 30, fph = 30, ftg = 1800, cl = 12, dc = 0, mev = 70 + Math.random() * 40, rain = 0, rp = [], ices = [];   // mev = tempo até a próxima chuva de sorvete; rain = segundos restantes; rp = os 2 pontos do mapa onde ela cai; ices = sorvetes no chão (somem depois de um tempo)
  const c3s = []; const c3T = HUR_TESTE ? Array(8).fill(0) : Math.random() < HUR_CHANCE ? Array.from({ length: 1 + (Math.random() * HUR_MAX | 0) }, () => HUR_AT[0] + Math.random() * (HUR_AT[1] - HUR_AT[0])).sort((a, b) => a - b) : [];   // momentos em que cada card aparece (cada um em um momento diferente da partida)   // card3: aparece UMA vez, em qualquer lugar, no momento sorteado

    // nascimento longe dos jogadores humanos: sorteia até 40 pontos e usa o primeiro com folga de SPAWN_FAR px da cabeça e do corpo de qualquer humano vivo (se nenhum servir, o mais distante)
  const SPAWN_FAR = 1800;
  const spawnAt = me => {
    let bx = 0, by = 0, bd = -1;
    for (let t = 0; t < 40; t++) {
      const x = rnd(WD * .6), y = rnd(WD * .6); let d = 1e9;
      for (const h of sn) { if (h === me || h.bot || !h.alive) continue; d = Math.min(d, Math.hypot(h.x - x, h.y - y)); for (let k = 0; k < h.segs.length; k += 5) d = Math.min(d, Math.hypot(h.segs[k].x - x, h.segs[k].y - y)); }
      if (d > bd) { bd = d; bx = x; by = y; } if (d >= SPAWN_FAR) break;
    }
    return [bx, by];
  };
  for (const s of sn) if (s.bot) { const [px, py] = spawnAt(s); s.x = s.lx = px; s.y = s.ly = py; for (const q of s.segs) { q.x = px; q.y = py; } }   // bots do começo da partida também nascem longe dos humanos
  const G = { hu: -1, hc: [], sn, sk: sn.map(s => s.sk), hd: HD, names: sn.map(s => s.nm), over: false, dead: [], eats: [], pk: [], pop: [], hits: [], pp: [], cp: [] };

  const die = s => {
    s.hv = null; s.alive = false; G.dead.push([s.x | 0, s.y | 0, s.i]); s.tot = (s.tot || 0) + s.cm; s.fin = s.cm;   // tot: soma dos tamanhos de cada vida já encerrada (ranking final do modo eliminação)
     s.best = Math.max(s.best, s.cm); s.hp = 0; s.gr = 0; s.ex = 0; s.inv = 0; s.stf = 0; s.fx = null; s.dd = dc++; s.lx = s.x; s.ly = s.y;
    // bolinhas verdes: no máximo MAX_DROPS por morte; o valor total é o mesmo de antes (cada bolinha vale mais quando a cobra era gigante)
    { const tot = Math.ceil(L(s) / 3), cnt = Math.min(tot, MAX_DROPS), vv = DROP_V * tot / cnt, sgd = s.segs, md = sgd.length;
      for (let j = 0; j < cnt; j++) { const q = sgd[Math.min(md - 1, (j * md / cnt) | 0)]; drops.push(add({ x: q.x + rnd(20), y: q.y + rnd(20), v: vv, d: el + 1, e: 0 })); } }
    if (TM) respawnQ.push(s);   // modo por tempo: todas as cobras (bots inclusive) renascem pequenas, sem limite
    else if (!s.bot && s.lives > 0) { s.lives--; respawnQ.push(s); }
    else if (!s.bot) elimN++;   // jogador humano com vidas sobrando volta no fim do tick; sem vidas (ou bot) morre de vez
  };
  // renasce a cobra pequena (mesmo tamanho inicial de mk) em posição aleatória
  const respawn = s => {
    { const [px, py] = spawnAt(s); s.x = s.lx = px; s.y = s.ly = py; }; s.a = Math.random() * 6.28; s.ta = s.a; s.cm = .1; s.boost = false; s.t = 0; s.hp = 0; s.gr = 0; s.ex = 0; s.inv = INV_TIME; s.stf = 0; s.fx = null; s.hv = null; s.alive = true;   // inv: 3 piscadas sem poder morrer
    s.segs = []; s.tr = []; s.t0 = 0; for (let j = 0; j < 14; j++) s.segs.push({ x: s.x, y: s.y });
  };

  G.step = dt => {
    G.hu = -1; G.hc = []; G.dead = []; G.eats = []; G.pk = []; G.pop = []; G.hits = []; G.pp = []; G.cp = [];
    for (const w of cards) if (w.gone && el >= w.back) Object.assign(w, ncard(w.t, w.id));
    while (c3T.length && el >= c3T[0]) { c3T.shift(); c3s.push({ x: rnd(WD - 800), y: rnd(WD - 800), t: 2, id: 9 + c3s.length, gone: false, back: 0 }); }   // cada card aparece uma vez, em qualquer lugar do mapa
    if (HUR_TESTE) for (const w of c3s) if (w.gone && el >= w.back) Object.assign(w, { x: rnd(WD - 800), y: rnd(WD - 800), gone: false });
    for (const w of pills) if (w.gone && el >= w.back) Object.assign(w, npill());
    for (const f of drops) if (!f.gone && el + 1 - f.d > 60) { const c = grid.get(key(f.x, f.y)); if (c) { const j = c.indexOf(f); if (j >= 0) c.splice(j, 1); } nfood--; f.gone = true; }
    drops = drops.filter(f => !f.gone);
    let rmax = 10;
    for (const s of sn) if (s.alive) { s.rr = R(s); s.nn = Math.ceil(s.segs.length / 3); if (s.rr > rmax) rmax = s.rr; }
    buildBodyGrid();
    for (const s of sn) {
      if (!s.alive) continue;
      if (s.hv) {   // furacão: a cobra é levada até o canto sorteado, perde parte do tamanho ao bater e fica sem controle até acabar o tempo
        const h = s.hv, sc = dt / 60; h.t -= sc; s.boost = false;
        if (!h.hit) {
          h.f -= sc; const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy);
          if (h.f <= 0 || d < 40) { s.x = h.x; s.y = h.y; h.hit = true; s.cm = Math.max(.1, s.cm * HUR_KEEP); G.hc.push([s.x | 0, s.y | 0, s.i]); }
          else { const k = Math.min(d, d * sc / h.f); s.a = Math.atan2(dy, dx); s.x += dx / d * k; s.y += dy / d * k; }
        }
        if (h.t <= 0) s.hv = null;
      }
      if (s.bot) {
        s.t -= dt; s.cr = false; const m = WD / 2 - 250;
        if (Math.abs(s.x) > m || Math.abs(s.y) > m) s.ta = Math.atan2(-s.y, -s.x);
        else {
          let th = null, td = 500 * 500;   // jogador humano vindo na minha direção (tentando cortar minha frente)
          for (const h of sn) {
            if (h.bot || !h.alive) continue;
            const dx = s.x - h.x, dy = s.y - h.y, d = dx * dx + dy * dy;
            if (d < td) { const ang = Math.atan2(dy, dx); if (Math.abs(Math.atan2(Math.sin(ang - h.a), Math.cos(ang - h.a))) < .8) { td = d; th = h; } }
          }
          let gb = null, tg = null;
          if (th) { s.ta = Math.atan2(s.y - th.y, s.x - th.x); s.boost = td < 350 * 350 && s.cm > .5; s.cr = true; }   // foge
          else {
            let gd = 700 * 700;
            near(s.x, s.y, 700, c => { for (const f of c) { if (!f.d) continue; const d = (f.x - s.x) ** 2 + (f.y - s.y) ** 2; if (d < gd) { gd = d; gb = f; } } });
            s.cr = !!gb;
            if (gb) { s.ta = Math.atan2(gb.y - s.y, gb.x - s.x); s.boost = s.cm > .6; }
            else {
              let bd = 2200 * 2200;
              if (ag > 0) for (const o of sn) { if (o.bot || !o.alive || o.cm > s.cm * 4 + 1) continue; const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; tg = o; } }
              if (tg) { s.ta = Math.atan2(tg.y + Math.sin(tg.a) * 140 - s.y, tg.x + Math.cos(tg.a) * 140 - s.x); s.boost = bd < 500 * 500 && s.cm > .6; }   // tenta matar o jogador
              else {
                s.boost = false;
                if (s.t <= 0) {
                  s.t = 20 + Math.random() * 30; let b = null, fd = 450 * 450;
                  near(s.x, s.y, 450, c => { for (const f of c) { const d = (f.x - s.x) ** 2 + (f.y - s.y) ** 2; if (d < fd) { fd = d; b = f; } } });
                  s.ta = b ? Math.atan2(b.y - s.y, b.x - s.x) : s.a + rnd(2);
                }
              }
            }
          }
          { const lm = tg || gb ? 28 : 70, k0 = tg ? 3 : 0, bx0 = gc(s.x - 200), bx1 = gc(s.x + 200), by0 = gc(s.y - 200), by1 = gc(s.y + 200);
            out: for (let a = bx0; a <= bx1; a++) for (let b = by0; b <= by1; b++) for (let e = gHead[a * GN + b]; e >= 0; e = gNext[e]) {
              const v = gVal[e], k = v >> 6; if (k < k0) continue;
              const o = sn[v & 63]; if (o === s || !o.alive) continue;
              const q = o.segs[k]; if (!q) continue;
              if (Math.abs(q.x - s.x) < 200 && Math.abs(q.y - s.y) < 200 && Math.hypot(q.x - s.x, q.y - s.y) < lm + o.rr) { s.ta = Math.atan2(s.y - q.y, s.x - q.x); s.t = 10; break out; }
            } }
        }
        if (ag <= 0 && !s.cr) s.boost = false;
      } else { s.ta = s.stf > 0 ? s.a : s.inp.a; s.boost = s.stf > 0 ? false : s.inp.b; }   // Tadala: reta e dura, sem controle
      const r = R(s), bo = s.boost && s.cm > .4;
      if (bo) s.cm -= .012 * dt;
      const df = Math.atan2(Math.sin(s.ta - s.a), Math.cos(s.ta - s.a));
      // raio mínimo da curva (px) cresce com o tamanho: cobra pequena faz curva fechada (pega a comida), a gigante faz curva larga. Giro por tick = passo normal / raio
      const spf = 1 + BIG_BONUS * Math.max(0, Math.min(1, (s.cm - BIG_FROM) / (BIG_FULL - BIG_FROM)));   // cobra grande é mais rápida: +0% até 100 cm, subindo até +50% aos 200 cm (e além)
      const mt = Math.min(1.2 * spf, 4.8 * dt * spf / (TURN_R0 + Math.max(0, r - 10) * TURN_RK)) * (!s.bot && s.inp.k ? 1.5 : 1) * (s.bot && ag > 0 ? 1.35 : 1);
      if (!s.hv) { s.a += Math.max(-mt, Math.min(mt, df)); const sp = (bo ? 8.2 : 4.8) * dt * spf; s.x += Math.cos(s.a) * sp; s.y += Math.sin(s.a) * sp; }   // com furacão a posição já foi decidida acima
      const gap = r * .5, n = Math.max(8, Math.min(L(s), Math.floor(Math.min(BODY_MAX, 4500 + 9 * s.cm) / gap) + 1));   // comprimento do corpo (px) cresce com o tamanho: 4500 + 9 px por cm, até BODY_MAX   // mesma quantidade de pontos de antes da cobra ficar fina (menos trabalho e menos dados na rede)  // mesma quantidade de pontos de antes da cobra ficar fina (menos trabalho e menos dados na rede)  // BODY_MAX: comprimento máximo do corpo em px
      layout(s, gap, n);
      near(s.x, s.y, r + EAT_PAD + 4, c => {
        for (let j = c.length - 1; j >= 0; j--) { const f = c[j];
          if (Math.abs(f.x - s.x) < r + EAT_PAD + 4 && Math.abs(f.y - s.y) < r + EAT_PAD + 4 && Math.hypot(f.x - s.x, f.y - s.y) < r + EAT_PAD) { s.cm += f.v * .08; G.eats.push([f.x | 0, f.y | 0, s.i]); f.gone = true; c.splice(j, 1); nfood--; } }
      });
      if (s.gr > 0) s.gr -= dt / 60;
      if (s.inv > 0) s.inv -= dt / 60;
      if (s.stf > 0) s.stf -= dt / 60;
      if (s.fx) {   // efeito de card em andamento
        const dts = dt / 60;
        if (s.fx.t === 0) { s.cm = Math.max(s.fx.to, s.cm - s.fx.rate * dts); if (s.cm <= s.fx.to) s.fx = null; }   // encolhe a taxa constante (cm/s) até 40% do tamanho que tinha ao pegar
        else if (s.fx.t === 1) { const p0 = s.fx.p; s.fx.p = Math.min(1, p0 + dts / (s.fx.secs || CARD_GROW_SECS)); s.cm += s.fx.d * (s.fx.p ** CARD_GROW_ACCEL - p0 ** CARD_GROW_ACCEL); if (s.fx.p >= 1) s.fx = null; }   // cresce acelerando (progresso^ACCEL); se a cobra comer no meio, o que ela comeu fica
      }
      if (!s.bot) for (const w of pw) if (!w.gone && Math.abs(w.x - s.x) < 90 && Math.abs(w.y - s.y) < 90 && Math.hypot(w.x - s.x, w.y - s.y) < r + 60) { s.hp = CONDOM_HITS; s.gr = 0; w.gone = true; G.pk.push([w.x | 0, w.y | 0, s.i]); }
      if (!s.bot && s.cm <= PILL_MAX_CM) for (const w of pills) if (!w.gone && Math.abs(w.x - s.x) < 90 && Math.abs(w.y - s.y) < 90 && Math.hypot(w.x - s.x, w.y - s.y) < r + 60) { s.stf = PILL_STIFF; w.gone = true; w.back = el + PILL_BACK; G.pp.push([w.x | 0, w.y | 0, s.i]); }   // cobra maior que PILL_MAX_CM passa por cima sem efeito (a pílula fica)
      for (const c3 of c3s) if (!s.bot && !c3.gone && !s.hv && Math.abs(c3.x - s.x) < 90 && Math.abs(c3.y - s.y) < 90 && Math.hypot(c3.x - s.x, c3.y - s.y) < r + 60) {   // card 3: quem pega fica normal; todas as outras são levadas a um ponto sorteado das laterais para cada uma
        c3.gone = true; c3.back = el + 15; G.cp.push([c3.x | 0, c3.y | 0, s.i, 2]); G.hu = s.i;
        { const vs = sn.filter(o => o.alive && o !== s), n = vs.length, m = WD / 2 - 90, ts = vs.map((_, k) => (k + Math.random()) / n);   // cada cobra vai para um ponto DIFERENTE das laterais do mapa (pontos espalhados pelo contorno todo, sorteados para cada uma)
          for (let k = n - 1; k > 0; k--) { const j = Math.random() * (k + 1) | 0; [ts[k], ts[j]] = [ts[j], ts[k]]; }
          vs.forEach((o, k) => { const q = ts[k] * 4, side = q | 0, u = (q - side) * 2 * m, [tx, ty] = side === 0 ? [-m + u, -m] : side === 1 ? [m, -m + u] : side === 2 ? [m - u, m] : [-m, m - u];
            o.hv = { x: tx, y: ty, f: HUR_FLY, t: HUR_STUN, hit: false }; o.boost = false; }); }
      }
      if (!s.bot) for (const w of cards) if (!w.gone && Math.abs(w.x - s.x) < 90 && Math.abs(w.y - s.y) < 90 && Math.hypot(w.x - s.x, w.y - s.y) < r + 60) {
        w.gone = true; w.back = el + CARD_BACK; G.cp.push([w.x | 0, w.y | 0, s.i, w.t]);
        if (w.t === 0 && s.cm * CARD_SHRINK_TO > CARD_START_CM && s.cm > CARD_START_CM) s.fx = { t: 0, to: s.cm * CARD_SHRINK_TO, rate: s.cm * (1 - CARD_SHRINK_TO) / CARD_SHRINK_SECS };   // card 1: encolhe para 40% do tamanho de agora
        else if (w.t === 1 && s.cm < CARD_BOOST_BELOW_CM) s.fx = { t: 1, p: 0, d: CARD_BOOST_TO_CM - s.cm, secs: CARD_BOOST_SECS };   // card 2 em cobra pequena: cresce até CARD_BOOST_TO_CM em CARD_BOOST_SECS
        else if (w.t === 1) s.fx = { t: 1, p: 0, d: s.cm * (CARD_GROW_TIERS.find(q => Math.round(s.cm * 10) / 10 <= q[0])[1] - 1) };   // card 2: d = quanto vai crescer no total (multiplicador depende do tamanho ao pegar)
      }
      if (Math.abs(s.x) > WD / 2 || Math.abs(s.y) > WD / 2) { die(s); continue; }
      let touch = false;
      if (s.inv <= 0 && !s.hv) {   // piscando = fantasma (levada pelo furacão também não colide): não morre nem mata
        const q = (r + rmax) * .8, st = ++stamp, ax0 = gc(s.x - q), ax1 = gc(s.x + q), ay0 = gc(s.y - q), ay1 = gc(s.y + q);
        col: for (let a = ax0; a <= ax1; a++) for (let b = ay0; b <= ay1; b++) for (let e = gHead[a * GN + b]; e >= 0; e = gNext[e]) {
          const v = gVal[e], o = sn[v & 63], k = v >> 6;
          if (o === s || !o.alive || o.inv > 0 || o.hv || o.mk === st) continue;
          const sgo = o.segs; if (k >= sgo.length) continue;
          const qq = sgo[k], lk = (r + o.rr * TAPER(k / 3, o.nn)) * .8;
          if (Math.abs(qq.x - s.x) < lk && Math.abs(qq.y - s.y) < lk && Math.hypot(qq.x - s.x, qq.y - s.y) < lk) {
            o.mk = st; touch = true;   // cada cobra só conta uma vez por tick
            if (s.hp > 0) { if (s.gr <= 0) { s.hp--; s.gr = 1; if (s.hp === 0) s.ex = 8; G.pop.push([s.x | 0, s.y | 0, s.i, s.hp]); } } else if (s.ex <= 0) { die(s); if (!o.bot) G.hits.push([o.i, s.i, s.x | 0, s.y | 0]); break col; }   // camisinha: cada toque fura mais; no 3º ela estoura e a cobra sai de dentro — enquanto sai (ex) não morre; só depois disso um toque custa a vida
          }
        }
      }
      if (s.alive && s.hp <= 0 && s.ex > 0) { s.ex -= dt / 60; if (!touch && s.ex < 6) s.ex = 0; }   // saiu da camisinha: após no mínimo 2 s e sem encostar em ninguém, volta a valer normal
    }
    for (const s of respawnQ) respawn(s);
    respawnQ.length = 0;
    for (const s of sn) {   // caixa que envolve cada cobra (usada pelo snap para ignorar rápido quem está longe da tela)
      if (!s.alive) continue;
      const sg = s.segs; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let k = 0; k < sg.length; k += 3) { const q = sg[k]; if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
      s.bx0 = x0; s.bx1 = x1; s.by0 = y0; s.by1 = y1;
    }
    const sec = dt / 60; el += sec;
    if (ag > 0) { ag -= sec; if (ag <= 0) { ag = 0; evT = 30 + Math.random() * 60; } } else { evT -= sec; if (evT <= 0) ag = 15; }
    // chuva de sorvete: de tempos em tempos (1m30 a 2m40), por 10 s, cai sorvete em 2 pontos aleatórios do mapa ao mesmo tempo (sem aviso)
    mev -= sec;
    if (mev <= 0) { mev = 90 + Math.random() * 70; const lim = WD / 2 - 450; rain = 10;
      const p1 = [rnd(lim * 2), rnd(lim * 2)]; let p2 = p1, dm = -1;   // o 2º ponto fica bem longe do 1º (metade do mapa ou mais; senão usa o mais distante de 20 tentativas)
      for (let q = 0; q < 20; q++) { const c = [rnd(lim * 2), rnd(lim * 2)], d = Math.hypot(c[0] - p1[0], c[1] - p1[1]); if (d > dm) { dm = d; p2 = c; } if (d >= WD * .55) break; }
      rp = [p1, p2];
    }
    if (rain > 0) {
      rain -= sec;
      for (const [px, py] of rp) for (let q = 0; q < 2; q++) { const a = Math.random() * 6.283, d = Math.random() * 380; ices.push(add({ x: px + Math.cos(a) * d, y: py + Math.sin(a) * d, v: 2 + (Math.random() * 2 | 0), e: 5, t: el })); }
    }
    for (const f of ices) if (!f.gone && el - f.t > 45) { const c = grid.get(key(f.x, f.y)); if (c) { const j = c.indexOf(f); if (j >= 0) c.splice(j, 1); } nfood--; f.gone = true; }
    if (ices.length && ices[0].gone) ices = ices.filter(f => !f.gone);
    fph -= sec; if (fph <= 0) { fph = 25 + Math.random() * 30; ftg = [800, 1800, 3500][Math.random() * 3 | 0]; }
    cl -= sec; if (cl <= 0) { cl = 20 + Math.random() * 25; const hx = rnd(WD - 600), hy = rnd(WD - 600); for (let i = 0; i < 90; i++) { const a = Math.random() * 6.28, d = Math.random() * 320; add({ x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d, v: 1 + (Math.random() * 2 | 0), e: Math.random() * 4 | 0 }); } }
    hm -= sec; if (hm <= 0) { hm = FOOD_HOT_MOVE[0] + Math.random() * (FOOD_HOT_MOVE[1] - FOOD_HOT_MOVE[0]); Object.assign(HOT[Math.random() * HOT.length | 0], hpos()); }   // um ponto de comida muda de lugar
    for (let q = 0; q < 10 && nfood < ftg; q++) add(nf());
    if (nfood > ftg + 150) for (let q = 0; q < 8; q++) { const c = grid.get(key(rnd(WD - 100), rnd(WD - 100))); if (c && c.length && !c[0].d && c[0].e !== 5) { c[0].gone = true; c.shift(); nfood--; } }
    const al = sn.filter(s => s.alive);
    G.te = el >= TIME;   // tempo esgotado
    G.over = force || G.te || (!TM && (humanAlive() === 0 || (humanAlive() === 1 && elimN >= 1)));   // elim: também tem 10 min; acaba antes se sobra só 1 humano vivo (ou nenhum)
  };

  G.input = (i, a, b, k) => { const s = sn[i]; if (s) s.inp = { a, b, k }; };
  G.resume = i => { const s = sn[i]; if (s) { s.bot = false; s.inp = { a: s.a, b: false, k: false }; } };   // jogador que perdeu a conexão voltou: reassume a mesma cobra
  G.drop = i => { if (sn[i]) sn[i].bot = true; };
  // entrada no meio da partida: assume a cobra da vaga (viva = continua; morta = renasce pequena piscando)
  G.join = (i, body, head, name, guest) => {
    const s = sn[i]; if (!s) return;
    s.sk = body; G.sk[i] = body; if (head != null) { G.hd[i] = head; s.nm = G.names[i] = name || HEAD_NAMES[head]; } s.bot = false; s.guest = !!guest; s.lives = TM ? 0 : LIVES; s.inp = { a: s.a, b: false, k: false };
    if (!s.alive) respawn(s);
    // quem entrou no meio da partida não pode ficar igual a um bot: bots com a mesma cabeça ou o mesmo nome ganham outra(o)
    const ch = [], inUse = new Set(G.hd.slice(0, NSEL)), nmUse = new Set(sn.map(x => lc(x.nm)));
    for (const b of sn) {
      if (b.i === i || b.i >= NSEL || !b.bot) continue;
      let h = G.hd[b.i], nm = b.nm, mod = false;
      if (head != null && h === head) { const f = [...Array(NH).keys()].find(x => !inUse.has(x) && !nmUse.has(lc(HEAD_NAMES[x]))); if (f != null) { h = f; inUse.add(f); mod = true; nm = HEAD_NAMES[f]; nmUse.add(lc(nm)); } }
      if (lc(nm) === lc(s.nm)) { const f = BN.find(x => !nmUse.has(lc(x))); if (f) { nm = f; mod = true; nmUse.add(lc(f)); } }
      if (mod) { G.hd[b.i] = h; b.nm = G.names[b.i] = nm; ch.push({ i: b.i, h, nm }); }
    }
    return ch;
  };
  G.lb = () => sn.map(s => [s.i, Math.round((s.alive ? s.cm : s.fin) * 10), s.alive ? 1 : 0, s.bot ? 0 : 1]);   // lista ao vivo (convidado aparece como bot: sem amarelo): tamanho atual (igual ao da tela)
  G.lbBest = () => sn.map(s => [s.i, Math.round(Math.max(s.best, s.alive ? s.cm : s.fin) * 10), s.alive ? 1 : 0]);   // ranking final: maior tamanho de qualquer vida
  G.result = () => {
    const all = [...sn];
    if (TM) {   // por tempo: ranking = tamanho que cada cobra tem quando o tempo fecha
      all.sort((a, b) => b.cm - a.cm);
      return { l: all.map(s => [s.i, Math.round(s.cm * 10), 1]), w: all[0].i, tm: 1, md: mode };
    }
    // eliminação: o tamanho final de cada cobra é a SOMA de todas as vidas dela (as que já acabaram + a atual)
    const hum = s => !s.bot && s.i < NSEL, tot = s => (s.tot || 0) + (s.alive ? s.cm : 0), te = !!G.te;
    // tempo esgotado com mais de uma cobra viva: as vivas vêm primeiro, da maior soma para a menor; sem tempo (último humano vivo): humanos vivos primeiro, como antes
    all.sort((a, b) => a.alive !== b.alive ? (a.alive ? -1 : 1) : a.alive ? (te ? tot(b) - tot(a) : (hum(a) !== hum(b) ? (hum(a) ? -1 : 1) : tot(b) - tot(a))) : b.dd - a.dd);
    return { l: all.map(s => [s.i, Math.round(tot(s) * 10), s.alive ? 1 : 0]), w: all[0].i, tm: 0, te: te ? 1 : 0, md: mode };
  };
  const spec = {}; let force = false;
  const humanAlive = () => sn.filter(s => !s.bot && s.i < NSEL && s.alive).length;
  G.finish = () => { if (humanAlive() > 0) return false; force = true; return true; };   // só encerra se TODOS os jogadores humanos já morreram
  G.snap = i => {
    const p = sn[i]; let sp = -1, tg = null;
    if (!p.alive) {   // morto de vez: a câmera acompanha a maior cobra viva (só troca se outra ficar 20% maior ou se a atual morrer)
      let big = null; for (const s of sn) if (s.alive && (!big || s.cm > big.cm)) big = s;
      const cur = spec[i] != null ? sn[spec[i]] : null;
      tg = cur && cur.alive && big && cur.cm * 1.2 >= big.cm ? cur : big; if (tg) { spec[i] = tg.i; sp = tg.i; }
    }
    const cx = tg ? tg.x : p.alive ? p.x : p.lx, cy = tg ? tg.y : p.alive ? p.y : p.ly, B = Math.max(1100, VIEW_SPAN((tg || p).cm) * 1.25), ns = [];
    for (const s of sn) {
      if (!s.alive) continue;
      const sg = s.segs, e = (Math.ceil(sg.length / 3) - 1) * 3, Bm = B + R(s) * 1.5 + 60;   // e = índice do último ponto (de 3 em 3)
      let last = -1;
      if (s === p || (s.bx1 > cx - Bm && s.bx0 < cx + Bm && s.by1 > cy - Bm && s.by0 < cy + Bm)) {
        if (s.hp > 0) last = e;   // com camisinha vai o corpo inteiro (o desenho da camisinha usa o comprimento total)
        else for (let k = e; k >= 0; k -= 3) { const q = sg[k]; if (Math.abs(q.x - cx) < Bm && Math.abs(q.y - cy) < Bm) { last = k; break; } }
        if (s === p && last < 0) last = 0;
      }
      if (last < 0) continue;
      // manda só do pescoço até o último ponto que aparece na tela (+1): o resto do corpo gigante não precisa viajar pela rede. tn = total de pontos (para o afinamento do rabo)
      const end = Math.min(e, last + 3), pts = []; for (let k = 0; k <= end; k += 3) pts.push(sg[k].x | 0, sg[k].y | 0);
      ns.push([s.i, Math.round(s.cm * 10), +s.a.toFixed(2), pts, s.hp, s.inv > 0 ? s.inv * 100 | 0 : 0, e / 3 + 1, s.stf > 0 ? 1 : 0]);
    }
    const f = []; near(cx, cy, B, c => { for (const o of c) if (Math.abs(o.x - cx) < B && Math.abs(o.y - cy) < B) f.push(o.x | 0, o.y | 0, o.d ? 4 : o.e === 5 && el - o.t < 1 ? 6 : o.e); });   // 6 = sorvete recém-criado (o navegador o desenha caindo do céu)
    return { t: "s", x: cx | 0, y: cy | 0, al: p.alive ? 1 : 0, sp, hd: humanAlive(), ns, f, m: sn.slice(0, NSEL).filter(s => s.alive).map(s => [s.i, s.x | 0, s.y | 0]),
      ea: G.eats.filter(e => Math.abs(e[0] - cx) < B && Math.abs(e[1] - cy) < B), dx: G.dead.filter(e => Math.abs(e[0] - cx) < B && Math.abs(e[1] - cy) < B),
      lf: TM ? -1 : p.lives, hp: p.hp, ht: G.hits.filter(h => h[0] === i).map(h => [h[2], h[3], h[1]]), pop: G.pop.filter(e => Math.abs(e[0] - cx) < B && Math.abs(e[1] - cy) < B), pw: pw.filter(w => !w.gone && Math.abs(w.x - cx) < B + 100 && Math.abs(w.y - cy) < B + 100).map(w => [w.x | 0, w.y | 0]), pl: pills.filter(w => !w.gone && Math.abs(w.x - cx) < B + 100 && Math.abs(w.y - cy) < B + 100).map(w => [w.x | 0, w.y | 0]), pp: G.pp.filter(e => Math.abs(e[0] - cx) < B && Math.abs(e[1] - cy) < B), pk: G.pk.filter(e => Math.abs(e[0] - cx) < B && Math.abs(e[1] - cy) < B), cd: (c3s.length ? [...cards, ...c3s] : cards).filter(w => !w.gone && Math.abs(w.x - cx) < B + 100 && Math.abs(w.y - cy) < B + 100).map(w => [w.x | 0, w.y | 0, w.t, w.id]), hu: G.hu, hc: G.hc.filter(e => Math.abs(e[0] - cx) < B + 300 && Math.abs(e[1] - cy) < B + 300), cp: G.cp.filter(e => Math.abs(e[0] - cx) < B && Math.abs(e[1] - cy) < B), ag: ag > 0 ? 1 : 0, tl: Math.max(0, TIME - el) | 0, n: sn.filter(s => s.alive).length };
  };
  return G;
}