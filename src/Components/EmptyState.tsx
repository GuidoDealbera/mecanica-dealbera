import React from "react";
import { Button } from "@heroui/react";

interface EmptyStateAction {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

/**
 * Estado vacío reutilizable: ícono en círculo + título + descripción opcional
 * y un CTA opcional. Se usa en los listados cuando no hay datos (con acción
 * para crear el primer registro) o cuando una búsqueda no arroja resultados.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center gap-3 py-8 px-6 text-center">
    <div className="p-4 rounded-full bg-foreground-600 text-foreground-300">
      {icon}
    </div>
    <div>
      <p className="text-white font-semibold text-lg">{title}</p>
      {description && (
        <p className="text-foreground-400 text-sm mt-1">{description}</p>
      )}
    </div>
    {action && (
      <Button
        color="primary"
        className="font-semibold"
        startContent={action.icon}
        onPress={action.onPress}
      >
        {action.label}
      </Button>
    )}
  </div>
);

export default EmptyState;
