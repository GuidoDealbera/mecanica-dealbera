/// <reference types="vite/client" />

// `vite/client` declara los assets con extensión en minúscula (`*.ttf`), pero la
// fuente de patentes del proyecto es `FE-FONT.TTF`. Con `assetsInlineLimit`
// (vite.config.mts) el import resuelve a un data URI en base64.
declare module "*.TTF" {
  const src: string;
  export default src;
}
