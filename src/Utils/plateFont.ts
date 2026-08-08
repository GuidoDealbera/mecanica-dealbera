// `assetsInlineLimit` (vite.config.mts) fuerza el inline de los .ttf, así que
// este import resuelve a un data URI con la fuente en base64: queda embebida en
// el bundle y no hace falta leerla en runtime (en producción, con Electron sobre
// file://, un fetch del asset no sería confiable).
import feFontDataUri from "../assets/fonts/FE-FONT.TTF";

const BASE64_MARKER = "base64,";

/**
 * Devuelve FE-FONT en base64 para registrarla en el PDF (es la misma tipografía
 * con la que la app dibuja las patentes). Si el asset no viniera como data URI,
 * devuelve `undefined` y el documento cae a su tipografía estándar.
 */
export const getPlateFontBase64 = (): string | undefined => {
  const index = feFontDataUri.indexOf(BASE64_MARKER);
  if (index < 0) return undefined;
  return feFontDataUri.slice(index + BASE64_MARKER.length);
};
