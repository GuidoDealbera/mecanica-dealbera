import React from "react";
import { Button, Chip, Spinner, Tooltip } from "@heroui/react";
import {
  MdCheckCircle,
  MdNotificationsActive,
  MdSchedule,
} from "react-icons/md";
import {
  DEFAULT_SERVICE_SETTINGS,
  SERVICE_TYPE_LABELS,
  ServiceReminderView,
  ServiceSettings,
} from "../../Types/apiTypes";
import {
  evaluateReminder,
  formatDueSummary,
  URGENCY_COLOR,
  URGENCY_LABELS,
} from "../../Utils/serviceReminders";
import { formatDate } from "../../Utils/utils";
import { useToasts } from "../../Hooks/useToasts";

interface NextServiceCardProps {
  licensePlate: string;
}

/**
 * Bloque "Próximo service" de la ficha del vehículo: muestra los recordatorios
 * vigentes con su urgencia y permite marcar el service como hecho (lo que
 * programa el siguiente) o posponerlo.
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
    } finally {
      setLoading(false);
    }
  }, [licensePlate]);

  React.useEffect(() => {
    fetch();
  }, [fetch]);

  const runAction = async (
    id: string,
    action: () => Promise<{ status: string; message: string }>
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

        return (
          <div
            key={reminder.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-content2 border border-divider"
          >
            <MdNotificationsActive
              size={18}
              className="text-warning-500 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">
                  {SERVICE_TYPE_LABELS[reminder.type]}
                </p>
                <Chip
                  size="sm"
                  color={URGENCY_COLOR[evaluation.urgency]}
                  variant="flat"
                >
                  {URGENCY_LABELS[evaluation.urgency]}
                </Chip>
              </div>
              <p className="text-foreground-400 text-xs">
                {formatDueSummary(evaluation)}
                {reminder.dueDate && ` · ${formatDate(reminder.dueDate)}`}
                {reminder.dueKm !== null &&
                  ` · ${reminder.dueKm.toLocaleString("es-AR")} km`}
              </p>
              {evaluation.projectedKmDate && (
                <p className="text-foreground-500 text-xs">
                  Al ritmo actual llegaría al kilometraje el{" "}
                  {formatDate(evaluation.projectedKmDate)}
                </p>
              )}
            </div>

            <Tooltip content="Posponer 30 días" color="primary" showArrow>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                isDisabled={actioningId === reminder.id}
                onPress={() =>
                  runAction(reminder.id, () =>
                    window.api.service.snooze(reminder.id, 30)
                  )
                }
              >
                <MdSchedule size={16} />
              </Button>
            </Tooltip>
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
                isDisabled={actioningId === reminder.id}
                onPress={() =>
                  runAction(reminder.id, () =>
                    window.api.service.complete(reminder.id)
                  )
                }
              >
                <MdCheckCircle size={16} />
              </Button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
};

export default NextServiceCard;
