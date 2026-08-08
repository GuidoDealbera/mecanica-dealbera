import { semanticColors } from "@heroui/theme";
import { JobStatus } from "../Types/apiTypes";

/**
 * Tema de los documentos PDF (presupuestos y facturas).
 *
 * Los colores se **derivan del mismo theme de HeroUI que usa la app** (variante
 * `light`, porque el documento se imprime sobre papel blanco): así el PDF no
 * puede quedar desalineado del sistema si la paleta cambia. Antes el PDF usaba
 * una paleta propia (azules/grises de Tailwind) que no coincidía con ninguno de
 * los colores de la interfaz.
 */

export type RGB = [number, number, number];

/** Convierte un color hex (#rgb, #rrggbb) del theme a la tupla que usa jsPDF. */
export const hexToRgb = (hex: string): RGB => {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

// El theme de HeroUI tipa los colores de forma laxa (string | objeto de escala);
// este helper resuelve un tono concreto y falla temprano si no existe.
const token = (
  color: keyof typeof semanticColors.light,
  shade: string | number
): RGB => {
  const scale = semanticColors.light[color] as Record<string, string>;
  const value = scale?.[String(shade)];
  if (typeof value !== "string") {
    throw new Error(`Token de color inexistente: ${String(color)}-${shade}`);
  }
  return hexToRgb(value);
};

/** Paleta del documento, en los mismos tokens semánticos que la interfaz. */
export const PDF_COLORS = {
  // Marca / acentos
  primary: token("primary", 500),
  primaryStrong: token("primary", 700),
  primaryDeep: token("primary", 800),
  primarySoft: token("primary", 100),
  primaryFaint: token("primary", 50),

  // Superficies (papel = content1 del tema claro)
  paper: token("content1", "DEFAULT"),
  surface: token("default", 50),
  surfaceAlt: token("default", 100),
  border: token("default", 200),

  // Texto
  text: token("foreground", 900),
  textMuted: token("foreground", 500),
  textSubtle: token("foreground", 400),
  onPrimary: [255, 255, 255] as RGB,

  // Semánticos (mismos que los Chips de la app)
  success: token("success", 600),
  warning: token("warning", 600),
  danger: token("danger", 600),
  secondary: token("secondary", 600),
} as const;

/**
 * Chip de estado con el mismo criterio que la tabla de trabajos de la app
 * (`STATUS_MAP`): mismo color semántico por estado y look "flat" (fondo tenue +
 * texto saturado), acá con los tonos 100/700 que contrastan sobre papel.
 */
export const STATUS_CHIP: Record<JobStatus, { bg: RGB; text: RGB }> = {
  [JobStatus.PENDING]: {
    bg: token("default", 200),
    text: token("default", 700),
  },
  [JobStatus.IN_PROGRESS]: {
    bg: token("primary", 100),
    text: token("primary", 700),
  },
  [JobStatus.COMPLETED]: {
    bg: token("success", 100),
    text: token("success", 700),
  },
  [JobStatus.DELIVERED]: {
    bg: token("secondary", 100),
    text: token("secondary", 700),
  },
};

/**
 * Escala tipográfica del documento (pt). Sigue la jerarquía de la interfaz:
 * título de marca > título de sección > cuerpo > auxiliar.
 */
export const PDF_TEXT = {
  brand: 18,
  docTitle: 12,
  sectionTitle: 10,
  plate: 24,
  body: 9,
  label: 9,
  small: 8,
  tiny: 7,
} as const;

/** Medidas base del documento (mm), para que todo respete la misma grilla. */
export const PDF_LAYOUT = {
  margin: 16,
  headerHeight: 30,
  footerHeight: 12,
  radius: 3,
  gap: 6,
  borderWidth: 0.3,
} as const;
