// tela cheia (Android/iPad). No iPhone o Safari não permite: lá só funciona abrindo pelo ícone "Adicionar à Tela de Início".
export const fsOk = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export function toggleFs() {
  const d = document, e = d.documentElement;
  if (isFs()) { (d.exitFullscreen || d.webkitExitFullscreen)?.call(d); screen.orientation?.unlock?.(); return; }
  const req = e.requestFullscreen || e.webkitRequestFullscreen; if (!req) return;
  Promise.resolve(req.call(e)).then(() => screen.orientation?.lock?.("landscape")).catch(() => {});   // trava na horizontal quando o aparelho deixa
}
