import React from "react";
import { Button, Chip, Input, Spinner } from "@heroui/react";
import { MdEdit, MdNotificationsActive, MdSchedule } from "react-icons/md";
import {
  APIResponse,
  DEFAULT_SERVICE_SETTINGS,
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
import EditReminderModal from "../../Components/EditReminderModal";
import { ensureSuccess } from "../../Utils/apiResponse";

/**
 * Los intervalos propios del vehículo.
 *
 * `Car.serviceIntervalMonths` y `serviceIntervalKm` existían, los usaba
 * `computeNextService`, y **ninguna pantalla los editaba**: la funcionalidad
 * estaba escrita al 90% y era inalcanzable, así que todos los vehículos usaban
 * los intervalos generales. Es justo el caso que describe el comentario de la
 * entidad —distinguir un auto de uso intensivo de uno de fin de semana— y no se
 * podía hacer.
 *
 * Vacío significa "usar los generales", que es lo que dice el placeholder. Por
 * eso el campo vacío manda `null` y no se omite: omitirlo sería "no lo toques".
 */
const IntervalosDelVehiculo: React.FC<{
  carId: string;
  intervalMonths: number | null;
  intervalKm: number | null;
  generales: ServiceSettings;
  onSaved: () => void;
}> = ({ carId, intervalMonths, intervalKm, generales, onSaved }) => {
  const { showToast } = useToasts();
  const [meses, setMeses] = React.useState(
    intervalMonths === null ? "" : String(intervalMonths)
  );
  const [kms, setKms] = React.useState(
    intervalKm === null ? "" : String(intervalKm)
  );
  const [guardando, setGuardando] = React.useState(false);

  const comoNumero = (texto: string): number | null =>
    texto.trim() === "" ? null : Number(texto.replace(/\D/g, ""));

  const cambio =
    comoNumero(meses) !== intervalMonths || comoNumero(kms) !== intervalKm;

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await window.api.cars.update(carId, {
        serviceIntervalMonths: comoNumero(meses),
        serviceIntervalKm: comoNumero(kms),
      });
      showToast(
        res.status === "success"
          ? "Intervalos de este vehículo actualizados"
          : res.message,
        res.status === "success" ? "success" : "danger",
        "Service"
      );
      if (res.status === "success") onSaved();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 pt-3 mt-1 border-t border-divider">
      <p className="w-full text-xs text-foreground-500">
        Intervalos de este vehículo. Vacío usa los generales.
      </p>
      <Input
        label="Cada (meses)"
        size="sm"
        className="max-w-[140px]"
        inputMode="numeric"
        placeholder={String(generales.intervalMonths)}
        value={meses}
        onChange={(e) => setMeses(e.target.value.replace(/\D/g, ""))}
        isDisabled={guardando}
      />
      <Input
        label="Cada (km)"
        size="sm"
        className="max-w-[150px]"
        inputMode="numeric"
        placeholder={String(generales.intervalKm)}
        value={kms}
        onChange={(e) => setKms(e.target.value.replace(/\D/g, ""))}
        isDisabled={guardando}
      />
      <Button
        size="sm"
        color="primary"
        variant="flat"
        isDisabled={!cambio}
        isLoading={guardando}
        onPress={guardar}
      >
        Guardar
      </Button>
    </div>
  );
};

interface NextServiceCardProps {
  licensePlate: string;
  /** Para guardar los intervalos propios del vehículo. */
  carId: string;
  intervalMonths: number | null;
  intervalKm: number | null;
  /** Se llama cuando cambian los intervalos, para releer el vehículo. */
  onCarUpdated: () => void;
  /**
   * Kilometraje actual del vehículo. Hace falta para el modal de edición, que
   * avisa si el objetivo ya quedó atrás. Viene por prop porque cuando no hay
   * ningún recordatorio no hay de dónde sacarlo.
   */
  currentKm: number;
}

/**
 * Bloque "Próximo service" de la ficha del vehículo: muestra los recordatorios
 * vigentes con su urgencia y las acciones disponibles según el estado
 * (`ReminderActions`, compartido con la bandeja de `/alerts`).
 */
const NextServiceCard: React.FC<NextServiceCardProps> = ({
  licensePlate,
  currentKm,
  carId,
  intervalMonths,
  intervalKm,
  onCarUpdated,
}) => {
  const { showToast } = useToasts();
  const [reminders, setReminders] = React.useState<ServiceReminderView[]>([]);
  const [settings, setSettings] = React.useState<ServiceSettings>(
    DEFAULT_SERVICE_SETTINGS
  );
  const [loading, setLoading] = React.useState(true);
  const [actioningId, setActioningId] = React.useState<string | null>(null);
  // Dos estados y no uno: `null` significa "crear uno nuevo", así que no sirve
  // para representar también "el modal está cerrado".
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceReminderView | null>(
    null
  );

  const openEditor = (reminder: ServiceReminderView | null) => {
    setEditing(reminder);
    setEditorOpen(true);
  };

  const fetch = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, currentSettings] = await Promise.all([
        window.api.service.byCar(licensePlate),
        window.api.service.getSettings(),
      ]);
      // `ensureSuccess` lanza con el motivo del backend, que es lo que el
      // `catch` de abajo ya sabe mostrar.
      setReminders(ensureSuccess(list));
      setSettings(ensureSuccess(currentSettings));
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta al proceso principal; el `setLoading(true)` sincrónico dispara el aviso
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

  const editor = (
    <EditReminderModal
      isOpen={editorOpen}
      onClose={() => setEditorOpen(false)}
      licensePlate={licensePlate}
      reminder={editing}
      currentKm={currentKm}
      onSaved={fetch}
      onResult={(res) =>
        showToast(
          res.message,
          res.status === "success" ? "success" : "danger",
          "Service"
        )
      }
    />
  );

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  const intervalos = (
    <IntervalosDelVehiculo
      carId={carId}
      intervalMonths={intervalMonths}
      intervalKm={intervalKm}
      generales={settings}
      onSaved={() => {
        onCarUpdated();
        fetch();
      }}
    />
  );

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <p className="text-foreground-400 text-sm">
            Sin recordatorios de service vigentes.
          </p>
          <Button
            size="sm"
            variant="flat"
            color="primary"
            startContent={<MdEdit size={16} />}
            onPress={() => openEditor(null)}
          >
            Programar service
          </Button>
        </div>
        {intervalos}
        {editor}
      </div>
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
                <p className="text-sm font-medium">Próximo service</p>
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

            <div className="flex items-center gap-2">
              <ReminderActions
                reminder={reminder}
                evaluation={evaluation}
                isBusy={actioningId === reminder.id}
                onRun={(action) => runAction(reminder.id, action)}
              />
              <Button
                size="sm"
                variant="light"
                isIconOnly
                aria-label="Editar próximo service"
                title="Editar fecha o kilometraje"
                onPress={() => openEditor(reminder)}
              >
                <MdEdit size={16} />
              </Button>
            </div>
          </div>
        );
      })}
      {intervalos}
      {editor}
    </div>
  );
};

export default NextServiceCard;
