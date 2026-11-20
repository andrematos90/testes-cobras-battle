// Configurações compartilhadas entre servidor e jogo. Edite os nomes aqui.
export const WD = 10400;      // tamanho do mapa
export const TIME = 600;      // duração da partida em segundos (10 min)
export const NS = 50;         // total de cobras: 10 selecionáveis (humanos) + 40 bots
export const TICK = 40;       // ms por atualização do servidor (25 por segundo)
// 15 cabeças (public/cobra1.png ... cobra15.png). Cada cabeça tem um nome padrão, que aparece em cima da cobra; o jogador pode digitar outro nome no lobby.
export const HEAD_NAMES = ["André", "Allan", "Thiago", "Matheus", "Débora", "Fischer", "Samoso", "Ladrão", "Esbanja", "Homem com Down", "Bolsomito", "Virgem (Urach)", "Campopiano", "Caneta Azul", "Comedor de Loiras", "Luva de Pedreiro"]; // TROQUE AQUI os nomes (a ordem é a mesma de cobra1.png, cobra2.png...)
export const NH = HEAD_NAMES.length; // quantidade de cabeças
export const NSEL = 10;           // quantos retângulos (jogadores simultâneos, máximo 10; no máximo NH, pois cada um usa uma cabeça diferente)
export const HEAD_UNIQUE = true;  // true = duas pessoas não podem usar a mesma cabeça ao mesmo tempo
export const NAME_MAX = 14;       // máximo de letras do nome digitado
export const SLOT_COLORS = Array(10).fill("#39ff14"); // cor dos retângulos do lobby: todos verde néon

export const BOT_NAMES = [
    "Bengalossauro",
    "Zeca Cetona",
    "Piraoteucu",
    "Elma Maria Pinto",
    "Kid Bengala",
    "Tonhão da Vara",
    "Pirocossauro Rex",
    "Comandante Cabeçudo",
    "Mini Tromba",
    "Pau de Moleque",
    "General Pirocão",
    "Alan Bedoura de Pinto",
    "Tres Pernas",
    "Salsicholino",
    "Vinte Comer",
    "Paulin Pinho",
    "Senhor dos Centímetros",
    "Bengala 4K",
    "Senhor dos Anais",
    "Pênis Presley",
    "H. Romeu Pinto",
    "Beringela Africana",
    "Canhão de Bolso",
    "Tonelada de Linguiça",
    "Capitão Ereção",
    "Pirocélio dos Santos",
    "Cacetossauro",
    "Kid Pé de Mesa",
    "Míssil de Cueca",
    "Homem do Contrapeso",
    "O Japonês Fora da Curva",
    "Africano XXL",
    "Paulo Aquino Rego",
    "Paula Nabussa",
    "Kid Comprimento",
    "O Homem de 30 Centímetros",
    "Idécio Pinto",
    "Jalim Rabei",
    "Vara de Condão",
    "Lima Marei",
    "O Inquilino da Cueca",
    "Kid Cassetete",
    "Cassetão Caverna",
    "Lia Toxa"
];

// NOVOS NOMES: cole aqui (entre aspas, separados por vírgula). Todas as listas são juntadas e embaralhadas a cada partida; os bots recebem os primeiros da lista embaralhada.
export const BOT_NAMES_EXTRA = [
    "Pikachu Pei",
    "Inês Pectiva",
    "Omar Rombado",
    "Silas Tica",
    "Rosa Melano",
    "Caio Fora",
    "Ideu Bosta",
    "Omais Pequeno",
    "Vera Funda",
    "Ama Rola",
    "Pin Guelo",
    "Téo Pau",
    "Teatóla Piroca",
    "Juca Cete",
    "Valtir Furar",
    "Armando Barraca",
    "Bartolomeu Pau",
    "Rodrigo Zei",
    "Armando Nabuceta",
    "Erguendo Vara",
    "Amarrola Detodos",
    "Matesão",
    "Tilan Bucano",
    "Li Dou Mamada",
    "Paubo Kete",
    "Eva Gina",
    "Armando Nocu",
    "Ita Duro",
    "Hérica Hilton",
    "Dei Navan",
    "Limeto Meupau",
    "Adorofu Rico",
    "Yuki Shota Nakama",
    "Alan Bida Nopau",
    "Paula Ambido",
    "Kubben Largo",
    "Mimas Turbo",
    "Titaco Opau",
    "Tokoku Kosano",
    "Gozaro Nakara",
    "Komias Toba",
    "Seucu Miama",
    "Tifuro Nakombi",
    "Consultor Macaco",
    "Petista Hétero",
    "Elefante Sandro",
    "Comunista Libertário",
    "Lima Maria de Graça",
    "Ana Busset Inha",
    "Ateu Religioso",
    "Flamenguita Tricolor",
    "Vegano Churrasqueiro",
    "Mentiroso Sincero",
    "Pacifista Agressivo",
    "Corno Monogamico",
    "Esquerdista de Direita",
    "Fitness Sedentario"
];

export const BOT_NAMES2 = [
     "Fabio Timelo",
    "Zeca Paugordinho",
    "Comecu",
    "Montei Nolobato",
    "Kellynguiça",
    "Paula Nocú",
    "Caio no Pau",
    "Jacinto Pinto",
    "Vera Pinto",
    "Paula Dentro",
    "Tomás Thurbando",
    "Ana Konda",
    "Cu Rioso",
    "Beto Kete",
    "Cuca Beludo",
    "Kiko Torto",
    "Jailson Mendes",
    "PauLúcia",
    "Pau Lão",
    "Armando Kú",
    "Rolaldo",
    "Paula Tejano",
    "Deíde Costa",
    "Beijamim Arrola",
    "Ocult Day",
    "Paula Vadão",
    "Paula Vadinho",
    "Paulo Minoso",
    "Tia Romba",
    "Benga Dura",
    "Giusepp Cadura",
    "Diego Norréia",
    "Limetos Vara",
    "Jalam Bipau",
    "Simas Turbo",
    "Che Quervara",
    "Limelo Leite",
    "Two Paypal",
    "Power Guido",
    "Kevin Mamar",
    "Mia Arregassa",
    "Elma Maria",
    "Oscar Alho",
    "Kemel Pinto"
];

export const DROP_V = 4;     // valor das bolinhas verdes (comida normal vale 1 ou 2, então a verde vale o dobro da maior)
export const LIVES = 3;      // quantas vezes cada cobra selecionável (controlada por pessoa) pode renascer
export const BODY_NAMES = ["Coral", "Jararaca", "Preta", "Branca", "Arco-íris", "Vermelha", "Laranja", "Amarela", "Limão", "Verde", "Turquesa", "Azul", "Roxa", "Rosa", "Marrom", "Sucuri", "Piton", "Mamba", "Verde e Amarelo", "Verde Néon", "Quadriculado"]; // 21 corpos (desenhos em src/draw.js, mesma ordem)
export const NB = BODY_NAMES.length;
export const CONDOMS = 3;     // quantos itens de camisinha existem no mapa
export const CONDOM_HITS = 2;  // toques que a camisinha aguenta antes de estourar (1 toque protege, o 2º rasga)
export const INV_TIME = 2.4;  // segundos de proteção piscando (3 piscadas) quando a cobra renasce ou entra
export const END_WAIT = 45;   // segundos que o ranking final fica na tela antes do lobby reabrir sozinho
export const COUNTDOWN = 5;   // segundos de contagem depois que todos clicam em PRONTO
export const PILLS = 3;       // quantas pílulas Tadala existem no mapa
export const PILL_STIFF = 6;   // segundos que a cobra fica reta e dura
export const PILL_MAX_CM = 20;  // só cobras até este tamanho sentem o efeito
export const PILL_BACK = 15;   // segundos para a pílula reaparecer em outro lugar depois de pega
// afinamento do rabo: j = índice do ponto contando da cabeça (0), n = total de pontos; devolve 1 (grosso) até ~0.15 na pontinha
export const TAPER = (j, n) => { const L = Math.min(n * .5, 24), e = n - 1 - j; return e >= L ? 1 : .15 + .85 * Math.pow(Math.max(0, e) / L, .85); };

// --- curvas e comida ---
export const TURN_R0 = 40;     // raio mínimo da curva (px) da cobra pequena. MENOR = curva mais fechada/rápida; MAIOR = mais aberta. (antes era ~60 fixo)
export const TURN_RK = .3;     // quanto o raio da curva cresce com o tamanho da cobra (0 = todas giram igual; maior = cobras grandes fazem curvas mais largas)
export const EAT_PAD = 30;     // folga (px) para pegar comida além do raio do corpo (antes 20). Mantenha >= TURN_R0 - 10 para a cobra nunca ficar rodando em volta da comida
export const MAX_DROPS = 140;  // máximo de bolinhas verdes que uma cobra solta ao morrer (o valor total continua igual: cada bolinha vale mais se a cobra era grande)
export const BODY_MAX = 12000;  // comprimento máximo do corpo (px). Cobra grande fica mais GROSSA, mas o corpo não passa disso; assim o rabo sempre acompanha o movimento. Aumente para cobras mais compridas.

// --- cards flutuantes (5 tipos, 1 de cada no mapa; só jogadores pegam) ---
export const CARDS_POR_TIPO = 3;     // quantos cards de cada tipo (diminui / cresce) existem no mapa
export const CARD_BACK = 20;         // segundos para o card reaparecer em outro lugar depois de pego
export const CARD_START_CM = .1;     // tamanho mínimo que a cobra pode ter por causa do card 1
export const CARD_SHRINK_TO = .4;    // card 1: a cobra encolhe para 40% do tamanho que tinha ao pegar o card
export const CARD_SHRINK_SECS = 8;   // card 1: tempo para encolher (qualquer tamanho; sempre de forma suave)
export const CARD_GROW_TIERS = [[20, 3], [100, 2], [Infinity, 1.3]];   // card 2: [até X cm, multiplicador]. Até 20 cm = x3 (20 vira 60); acima de 20 até 100 = x2 (dobra); acima de 100 = x1.3 (+30%)
export const CARD_GROW_SECS = 5;     // card 2: tempo total do crescimento (igual para qualquer tamanho)
export const CARD_GROW_ACCEL = 2;    // card 2: 1 = crescimento constante; 2 = vai acelerando (começa devagar e termina rápido); 3 = acelera ainda mais
export const CARD_BOOST_BELOW_CM = 10;   // card 2: cobra MENOR que isso (cm) ao pegar o card recebe o crescimento rápido abaixo
export const CARD_BOOST_TO_CM = 100;     // card 2 (cobra pequena): tamanho final em cm
export const CARD_BOOST_SECS = 3;        // card 2 (cobra pequena): tempo para chegar ao tamanho final

// --- zoom da câmera por tamanho (cada jogador vê conforme a própria cobra; só afasta a visão de quem está grande) ---
export const VIEW_FULL_CM = 100;    // até este tamanho (cm) a câmera mostra a cobra INTEIRA
export const VIEW_STEP_CM = 100;    // a cada quantos cm a parte visível do corpo diminui
export const VIEW_LOSS = .2;        // quanto diminui a cada passo (0.2 = 100% em 100cm, 80% em 200cm, 60% em 300cm, 40% em 400cm...)
export const VIEW_MIN_FRAC = 1 / 3; // nunca mostra menos que isso do corpo (1/3 da cobra)
export const VIEW_MAX_SPAN = 3000;  // limite (px) da área que a câmera abre; protege o servidor/rede em cobras gigantes
const VIEW_FRAC = cm => cm <= VIEW_FULL_CM ? 1 : Math.max(VIEW_MIN_FRAC, 1 - VIEW_LOSS * (cm - VIEW_FULL_CM) / VIEW_STEP_CM);
// tabela de "tamanho (px) que precisa caber na menor dimensão da tela" por cm; com máximo acumulado para a câmera nunca reaproximar enquanto a cobra cresce
const VIEW_TAB = []; for (let c = 0, m = 0; c <= 3000; c++) { m = Math.max(m, VIEW_FRAC(c) * (14 + c * 10)); VIEW_TAB.push(Math.min(m, VIEW_MAX_SPAN)); }
export const VIEW_SPAN = cm => VIEW_TAB[Math.min(3000, Math.max(0, Math.round(cm)))];

// --- comida concentrada em pontos (sorteados a cada partida) ---
// [quantos pontos, peso (quanta comida cada um recebe), raio em px]: 7 pontos MUITO cheios, 10 médios, 25 pequenos, 50 quase vazios. Posições e pesos (±25%) são sorteados a cada partida.
export const FOOD_HOT = [[10, 10, 520], [20, 5, 460], [50, 2, 380], [10, .6, 320]];
export const FOOD_BG = .03;              // fração da comida espalhada pelo mapa todo (0 = só nos pontos)
export const FOOD_HOT_MOVE = [90, 150];  // a cada tantos segundos (sorteado entre os dois valores) um ponto muda de lugar
