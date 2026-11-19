import { CONDOM_HITS, TAPER } from "../shared/config.js";
const FE=["🧆","🥤","🍔","🍫"];
const XN=["Jiboia","Naja","Sucuri","Cascavel","Jararaca","Coral","Anaconda","Mamba"];
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const C=(g,x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.2832);g.fill()};
// corpo "tubo": círculos com brilho 3D, desenhados bem juntos (sprites em cache = rápido)
function mkSpr(h, sa, l) {
  const S = 40, c = document.createElement("canvas"); c.width = c.height = S * 2;
  const g = c.getContext("2d"), gr = g.createRadialGradient(S * .72, S * .6, S * .08, S, S, S);
  gr.addColorStop(0, `hsl(${h} ${sa}% ${Math.min(94, l + 22)}%)`); gr.addColorStop(.5, `hsl(${h} ${sa}% ${l}%)`); gr.addColorStop(1, `hsl(${h} ${sa}% ${Math.max(5, l - 13)}%)`);
  g.fillStyle = gr; g.beginPath(); g.arc(S, S, S - 1, 0, 6.2832); g.fill();
  g.strokeStyle = "rgba(0,0,0,.14)"; g.lineWidth = 2; g.stroke();
  return c;
}
// p = [h, s, l]: o sprite fica guardado no próprio array (p[3]) -> nenhuma string/alocação por segmento a cada quadro
const T = (g, x, y, r, p) => g.drawImage(p[3] || (p[3] = mkSpr(p[0], p[1], p[2])), x - r, y - r, 2 * r, 2 * r);
const RBS = [];   // arco-íris: matiz em passos de 10 (36) x 3 luminosidades, tudo pré-alocado
const RB = (h, li) => { const k = h / 10 * 3 + li; return RBS[k] || (RBS[k] = [h, 100, li === 2 ? 66 : li === 1 ? 58 : 50]); };
// 15 corpos (mesma ordem de BODY_NAMES em shared/config.js). d(g, x, y, r, j): j = posição do segmento contando da cabeça (usado nos desenhos listrados)
const H = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;
const SOLID = (h, s, l) => { const p = [h, s, l]; return { c: H(h, s, l), d: (g, x, y, r) => T(g, x, y, r, p) }; };
const BANDS = (c, pal, pat) => ({ c, d: (g, x, y, r, j) => T(g, x, y, r, pal[pat[j % pat.length]]) });
const CORAL = [[356, 85, 46], [0, 0, 8], [48, 30, 90]];            // vermelho, preto, branco-creme
const JARA = [[44, 38, 50], [28, 52, 22], [48, 45, 68]];           // pardo, marrom-escuro, claro
const SK = [
  BANDS("#d62828", CORAL, [0, 0, 0, 0, 0, 0, 1, 2, 2, 1]),            // Coral verdadeira: anel vermelho, preto, branco, preto
  BANDS("#8a6d3b", JARA, [2, 1, 1, 1, 2, 0, 0, 0]),                    // Jararaca: manchas marrons em trapézio sobre fundo pardo
  SOLID(0, 0, 12),                                                      // Preta
  SOLID(0, 0, 93),                                                      // Branca
  { c: H(300, 100, 65), anim: true, d: (g, x, y, r, j) => {            // Arco-íris que brilha e pulsa
      const t = performance.now(), w = Math.sin(t / 170 - j * .35), h = (Math.round((j * 14 + t / 14) / 10) * 10) % 360, rr = r * (1 + .07 * w);
      const ga = g.globalAlpha; g.globalAlpha = ga * (.16 + .08 * w); g.fillStyle = H(h, 100, 65); C(g, x, y, rr * 1.45); g.globalAlpha = ga;
      T(g, x, y, rr, RB(h, w > .33 ? 2 : w > -.33 ? 1 : 0));
    } },
  SOLID(0, 80, 46), SOLID(26, 95, 52), SOLID(50, 95, 52), SOLID(78, 75, 46), SOLID(130, 60, 40),   // Vermelha, Laranja, Amarela, Limão, Verde
  SOLID(176, 75, 40), SOLID(214, 80, 52), SOLID(268, 60, 52), SOLID(330, 80, 62), SOLID(25, 50, 32), // Turquesa, Azul, Roxa, Rosa, Marrom
  SOLID(78, 38, 34),                                                                                  // Sucuri
  BANDS("#b9892f", [[44, 62, 50], [26, 55, 20], [48, 45, 78]], [0, 0, 1, 1, 2, 1, 1, 0, 0, 0, 1, 1]),   // Piton
  SOLID(60, 8, 31),                                                                                   // Mamba
  BANDS("#6bbf2a", [[130, 70, 36], [52, 100, 52]], [0, 0, 0, 0, 1, 1, 1, 1]),                           // Verde e amarelo
  SOLID(110, 100, 52),                                                                                // Verde néon
  BANDS("#e5e7eb", [[0, 0, 93], [0, 0, 10]], [0, 0, 1, 1]),                                           // Quadriculado
];
function head(g,x,y,a,r,k,im,hf){
 const ph=im&&im.sm,hr=ph?(hf||50):r*1.5;
 if(ph){
  g.save();g.translate(x,y);g.rotate(a);
  g.strokeStyle="#ef4444";g.lineWidth=3;g.beginPath();g.moveTo(hr*1.3,0);g.lineTo(hr*1.8,0);g.lineTo(hr*2,-hr*.15);g.moveTo(hr*1.8,0);g.lineTo(hr*2,hr*.15);g.stroke();
  g.beginPath();g.moveTo(hr*1.3,0);g.bezierCurveTo(hr,-hr*.75,hr*.2,-hr*.95,-hr*.5,-hr*.8);g.bezierCurveTo(-hr,-hr*.6,-hr,hr*.6,-hr*.5,hr*.8);g.bezierCurveTo(hr*.2,hr*.95,hr,hr*.75,hr*1.3,0);g.closePath();
  g.fillStyle=SK[k].c;g.fill();g.save();g.clip();
  g.drawImage(im.sm,-hr*1.1,-hr*1.1,hr*2.2,hr*2.2);
  g.restore();g.lineWidth=3;g.strokeStyle=SK[k].c;g.stroke();g.restore();return}
 g.save();g.beginPath();g.arc(x,y,hr,0,6.2832);g.fillStyle=SK[k].c;g.fill();
 for(const s of[-.7,.7]){const ex=x+Math.cos(a+s)*hr*.55,ey=y+Math.sin(a+s)*hr*.55;g.fillStyle="#fff";C(g,ex,ey,hr*.3);g.fillStyle="#111";C(g,ex+Math.cos(a)*hr*.1,ey+Math.sin(a)*hr*.1,hr*.15)}
 g.restore();g.lineWidth=3;g.strokeStyle=SK[k].c;g.beginPath();g.arc(x,y,hr,0,6.2832);g.stroke();
}
function sHead(g,x,y,a,r,c){
 g.save();g.translate(x,y);g.rotate(a);
 g.strokeStyle="#ef4444";g.lineWidth=2;g.beginPath();g.moveTo(r*1.6,0);g.lineTo(r*2.3,0);g.lineTo(r*2.6,-r*.3);g.moveTo(r*2.3,0);g.lineTo(r*2.6,r*.3);g.stroke();
 g.fillStyle=c;g.beginPath();g.ellipse(r*.5,0,r*1.6,r*1.1,0,0,6.2832);g.fill();
 for(const s of[-1,1]){g.fillStyle="#fde047";C(g,r*.9,s*r*.55,r*.32);g.fillStyle="#111";g.beginPath();g.ellipse(r*.95,s*r*.55,r*.07,r*.25,0,0,6.2832);g.fill()}
 g.restore();
}

// ícone da camisinha no mapa
function condomIcon(g, x, y, sz, t) {
  g.save(); g.translate(x, y); g.rotate(.26); g.scale(sz / 100, sz / 100);
  const p = 1 + Math.sin(t / 250) * .08;
  g.fillStyle = "rgba(255,255,255,.14)"; g.beginPath(); g.arc(0, 0, 62 * p, 0, 6.2832); g.fill();
  g.lineWidth = 4; g.strokeStyle = "#f0a0d8"; g.fillStyle = "#8a7fc0";
  g.beginPath(); g.moveTo(-19, 40); g.lineTo(-19, -30); g.quadraticCurveTo(-19, -44, 0, -44); g.quadraticCurveTo(19, -44, 19, -30); g.lineTo(19, 40); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -49, 6, 0, 6.2832); g.fill(); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(-12, -14); g.quadraticCurveTo(-6, -12, -2, -8); g.moveTo(8, 8); g.quadraticCurveTo(12, 10, 14, 16); g.stroke();
  g.fillStyle = "#f0a0d8"; g.beginPath(); g.ellipse(0, 43, 27, 8, 0, 0, 6.2832); g.fill();
  g.restore();
}
// geometria da camisinha vestida: pts[0] = ponta; pts[1..] = cabeça e primeiro terço do corpo (no mínimo); w = meia largura
function condomGeo(c, a, r, hd) {
  const n = c.length / 2, k = Math.max(3, Math.ceil(n / 3)), w = Math.max(r * 1.6, hd * 1.15);
  const pts = [[c[0] + Math.cos(a) * hd * 1.3, c[1] + Math.sin(a) * hd * 1.3]];
  for (let j = 0; j < k && j < n; j++) pts.push([c[2 * j], c[2 * j + 1]]);
  return { pts, w, a, hd };
}
const cPath = (g, pts, from = 0) => { g.beginPath(); for (let j = from; j < pts.length; j++) j > from ? g.lineTo(pts[j][0], pts[j][1]) : g.moveTo(pts[j][0], pts[j][1]); };
const cDome = (g, p, a, R) => { g.beginPath(); g.arc(p[0], p[1], R, a + 1.5708, a - 1.5708, true); g.closePath(); g.fill(); };   // meia-calota arredondada da frente
// borda de trás ABERTA: só um anel enrolado (visto de lado), sem tampa — o corpo/rabo sai por ali
const cRim = (g, pts, w, al) => {
  const e = pts[pts.length - 1], q = pts[pts.length - 2] || e, ea = Math.atan2(e[1] - q[1], e[0] - q[0]);
  g.save(); g.translate(e[0], e[1]); g.rotate(ea + 1.5708); g.globalAlpha = al; g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineWidth = 9;
  g.beginPath(); g.moveTo(-w - 4, 0); g.lineTo(w + 4, 0); g.stroke(); g.restore();
};
// camada de trás: o "vidro" branco translúcido, desenhado ANTES do corpo (assim a cobra aparece por dentro)
function condomBack(g, geo, al = 1) {
  const { pts, w, a } = geo;
  g.save(); g.lineCap = "butt"; g.lineJoin = "round"; g.strokeStyle = "#fff"; g.fillStyle = "#fff";
  for (const [A, W] of [[.5, w + 4], [.3, w]]) { g.globalAlpha = A * al; g.lineWidth = W * 2; cPath(g, pts); g.stroke(); cDome(g, pts[0], a, W); }
  g.restore();
}
// camada da frente: véu leve, biquinho na ponta, furos (todos na ponta) e borda de trás
function condomSleeve(g, c, a, r, hd, hp = CONDOM_HITS, layer = 1) {
  const geo = condomGeo(c, a, r, hd), { pts, w } = geo;
  if (layer === 0) return condomBack(g, geo);
  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  g.save(); g.lineCap = "butt"; g.lineJoin = "round";
  g.globalAlpha = .13; g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineWidth = w * 2; cPath(g, pts); g.stroke(); cDome(g, pts[0], a, w);
  // biquinho (reservatório) no topo da ponta: base larga, afina e termina arredondado
  const bx = pts[0][0] + ca * w * .93, by = pts[0][1] + sa * w * .93, hh = w * .62, bw = w * .3, rc = w * .17, cx2 = bx + ca * (hh - rc), cy2 = by + sa * (hh - rc);
  g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.6)"; g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(bx + nx * bw, by + ny * bw);
  g.quadraticCurveTo(bx + ca * hh * .4 + nx * rc, by + sa * hh * .4 + ny * rc, cx2 + nx * rc, cy2 + ny * rc);
  g.arc(cx2, cy2, rc, a + 1.5708, a - 1.5708, true);
  g.quadraticCurveTo(bx + ca * hh * .4 - nx * rc, by + sa * hh * .4 - ny * rc, bx - nx * bw, by - ny * bw);
  g.fill(); g.stroke();
  // furos, sempre na ponta: 1 a cada toque (hp cheio = inteira, cada toque a mais = 1 furo)
  for (let j = 0; j < CONDOM_HITS - hp; j++) {
    const side = j % 2 ? 1 : -1, hx = pts[0][0] + ca * w * .55 + nx * w * .42 * side, hy = pts[0][1] + sa * w * .55 + ny * w * .42 * side, hr = w * (.2 + .06 * j);
    g.fillStyle = "rgba(10,10,30,.8)"; g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 3;
    g.beginPath(); for (let t = 0; t < 8; t++) { const rr = hr * (t % 2 ? .6 : 1.1), aa = t * .785 + j; t ? g.lineTo(hx + Math.cos(aa) * rr, hy + Math.sin(aa) * rr) : g.moveTo(hx + Math.cos(aa) * rr, hy + Math.sin(aa) * rr); }
    g.closePath(); g.fill(); g.stroke();
  }
  cRim(g, pts, w, .95);
  g.restore();
}
// camisinha rasgada que fica no chão depois de estourar: a ponta se abre em duas pétalas (animação de ~0,7 s) e a cobra segue em frente
function condomShed(g, sd, t) {
  const p = Math.min(1, (t - sd.t0) / 700), e = 1 - (1 - p) ** 3, { pts, w, a, hd } = sd;
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, P = pts[1] || pts[0], off = w * 1.15 + hd * .2;
  g.save(); g.lineJoin = "round"; g.lineCap = "butt"; g.strokeStyle = "#fff";
  g.globalAlpha = .4; g.lineWidth = w * 2 + 8; cPath(g, pts, 1); g.stroke();
  g.globalAlpha = .24; g.lineWidth = w * 2; g.stroke();
  cRim(g, pts, w, .6);
  for (const s of [1, -1]) {
    const ax = P[0] + nx * w * s, ay = P[1] + ny * w * s, vx = dx * off - nx * w * s, vy = dy * off - ny * w * s, th = s * e * 1.25, cs = Math.cos(th), sn = Math.sin(th);
    g.globalAlpha = .4; g.fillStyle = "#fff"; g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + vx * cs - vy * sn, ay + vx * sn + vy * cs); g.lineTo(P[0], P[1]); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

// pílula "Tadala" no mapa: cápsula girando, com o nome em cima
function pillIcon(g, x, y, sz, t) {
  g.save(); g.translate(x, y); g.scale(sz / 100, sz / 100);
  const p = 1 + Math.sin(t / 250) * .08;
  g.fillStyle = "rgba(255,255,255,.14)"; g.beginPath(); g.arc(0, 0, 62 * p, 0, 6.2832); g.fill();
  g.save(); g.rotate(t / 450);
  g.lineWidth = 4; g.strokeStyle = "#fff";
  g.beginPath(); g.arc(-18, 0, 20, Math.PI / 2, -Math.PI / 2); g.lineTo(0, -20); g.lineTo(0, 20); g.closePath(); g.fillStyle = "#38bdf8"; g.fill(); g.stroke();
  g.beginPath(); g.arc(18, 0, 20, -Math.PI / 2, Math.PI / 2); g.lineTo(0, 20); g.lineTo(0, -20); g.closePath(); g.fillStyle = "#fde047"; g.fill(); g.stroke();
  g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-20, -9, 9, 4, 0, 0, 6.2832); g.fill();
  g.restore();
  g.font = "bold 30px system-ui"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineWidth = 6; g.strokeStyle = "#000"; g.fillStyle = "#fff";
  g.strokeText("Tadala", 0, -52); g.fillText("Tadala", 0, -52);
  g.restore();
}


// ================= CORPO DE SERPENTE =================
// Em vez de carimbar bolinhas, o corpo é um tubo liso: a linha do centro vira uma curva suave (Catmull-Rom) e é pintada em camadas
// (borda escura -> cor -> luz -> brilho, com a luz vindo de cima/esquerda), depois escamas e manchas por cima. O rabo afina até uma ponta fina.
// A ondulação (wiggle) é SÓ visual: o servidor/colisão continuam usando a linha reta do centro.
export const WIGGLE = 0;       // ondulação lateral ("bandeira"). 0 = desligada; .4 = serpente sinuosa. Agora o corpo PULSA (ver abaixo)
export const PULSE = 0;        // quanto a espessura incha/murcha ao pulsar (fração do raio). 0 = sem pulsar
const PULSE_W = .0095;         // velocidade do pulso (rad/ms): ~1,5 batidas por segundo
const PULSE_K = .55;           // distância entre um inchaço e o próximo (menor = inchaços mais longos)
const WK = .66;                // "comprimento de onda": ~9,5 pontos do corpo por onda
const WSPEED = .8;             // <1: a onda desliza devagar para trás (efeito de cobra rastejando); 1 = parada no chão
const PL = (h, s, l) => [H(h, s, Math.max(4, l - 22)), H(h, s, l), H(h, s, l + (100 - l) * .22), H(h, Math.max(0, s - 15), l + (100 - l) * .5)];   // [borda escura, cor, luz, brilho]
const SOL = (h, s, l, bl = true) => ({ pal: [PL(h, s, l)], bl });
export const SKIN = [
  { pal: CORAL.map(q => PL(...q)), pat: [0, 0, 0, 0, 0, 0, 1, 2, 2, 1] },   // Coral
  { pal: JARA.map(q => PL(...q)), pat: [2, 1, 1, 1, 2, 0, 0, 0] },          // Jararaca
  SOL(0, 0, 12), SOL(0, 0, 93),                                             // Preta, Branca
  { pal: Array.from({ length: 36 }, (_, q) => PL(q * 10, 100, 58)), rb: true },   // Arco-íris
  SOL(0, 80, 46), SOL(26, 95, 52), SOL(50, 95, 52), SOL(78, 75, 46), SOL(130, 60, 40),
  SOL(176, 75, 40), SOL(214, 80, 52), SOL(268, 60, 52), SOL(330, 80, 62), SOL(25, 50, 32),
  { pal: [PL(78, 38, 34)], spot: { c: "rgba(14,20,6,.78)", rx: .62, ry: .5, step: 8 } },                  // Sucuri: verde-oliva com manchas redondas escuras
  { pal: [PL(44, 62, 50), PL(26, 55, 22), PL(48, 45, 78)], pat: [0, 0, 1, 1, 2, 1, 1, 0, 0, 0, 1, 1], spot: { c: "rgba(45,22,6,.3)", rx: .55, ry: .36, step: 5 } },   // Piton: dourado com losangos marrons e creme
  SOL(60, 8, 31),                                                                                       // Mamba (negra): cinza-oliva liso
  { pal: [PL(130, 70, 36), PL(52, 100, 52)], pat: [0, 0, 0, 0, 1, 1, 1, 1] },                           // Verde e amarelo: anéis
  { pal: [PL(110, 100, 52)], glow: "#39ff14" },                                                         // Verde néon (com brilho)
  { pal: [PL(0, 0, 93), PL(0, 0, 10)], chk: true },                                                     // Quadriculado: xadrez preto e branco
];
// ondula os pontos do corpo (c = pontos já interpolados, tn = total de pontos do corpo, ph = fase). Escreve em w. A cabeça (j=0) não sai do lugar.
export function wiggle(c, n, tn, r, ph, w) {
  if (!WIGGLE) { for (let j = 0; j < 2 * n; j++) w[j] = c[j]; return w; }
  for (let j = 0; j < n; j++) {
    const a = j > 0 ? j - 1 : 0, b = j < n - 1 ? j + 1 : j;
    let tx = c[2 * b] - c[2 * a], ty = c[2 * b + 1] - c[2 * a + 1]; const d = Math.sqrt(tx * tx + ty * ty) || 1; tx /= d; ty /= d;
    const env = Math.min(1, j / 3) * (.35 + .65 * Math.min(1, (tn - 1 - j) / 6));   // 0 no pescoço, cheia no meio, um pouco menor na ponta
    const o = r * WIGGLE * env * Math.sin(WK * j - ph);
    w[2 * j] = c[2 * j] - ty * o; w[2 * j + 1] = c[2 * j + 1] + tx * o;
  }
  return w;
}
export const WAVE_STEP = (r, dist) => WSPEED * WK * dist / (1.5 * r);   // quanto a fase avança quando a cabeça anda "dist" px
let SX = new Float32Array(2048), SY = new Float32Array(2048), SU = new Float32Array(2048), SR = new Float32Array(2048), SI = new Uint8Array(2048), SV = new Uint8Array(2048), TX = new Float32Array(2048), TY = new Float32Array(2048);
const SUB = 4;   // amostras entre dois pontos do corpo
// desenha o corpo. w = pontos (ondulados), n = qtde de pontos recebidos, tn = total do corpo, r = raio, k = tipo de corpo, t = tempo (ms), V = [xmin, xmax, ymin, ymax] da tela
export function drawBody(g, w, n, tn, r, k, t, V, pa = 1) {   // pa = intensidade do pulsar (0 = corpo reto/duro, 1 = pulsando)
  if (n < 2) return;
  const sk = SKIN[k] || SKIN[0], pal = sk.pal, m = (n - 1) * SUB + 1;
  if (m > SX.length) { const z = m * 2; SX = new Float32Array(z); SY = new Float32Array(z); SU = new Float32Array(z); SR = new Float32Array(z); SI = new Uint8Array(z); SV = new Uint8Array(z); TX = new Float32Array(z); TY = new Float32Array(z); }
  // 1) curva suave pelos pontos
  let q = 0;
  for (let j = 0; j < n - 1; j++) {
    const a = Math.max(0, j - 1) * 2, b = j * 2, c2 = (j + 1) * 2, d = Math.min(n - 1, j + 2) * 2;
    for (let u = 0; u < SUB; u++, q++) {
      const f = u / SUB, f2 = f * f, f3 = f2 * f;
      SX[q] = .5 * (2 * w[b] + (w[c2] - w[a]) * f + (2 * w[a] - 5 * w[b] + 4 * w[c2] - w[d]) * f2 + (3 * w[b] - w[a] - 3 * w[c2] + w[d]) * f3);
      SY[q] = .5 * (2 * w[b + 1] + (w[c2 + 1] - w[a + 1]) * f + (2 * w[a + 1] - 5 * w[b + 1] + 4 * w[c2 + 1] - w[d + 1]) * f2 + (3 * w[b + 1] - w[a + 1] - 3 * w[c2 + 1] + w[d + 1]) * f3);
      SU[q] = j + f;
    }
  }
  SX[q] = w[2 * n - 2]; SY[q] = w[2 * n - 1]; SU[q] = n - 1;
  // 2) raio (afina até a ponta), cor e visibilidade de cada amostra
  const x0 = V[0], x1 = V[1], y0 = V[2], y1 = V[3];
  for (let i = 0; i < m; i++) {
    const u = SU[i], tp = Math.max(.045, (TAPER(u, tn) - .1) / .9);
    let rr = r * tp, ix = 0;
    if (PULSE && pa > .01) rr *= 1 + PULSE * pa * Math.min(1, u / 3) * Math.sin(t * PULSE_W - u * PULSE_K);   // onda de inchaço que desce da cabeça até o rabo (0 no pescoço)
    if (sk.rb) ix = (Math.round((u * 14 + t / 14) / 10) * 10 % 360) / 10 | 0;
    else if (sk.pat) ix = sk.pat[(u | 0) % sk.pat.length];
    SR[i] = rr; SI[i] = ix; SV[i] = SX[i] > x0 - rr && SX[i] < x1 + rr && SY[i] > y0 - rr && SY[i] < y1 + rr ? 1 : 0;
    const a = i > 0 ? i - 1 : 0, b = i < m - 1 ? i + 1 : i, dx = SX[b] - SX[a], dy = SY[b] - SY[a], dl = Math.sqrt(dx * dx + dy * dy) || 1;
    TX[i] = dx / dl; TY[i] = dy / dl;
  }
  // 3) camadas, da ponta do rabo para a cabeça (a cabeça fica por cima)
  g.lineCap = "round"; g.lineJoin = "round";
  if (sk.glow) {   // brilho néon: um traço largo e translúcido por baixo do corpo
    const ga = g.globalAlpha; g.globalAlpha = ga * .22; g.strokeStyle = sk.glow;
    for (let i = m - 2; i >= 0; i--) { if (!SV[i] && !SV[i + 1]) continue; g.lineWidth = SR[i] * 3.1; g.beginPath(); g.moveTo(SX[i], SY[i]); g.lineTo(SX[i + 1], SY[i + 1]); g.stroke(); }
    g.globalAlpha = ga;
  }
  const WF = [1.1, 1, .6, .28], OX = [0, 0, -.12, -.2], OY = [0, 0, -.18, -.3];
  for (let pass = 0; pass < 4; pass++) {
    const wf = WF[pass] * 2, ox = OX[pass], oy = OY[pass];
    for (let i = m - 2; i >= 0; i--) {
      if (!SV[i] && !SV[i + 1]) continue;
      const a = SR[i], b = SR[i + 1];
      g.strokeStyle = pal[SI[i]][pass]; g.lineWidth = a * wf;
      g.beginPath(); g.moveTo(SX[i] + ox * a, SY[i] + oy * a); g.lineTo(SX[i + 1] + ox * b, SY[i + 1] + oy * b); g.stroke();
    }
  }
  // 3b) quadriculado: quadrados pretos em duas faixas (esquerda/direita) alternando ao longo do corpo
  if (sk.chk) {
    g.fillStyle = "#101114"; g.beginPath();
    for (let i = 0; i < m - 2; i += 2) {
      if (!SV[i + 1]) continue; const rr = SR[i + 1]; if (rr < 4) continue;
      const tx = TX[i + 1], ty = TY[i + 1], nx = -ty, ny = tx, hl = Math.hypot(SX[i + 2] - SX[i], SY[i + 2] - SY[i]) / 2, hw = rr * .47;
      for (const L of [-1, 1]) {
        if ((((i >> 1) + (L > 0 ? 1 : 0)) & 1) !== 0) continue;
        const cx = SX[i + 1] + nx * L * rr * .5, cy = SY[i + 1] + ny * L * rr * .5;
        g.moveTo(cx - tx * hl - nx * hw, cy - ty * hl - ny * hw); g.lineTo(cx + tx * hl - nx * hw, cy + ty * hl - ny * hw); g.lineTo(cx + tx * hl + nx * hw, cy + ty * hl + ny * hw); g.lineTo(cx - tx * hl + nx * hw, cy - ty * hl + ny * hw); g.closePath();
      }
    }
    g.fill();
  }
  // 4) escamas (arcos em fileiras alternadas)
  if (r >= 9 && !sk.chk) {
    g.beginPath();
    for (let i = 2; i < m - 1; i += 2) {
      const rr = SR[i]; if (!SV[i] || rr < 5) continue;
      const nx = -TY[i], ny = TX[i], ang = Math.atan2(-TY[i], -TX[i]), ra = rr * .22, row = (i >> 1) & 1;
      for (let z = 0; z < (row ? 2 : 3); z++) {
        const o = (row ? (z ? .3 : -.3) : (z - 1) * .6) * rr, cx = SX[i] + nx * o, cy = SY[i] + ny * o;
        g.moveTo(cx + Math.cos(ang - 1) * ra, cy + Math.sin(ang - 1) * ra); g.arc(cx, cy, ra, ang - 1, ang + 1);
      }
    }
    g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = Math.max(1, r * .05); g.stroke();
  }
  // 5) manchas no dorso (corpos de uma cor só: leves; sucuri/piton têm manchas próprias)
  const sp = sk.spot || (sk.bl ? { c: "rgba(0,0,0,.13)", rx: .95, ry: .42, step: 7 } : null);
  if (sp) {
    g.beginPath();
    for (let i = 6; i < m - 3; i += sp.step) {
      const rr = SR[i]; if (!SV[i] || rr < 6) continue;
      const ang = Math.atan2(TY[i], TX[i]), rx = rr * sp.rx, ry = rr * sp.ry;
      g.moveTo(SX[i] + Math.cos(ang) * rx, SY[i] + Math.sin(ang) * rx); g.ellipse(SX[i], SY[i], rx, ry, ang, 0, 6.2832);
    }
    g.fillStyle = sp.c; g.fill();
  }
}


// ================= CARDS FLUTUANTES =================
// card girando (como uma moeda virando) e flutuando; img = imagem do card (se ainda não carregou/não existe, desenha um card genérico colorido com o número)
export const CARD_COL = ["#38bdf8", "#4ade80"];   // brilho de cada tipo: 0 = diminui (azul), 1 = cresce (verde)
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function cardIcon(g, x, y, sz, t, k, img, id = k) {   // k = tipo, id = número do card (cada um gira/flutua em fase diferente)
  const col = CARD_COL[k % CARD_COL.length], ph = id * 1.3;
  const asp = img && img.sm ? Math.min(1.6, Math.max(.7, img.sm.height / img.sm.width)) : 1.3;
  const W = sz * .85, H = W * asp, a = t / 1100 + ph, cs = Math.cos(a), sc = (cs < 0 ? -1 : 1) * Math.max(.12, Math.abs(cs)), bob = Math.sin(t / 520 + ph * 2) * 11;
  // sombra no chão (diminui quando o card sobe) e brilho pulsando
  g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(x, y + H * .62, W * .42 * (1 - bob / 90), 9, 0, 0, 6.2832); g.fill();
  const gl = g.createRadialGradient(x, y + bob, 0, x, y + bob, sz * .95); gl.addColorStop(0, col + "88"); gl.addColorStop(1, col + "00");
  g.globalAlpha = .55 + .35 * Math.sin(t / 380 + ph); g.fillStyle = gl; g.beginPath(); g.arc(x, y + bob, sz * .95, 0, 6.2832); g.fill(); g.globalAlpha = 1;
  g.save(); g.translate(x, y + bob); g.scale(sc, 1);
  rrect(g, -W / 2, -H / 2, W, H, 12); g.save(); g.clip();
  if (img && img.sm) g.drawImage(img.sm, -W / 2, -H / 2, W, H);
  else { const bg = g.createLinearGradient(0, -H / 2, 0, H / 2); bg.addColorStop(0, col); bg.addColorStop(1, "#1e293b"); g.fillStyle = bg; g.fillRect(-W / 2, -H / 2, W, H);
    g.fillStyle = "#fff"; g.font = "bold " + (W * .6 | 0) + "px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(k + 1), 0, 0); }
  const sh = g.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2); const p = (Math.sin(a * .8) + 1) / 2;   // reflexo diagonal que passa pelo card
  sh.addColorStop(Math.max(0, p - .2), "rgba(255,255,255,0)"); sh.addColorStop(p, "rgba(255,255,255,.35)"); sh.addColorStop(Math.min(1, p + .2), "rgba(255,255,255,0)"); g.fillStyle = sh; g.fillRect(-W / 2, -H / 2, W, H);
  g.fillStyle = "rgba(0,0,0," + ((1 - Math.abs(cs)) * .35).toFixed(2) + ")"; g.fillRect(-W / 2, -H / 2, W, H);   // escurece de leve quando está de lado
  g.restore();
  g.lineWidth = 5 / Math.max(.3, Math.abs(sc)) * .6 + 2; g.strokeStyle = "#fff"; rrect(g, -W / 2, -H / 2, W, H, 12); g.stroke();
  g.lineWidth = 2; g.strokeStyle = col; rrect(g, -W / 2 - 4, -H / 2 - 4, W + 8, H + 8, 15); g.stroke();
  g.restore();
}

export { cardIcon, pillIcon, condomIcon, condomSleeve, condomGeo, condomShed, FE, esc, C, SK, head, sHead };
