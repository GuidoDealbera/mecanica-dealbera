import React from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from "@heroui/react";
import {
  MdBuild,
  MdCheckCircle,
  MdKeyboardArrowDown,
  MdSchedule,
  MdUndo,
  MdWhatsapp,
} from "react-icons/md";
import { APIResponse, ServiceReminderView } from "../../Types/apiTypes";
import {
  getReminderActions,
  ReminderEvaluation,
  SNOOZE_OPTIONS,
} from "../../Utils/serviceReminders";

interface ReminderActionsProps {
  reminder: ServiceReminderView;
  evaluation: ReminderEvaluation;
  /** Deshabilita todo mientras hay una acción en curso sobre este recordatorio. */
  isBusy: boolean;
  /** Ejecuta la acción y refresca; lo provee la pantalla que lo usa. */
  onRun: (action: () => Promise<APIResponse<unknown>>) => void;
  /** Aviso por WhatsApp al titular (sólo la bandeja lo ofrece). */
  onWhatsapp?: () => void;
  /** Ir a cargar un trabajo para el vehículo. */
  onAddJob?: () => void;
}

/**
 * Barra de acciones de un recordatorio de service, compartida por la bandeja
 * (`/alerts`) y por la ficha del vehículo.
 *
 * Vive en un solo lugar porque las acciones **dependen del estado**: qué se
 * puede hacer lo decide `getReminderActions` (la misma regla que valida el
 * backend). Antes cada pantalla ofrecía su propio subconjunto de botones
 * siempre habilitados, así que se podía posponer un service al día o postergar
 * dos veces sin que nada cambiara a la vista.
 */
const ReminderActions: React.FC<ReminderActionsProps> = ({
  reminder,
  evaluation,
  isBusy,
  onRun,
  onWhatsapp,
  onAddJob,
}) => {
  const actions = getReminderActions(reminder.status, evaluation);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {onWhatsapp && (
        <Tooltip content="Avisar por WhatsApp" color="success" showArrow>
          <Button
            isIconOnly
            size="sm"
            className="bg-success-600 text-white"
            isDisabled={isBusy}
            onPress={onWhatsapp}
            aria-label="Avisar por WhatsApp"
          >
            <MdWhatsapp size={18} />
          </Button>
        </Tooltip>
      )}

      {actions.canSnooze ? (
        <Dropdown>
          <DropdownTrigger>
            <Button
              size="sm"
              variant="flat"
              isDisabled={isBusy}
              startContent={<MdSchedule size={16} />}
              endContent={<MdKeyboardArrowDown size={16} />}
            >
              Posponer
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Posponer recordatorio"
            onAction={(key) =>
              onRun(() => window.api.service.snooze(reminder.id, Number(key)))
            }
          >
            {SNOOZE_OPTIONS.map((option) => (
              <DropdownItem key={option.days}>{option.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      ) : (
        // El botón se muestra deshabilitado (y no se esconde) para que quede
        // claro que la acción existe y por qué no está disponible ahora. El
        // `span` es necesario porque un botón deshabilitado no emite los
        // eventos que abren el tooltip.
        <Tooltip
          content={actions.snoozeDisabledReason ?? "No se puede posponer"}
          color="foreground"
          showArrow
        >
          <span className="inline-flex">
            <Button
              size="sm"
              variant="flat"
              isDisabled
              startContent={<MdSchedule size={16} />}
            >
              Posponer
            </Button>
          </span>
        </Tooltip>
      )}

      {actions.canReactivate && (
        <Tooltip
          content="Volver a poner el recordatorio vigente"
          color="primary"
          showArrow
        >
          <Button
            size="sm"
            variant="flat"
            color="primary"
            isDisabled={isBusy}
            startContent={<MdUndo size={16} />}
            onPress={() =>
              onRun(() => window.api.service.reactivate(reminder.id))
            }
          >
            Reactivar
          </Button>
        </Tooltip>
      )}

      {actions.canComplete && (
        <Tooltip
          content="Service hecho (programa el próximo)"
          color="primary"
          showArrow
        >
          <Button
            isIconOnly
            size="sm"
            color="primary"
            variant="flat"
            isDisabled={isBusy}
            onPress={() =>
              onRun(() => window.api.service.complete(reminder.id))
            }
            aria-label="Marcar el service como hecho"
          >
            <MdCheckCircle size={18} />
          </Button>
        </Tooltip>
      )}

      {onAddJob && (
        <Tooltip content="Cargar trabajo" color="primary" showArrow>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={onAddJob}
            aria-label="Cargar trabajo"
          >
            <MdBuild size={18} />
          </Button>
        </Tooltip>
      )}

      {actions.canDismiss && (
        <Button
          size="sm"
          variant="light"
          color="danger"
          isDisabled={isBusy}
          onPress={() => onRun(() => window.api.service.dismiss(reminder.id))}
        >
          Descartar
        </Button>
      )}
    </div>
  );
};

export default ReminderActions;
