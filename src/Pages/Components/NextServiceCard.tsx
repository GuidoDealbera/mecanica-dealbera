import React from "react";
import { Chip, Spinner } from "@heroui/react";
import { MdNotificationsActive, MdSchedule } from "react-icons/md";
import {
  APIResponse,
  DEFAULT_SERVICE_SETTINGS,
  SERVICE_TYPE_LABELS,
  ServiceReminderView,
  ServiceSettings,
} from "../../Types/apiTypes";
import {
  evaluateReminder,
  formatDueSummary,
  getReminderBadge,
} from "../../Utils/serviceReminders";
import { formatDate } from "../../Utils/utils";
import { useToasts } from "../../Hooks/useToasts";
import ReminderActions from "./ReminderActions";

interface NextServiceCardProps {
  licensePlate: string;
}

/**
 * Bloque "Próximo service" de la ficha del vehículo: muestra los recordatorios
 * vigentes con su urgencia y las acciones disponibles según el estado
 * (`ReminderActions`, compartido con la bandeja de `/alerts`).
 */
const NextServiceCard: React.FC<NextServiceCardProps> = ({ licensePlate }) => {
  const { showToast } = useToasts();
  const [reminders, setReminders] = React.useState<ServiceReminderView[]>([]);
  const [settings, setSettings] = React.useState<ServiceSettings>(
    DEFAULT_SERVICE_SETTINGS
  );
  const [loading, setLoading] = React.useState(true);
  const [actioningId, setActioningId] = React.useState<string | null>(null);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, currentSettings] = await Promise.all([
        window.api.service.byCar(licensePlate),
        window.api.service.getSettings(),
      ]);
      setReminders(list);
      setSettings(currentSettings);
    } catch (error) {
      setReminders([]);
      showToast(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el próximo service",
        "danger",
        "Service"
      );
    } finally {
      setLoading(false);
    }
  }, [licensePlate, showToast]);

  React.useEffect(() => {
    fetch();
  }, [fetch]);

  const runAction = async (
    id: string,
    action: () => Promise<APIResponse<unknown>>
  ) => {
    setActioningId(id);
    try {
      const res = await action();
      showToast(
        res.message,
        res.status === "success" ? "success" : "danger",
        "Service"
      );
      if (res.status === "success") await fetch();
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <p className="text-foreground-400 text-sm py-2">
        Sin recordatorios de service vigentes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {reminders.map((reminder) => {
        const evaluation = evaluateReminder({
          status: reminder.status,
          dueDate: reminder.dueDate,
          dueKm: reminder.dueKm,
          snoozedUntil: reminder.snoozedUntil,
          currentKm: reminder.car.kilometers,
          kmPerDay: reminder.kmPerDay,
          settings,
        });
        const badge = getReminderBadge(reminder.status, evaluation);

        return (
          <div
            key={reminder.id}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-content2 border border-divider"
          >
            <MdNotificationsActive
              size={18}
              className="text-warning-500 flex-shrink-0"
            />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">
                  {SERVICE_TYPE_LABELS[reminder.type]}
                </p>
                <Chip size="sm" color={badge.color} variant="flat">
                  {badge.label}
                </Chip>
              </div>
              <p className="text-foreground-400 text-xs">
                {formatDueSummary(evaluation)}
                {reminder.dueDate && ` · ${formatDate(reminder.dueDate)}`}
                {reminder.dueKm !== null &&
                  ` · ${reminder.dueKm.toLocaleString("es-AR")} km`}
              </p>
              {/* Al posponer, esto es lo que cambia a la vista: hasta cuándo
                  quedó postergado (el vencimiento no se toca). */}
              {evaluation.urgency === "snoozed" && reminder.snoozedUntil && (
                <p className="text-primary-500 text-xs flex items-center gap-1">
                  <MdSchedule size={12} />
                  Postergado hasta {formatDate(reminder.snoozedUntil)}
                </p>
              )}
              {evaluation.projectedKmDate && (
                <p className="text-foreground-500 text-xs">
                  Al ritmo actual llegaría al kilometraje el{" "}
                  {formatDate(evaluation.projectedKmDate)}
                </p>
              )}
            </div>

            <ReminderActions
              reminder={reminder}
              evaluation={evaluation}
              isBusy={actioningId === reminder.id}
              onRun={(action) => runAction(reminder.id, action)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default NextServiceCard;
