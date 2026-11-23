// ===== MC CAROL: bot "gorda" (um indivíduo por partida) =====
// MODO TESTE: TEST = true faz aparecerem N_TEST Carols logo no começo de TODA partida. Para o jogo normal troque para false (1 Carol, aparece entre APPEAR[0] e APPEAR[1] segundos)
import { NS } from "./config.js";
export const CAROL = {
  TEST: false, N: 1, N_TEST: 4,
  NAME: "MC Carol",
  SKIN: 16,                  // posição dela na lista de corpos (pelecarol.png)
  APPEAR: [90, 420],         // aparece num momento sorteado entre 1:30 e 7:00 da partida (s)
  START_CM: 80,              // tamanho com que ela aparece
  BALL_R0: 40, BALL_K: .5,   // raio da "bola" (barriga) em px = BALL_R0 + BALL_K x cm. Comer faz a bola crescer. Aumente para ela ficar maior
  HEAD: 1.3,                 // tamanho da cabeça/colisão da cabeça, em múltiplos da grossura normal
  SPEED: .7,                 // 70% da velocidade normal (e curva larga)
  HITS: 10,                  // com 10 batidas da cabeça em alguém ela explode
  HIT_CD: 2,               // segundos entre uma batida e a próxima (senão contaria várias vezes no mesmo toque)
  YELLOW: 120,               // bolinhas amarelas da explosão
  YV: 3,                     // cada amarela vale 3x o valor de uma verde
  FLY: [200, 1500],          // distância (px) que as bolinhas voam
  FLY_T: 1.6,                // tempo de voo (s)
  TEXT: "Chama a Samu", TEXT_PX: 60, NAME_PX: 28,   // frase piscando (4x a fonte de 15) e nome (o dobro da fonte de 14)
};
export const carolN = () => CAROL.TEST ? CAROL.N_TEST : CAROL.N;
export const isCarol = i => i >= NS - carolN();   // as Carols usam as últimas vagas de bot
export const carolBall = cm => CAROL.BALL_R0 + CAROL.BALL_K * cm;   // raio da bola
// formato de balão: a cabeça, a bola redonda logo atrás (sem pescoço) e um rabo curto. O corpo todo mede CAROL_LEN raios da bola (a bola cresce, o resto acompanha na mesma proporção)
export const CAROL_LEN = 2.75;
// espessura ao longo do corpo (t = 0 na cabeça, 1 na ponta do rabo), de 0 a 1 (1 = a bola)
export const carolProf = t => {
  const e = (t - .309) / .3636, oval = e > -1 && e < 1 ? Math.sqrt(1 - e * e) : 0;
  const x = (t - .6) / .4, tail = t >= .5 ? (x <= 0 ? .25 : x < 1 ? .25 * Math.pow(1 - x, 1.3) : 0) : 0;
  return Math.max(oval, tail, .03);
};
