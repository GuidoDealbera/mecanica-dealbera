import React from "react";

interface PageShellProps {
  /** Zona superior fija: título, acciones, filtros. No scrollea. */
  header?: React.ReactNode;
  /** Zona inferior fija: paginación, totales. No scrollea. */
  footer?: React.ReactNode;
  /**
   * `true` (por defecto): el cuerpo scrollea verticalmente.
   * `false`: el cuerpo es una columna flex y el scroll lo administra el hijo
   * (por ejemplo una tabla que scrollea su propio body y deja el paginado fijo).
   */
  scrollBody?: boolean;
  /** Clases extra para el contenedor externo. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Contenedor estándar de página.
 *
 * Toda la aplicación usa un layout de **alto fijo**: la ventana no scrollea, y
 * lo único que se desplaza es el cuerpo de cada página (sólo en vertical). Eso
 * mantiene siempre a la vista la barra de navegación, el título y la
 * paginación.
 *
 * La clave es la combinación `flex-1 min-h-0` en el cuerpo: sin `min-h-0` un
 * hijo flex nunca se achica por debajo de su contenido y el `overflow` no
 * llegaría a activarse nunca.
 */
const PageShell: React.FC<PageShellProps> = ({
  header,
  footer,
  scrollBody = true,
  className,
  children,
}) => (
  <div
    className={`h-full min-h-0 flex flex-col overflow-hidden rounded-md bg-content1 text-foreground shadow shadow-primary ${
      className ?? ""
    }`}
  >
    {header && <div className="shrink-0 px-4 pt-4 pb-3">{header}</div>}

    {/* Con cabecera el cuerpo lleva `pt-1` y no cero: el contenedor recorta con
        `overflow-y-auto`, así que un hijo pegado al borde superior pierde su
        sombra. Se veía en el dashboard, donde las `StatCard` arrancaban contra
        la cabecera y su `shadow shadow-primary` quedaba cortada. */}
    <div
      className={`flex-1 min-h-0 px-4 ${header ? "pt-1" : "pt-4"} ${
        footer ? "" : "pb-4"
      } ${scrollBody ? "overflow-y-auto overflow-x-hidden" : "flex flex-col"}`}
    >
      {children}
    </div>

    {footer && <div className="shrink-0 px-4 pt-3 pb-4">{footer}</div>}
  </div>
);

export default PageShell;
