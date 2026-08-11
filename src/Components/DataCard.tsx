import React from "react";
import { Card, CardBody, CardHeader, Divider } from "@heroui/react";

/** Color de acento de la tarjeta (define ícono, título, borde y realces). */
export type DataCardAccent =
  "primary" | "success" | "secondary" | "warning" | "default";

/**
 * Clases por acento.
 *
 * Se usan los tokens **base** (`primary`, `success`, …) con transparencia en vez
 * de los tonos numéricos (`success-300`, `warning-900`). HeroUI invierte las
 * escalas numéricas entre claro y oscuro, así que un `text-success-300` que se ve
 * bien en oscuro queda casi blanco sobre una tarjeta clara — que era justo lo que
 * pasaba en esta pantalla. El token base sí es legible en los dos temas, y el
 * `/10` de los fondos se compone sobre la superficie de cada tema.
 */
const ACCENTS: Record<
  DataCardAccent,
  { icon: string; title: string; border: string; wash: string; ring: string }
> = {
  primary: {
    icon: "text-primary",
    title: "text-primary",
    border: "border-primary/30",
    wash: "bg-primary/10",
    ring: "hover:border-primary/60",
  },
  success: {
    icon: "text-success",
    title: "text-success",
    border: "border-success/30",
    wash: "bg-success/10",
    ring: "hover:border-success/60",
  },
  secondary: {
    icon: "text-secondary",
    title: "text-secondary",
    border: "border-secondary/30",
    wash: "bg-secondary/10",
    ring: "hover:border-secondary/60",
  },
  warning: {
    icon: "text-warning",
    title: "text-warning",
    border: "border-warning/40",
    wash: "bg-warning/10",
    ring: "hover:border-warning/70",
  },
  default: {
    icon: "text-foreground-500",
    title: "text-foreground",
    border: "border-divider",
    wash: "bg-default-100",
    ring: "hover:border-default-400",
  },
};

interface DataCardProps {
  icon: React.ReactNode;
  title: string;
  /** Bajada corta al lado del título. */
  subtitle?: string;
  /** Qué hace la acción, en una o dos frases. */
  description: string;
  /** Aviso destacado (aclaración o advertencia). */
  note?: React.ReactNode;
  accent?: DataCardAccent;
  /** Contenido extra entre la descripción y la acción (listas, detalles). */
  children?: React.ReactNode;
  /** Botón de la tarjeta; queda anclado al pie para alinear toda la fila. */
  action: React.ReactNode;
}

/**
 * Tarjeta de una acción de gestión de datos (exportar, importar, respaldos…).
 *
 * Todas las tarjetas de la pantalla comparten estructura —ícono + título +
 * descripción + aviso + botón— así que vale un solo componente: antes cada una
 * repetía el mismo armado con clases levemente distintas, y por eso se veían
 * desparejas. El botón va con `mt-auto` para que quede a la misma altura en
 * todas, independientemente del largo del texto.
 */
const DataCard: React.FC<DataCardProps> = ({
  icon,
  title,
  subtitle,
  description,
  note,
  accent = "primary",
  children,
  action,
}) => {
  const a = ACCENTS[accent];

  return (
    <Card
      className={`h-full bg-content2 border ${a.border} ${a.ring} shadow-md transition-colors`}
    >
      <CardHeader className="flex items-start gap-3 pb-0">
        <div className={`p-2.5 rounded-xl ${a.wash} ${a.icon} flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h5 className={`font-semibold text-base ${a.title}`}>{title}</h5>
          {subtitle && (
            <p className="text-foreground-400 text-xs">{subtitle}</p>
          )}
        </div>
      </CardHeader>

      <Divider className="my-3 bg-divider" />

      <CardBody className="pt-0 flex flex-col gap-3">
        <p className="text-foreground-500 text-sm">{description}</p>

        {note && (
          <div className={`flex items-start gap-2 rounded-lg p-3 ${a.wash}`}>
            {note}
          </div>
        )}

        {children}

        <div className="mt-auto pt-1">{action}</div>
      </CardBody>
    </Card>
  );
};

export default DataCard;
