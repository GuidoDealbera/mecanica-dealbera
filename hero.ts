import { heroui } from "@heroui/react";

/**
 * Configuración central de temas (fuente única de verdad de la paleta).
 *
 * Se apoya en los temas `light` y `dark` de HeroUI (ya balanceados para que
 * inputs, menús, tablas, botones y toasts contrasten bien dentro de cada tema)
 * con ajustes puntuales:
 *
 * - `light`: fondo de página apenas gris para que las tarjetas blancas resalten
 *   y textos atenuados un poco más oscuros (los grises por defecto quedaban muy
 *   claros sobre blanco).
 * - `dark`: se **fija** la escala `primary` igual que en `light`. HeroUI invierte
 *   las escalas numéricas por tema; como la app usa `primary-700/800/900` como
 *   fondos saturados con texto blanco (headers de tabla, botones, títulos), sin
 *   esto quedarían celestes pálidos y el texto blanco sería ilegible.
 *
 * Nota de diseño: los inputs, los botones `default` y las filas de las tablas se
 * pintan con la escala `default` (fondo claro + texto oscuro en claro; fondo
 * oscuro + texto claro en oscuro). Las tablas usan el MISMO token `default-100`
 * que los inputs para comportarse igual y contrastar siempre con la tarjeta.
 */
export default heroui({
  themes: {
    light: {
      colors: {
        background: "#e4e4e7",
        foreground: {
          400: "#71717a",
          500: "#52525b",
        },
      },
    },
    dark: {
      colors: {
        primary: {
          50: "#e6f1fe",
          100: "#cce3fd",
          200: "#99c7fb",
          300: "#66aaf9",
          400: "#338ef7",
          500: "#006FEE",
          600: "#005bc4",
          700: "#004493",
          800: "#002e62",
          900: "#001731",
          foreground: "#fff",
          DEFAULT: "#006FEE",
        },
      },
    },
  },
});
