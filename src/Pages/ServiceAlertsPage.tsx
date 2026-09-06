import React from "react";
import {
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Tooltip,
} from "@heroui/react";
import { HiOutlineRefresh } from "react-icons/hi";
import {
  MdCheckCircle,
  MdNotificationsActive,
  MdPhone,
  MdSchedule,
  MdSettings,
} from "react-icons/md";
import { IoCarSportSharp, IoSearch } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import {
  APIResponse,
  DEFAULT_SERVICE_SETTINGS,
  ReminderScope,
  ServiceReminderView,
  ServiceSettings,
} from "../Types/apiTypes";
import {
  evaluateReminder,
  formatDueSummary,
  getReminderBadge,
} from "../Utils/serviceReminders";
import { buildWhatsappUrl, formatDate } from "../Utils/utils";
import { clampPage } from "../Utils/pagination";
import LicenceTable from "../Components/Licenses/LicenceTable";
import TablePagination from "../Components/TablePagination";
import EmptyState from "../Components/EmptyState";
import PageShell from "../Components/PageShell";
import TableLoadingContent from "../Components/TableLoadingContent";
import ReminderActions from "./Components/ReminderActions";
import { useToasts } from "../Hooks/useToasts";
import { useDebounce } from "../Hooks/useDebounce";

const PAGE_SIZE = 8;

const SCOPE_OPTIONS: { key: ReminderScope; label: string }[] = [
  { key: "due", label: "Requieren atención" },
  { key: "pending", label: "Todos los vigentes" },
  { key: "all", label: "Historial completo" },
];

/**
 * Filtro por aviso al cliente. Se usa una clave de texto y no un booleano
 * porque son **tres** estados —incluido "no filtrar"— y `undefined` no sirve
 * como `selectedKeys` de un Select.
 */
type ContactedFilter = "todos" | "sin-avisar" | "avisados";

const CONTACTED_OPTIONS: { key: ContactedFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sin-avisar", label: "Sin avisar" },
  { key: "avisados", label: "Ya avisados" },
];

const CONTACTED_VALUE: Record<ContactedFilter, boolean | undefined> = {
  todos: undefined,
  "sin-avisar": false,
  avisados: true,
};

/**
 * Bandeja de recordatorios de service.
 *
 * Reemplaza el listado de "alertas" anterior, que era de sólo lectura: al no
 * poder marcar nada, mostraba siempre lo mismo y se volvía ruido. Acá cada
 * recordatorio se puede accionar (avisar al titular, posponer, marcar el service
 * como hecho o descartarlo), que es lo que lo hace útil.
 */
const ServiceAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToasts();

  const [reminders, setReminders] = React.useState<ServiceReminderView[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [actioningId, setActioningId] = React.useState<string | null>(null);

  const [page, setPage] = React.useState(1);
  const [scope, setScope] = React.useState<ReminderScope>("due");
  const [contacted, setContacted] = React.useState<ContactedFilter>("todos");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [settings, setSettings] = React.useState<ServiceSettings>(
    DEFAULT_SERVICE_SETTINGS
  );
  const [showSettings, setShowSettings] = React.useState(false);
  const [settingsDraft, setSettingsDraft] = React.useState<ServiceSettings>(
    DEFAULT_SERVICE_SETTINGS
  );

  const fetchSettings = React.useCallback(async () => {
    try {
      const current = await window.api.service.getSettings();
      setSettings(current);
      setSettingsDraft(current);
    } catch {
      /* si falla, quedan los valores por defecto */
    }
  }, []);

  // La página pedida, acotada a la última que existe. Se deriva al leer en vez
  // de corregirse después con un efecto: ver `clampPage`.
  const effectivePage = clampPage(page, total, PAGE_SIZE);

  const fetchReminders = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.service.list({
        page: effectivePage,
        pageSize: PAGE_SIZE,
        scope,
        contacted: CONTACTED_VALUE[contacted],
        search: debouncedSearch || undefined,
      });
      setReminders(result.items);
      setTotal(result.total);
    } catch (error) {
      // Sin este catch un fallo del listado quedaba como promesa rechazada sin
      // atender: la pantalla mostraba "Todo al día" como si no hubiera nada,
      // ocultando el error real.
      setReminders([]);
      setTotal(0);
      showToast(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los recordatorios",
        "danger",
        "Recordatorios"
      );
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [effectivePage, scope, contacted, debouncedSearch, showToast]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta al proceso principal
    fetchSettings();
  }, [fetchSettings]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta al proceso principal; el `setLoading(true)` sincrónico dispara el aviso
    fetchReminders();
  }, [fetchReminders]);

  /** Evalúa cada recordatorio con la misma lógica que usa el backend. */
  const evaluated = React.useMemo(
    () =>
      reminders.map((reminder) => {
        const evaluation = evaluateReminder({
          status: reminder.status,
          dueDate: reminder.dueDate,
          dueKm: reminder.dueKm,
          snoozedUntil: reminder.snoozedUntil,
          currentKm: reminder.car.kilometers,
          kmPerDay: reminder.kmPerDay,
          settings,
        });
        return {
          reminder,
          evaluation,
          badge: getReminderBadge(reminder.status, evaluation),
        };
      }),
    [reminders, settings]
  );

  /** Ejecuta una acción sobre un recordatorio y refresca la bandeja. */
  const runAction = React.useCallback(
    async (id: string, action: () => Promise<APIResponse<unknown>>) => {
      setActioningId(id);
      try {
        const res = await action();
        showToast(
          res.message,
          res.status === "success" ? "success" : "danger",
          "Recordatorios"
        );
        if (res.status === "success") await fetchReminders();
      } finally {
        setActioningId(null);
      }
    },
    [fetchReminders, showToast]
  );

  const handleWhatsapp = (reminder: ServiceReminderView) => {
    const message =
      `Hola ${reminder.owner.fullname}, te escribimos de Mecánica Dealbera. ` +
      `Según nuestros registros, tu ${reminder.car.brand} ${reminder.car.model} ` +
      `(${reminder.car.licensePlate}) ya está para el service. ` +
      `¿Querés que coordinemos un turno?`;
    const url = buildWhatsappUrl(reminder.owner.phone, message);
    if (!url) {
      showToast(
        "El titular no tiene un teléfono válido",
        "warning",
        "Recordatorios"
      );
      return;
    }
    window.api.global.openExternal(url);
    // Se registra el contacto para saber a quién ya se avisó.
    runAction(reminder.id, () => window.api.service.markContacted(reminder.id));
  };

  const handleSaveSettings = async () => {
    const res = await window.api.service.setSettings(settingsDraft);
    showToast(
      res.message,
      res.status === "success" ? "success" : "danger",
      "Recordatorios"
    );
    if (res.status === "success" && res.result) {
      setSettings(res.result);
      setSettingsDraft(res.result);
      setShowSettings(false);
      await fetchReminders();
    }
  };

  const hasFilters = !!debouncedSearch;

  // Cabecera fija: título, configuración y filtros. El listado scrollea abajo y
  // el paginado queda anclado al pie.
  const header = (
    <>
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MdNotificationsActive size={26} className="text-warning-500" />
          <h4 className="font-semibold text-3xl text-shadow-2xs text-shadow-primary">
            Recordatorios de service
          </h4>
          {total > 0 && (
            <Chip color="warning" variant="flat" className="text-warning">
              {total}
            </Chip>
          )}
        </div>
        <div className="flex gap-2">
          <Tooltip content="Intervalos de service" color="primary" showArrow>
            <Button
              isIconOnly
              variant="flat"
              onPress={() => setShowSettings((v) => !v)}
              aria-label="Configurar intervalos"
            >
              <MdSettings size={18} />
            </Button>
          </Tooltip>
          <Button
            isLoading={loading}
            startContent={!loading ? <HiOutlineRefresh size={18} /> : undefined}
            color="primary"
            className="font-bold"
            onPress={fetchReminders}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* Configuración de intervalos */}
      {showSettings && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg border border-divider">
          <Input
            label="Cada (meses)"
            size="sm"
            className="max-w-[130px]"
            inputMode="numeric"
            value={String(settingsDraft.intervalMonths)}
            onChange={(e) =>
              setSettingsDraft((d) => ({
                ...d,
                intervalMonths: Number(e.target.value.replace(/\D/g, "")) || 0,
              }))
            }
          />
          <Input
            label="Cada (km)"
            size="sm"
            className="max-w-[140px]"
            inputMode="numeric"
            value={String(settingsDraft.intervalKm)}
            onChange={(e) =>
              setSettingsDraft((d) => ({
                ...d,
                intervalKm: Number(e.target.value.replace(/\D/g, "")) || 0,
              }))
            }
          />
          <Input
            label="Avisar (días antes)"
            size="sm"
            className="max-w-[150px]"
            inputMode="numeric"
            value={String(settingsDraft.soonDays)}
            onChange={(e) =>
              setSettingsDraft((d) => ({
                ...d,
                soonDays: Number(e.target.value.replace(/\D/g, "")) || 0,
              }))
            }
          />
          <Input
            label="Avisar (km antes)"
            size="sm"
            className="max-w-[150px]"
            inputMode="numeric"
            value={String(settingsDraft.soonKm)}
            onChange={(e) =>
              setSettingsDraft((d) => ({
                ...d,
                soonKm: Number(e.target.value.replace(/\D/g, "")) || 0,
              }))
            }
          />
          <Button color="primary" size="sm" onPress={handleSaveSettings}>
            Guardar
          </Button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Select
          label="Mostrar"
          size="sm"
          className="max-w-[220px]"
          selectedKeys={[scope]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as ReminderScope | undefined;
            if (value) {
              setScope(value);
              setPage(1);
            }
          }}
        >
          {SCOPE_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Select
          label="Aviso al cliente"
          size="sm"
          className="max-w-[200px]"
          selectedKeys={[contacted]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as ContactedFilter | undefined;
            if (value) {
              setContacted(value);
              setPage(1);
            }
          }}
        >
          {CONTACTED_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        {/* No hay filtro por tipo de service: hoy el taller trabaja con un único
            circuito (service general), así que sería un filtro con una sola
            opción real. El endpoint mantiene el parámetro para cuando los tipos
            se usen de verdad. */}
        <Input
          label="Buscar"
          size="sm"
          className="max-w-[240px]"
          placeholder="Patente o titular"
          startContent={<IoSearch className="text-foreground-400" />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
    </>
  );

  return (
    <PageShell
      header={header}
      footer={
        <TablePagination
          page={effectivePage}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      }
    >
      {/* Listado */}
      {loading && !loaded ? (
        <div className="py-16">
          <TableLoadingContent />
        </div>
      ) : evaluated.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<IoSearch size={28} />}
            title="Sin resultados"
            description="No hay recordatorios que coincidan con los filtros aplicados."
          />
        ) : scope === "due" ? (
          <EmptyState
            icon={<MdCheckCircle size={30} />}
            title="Todo al día"
            description="Ningún vehículo requiere service por ahora."
          />
        ) : (
          <EmptyState
            icon={<IoCarSportSharp size={28} />}
            title="Sin recordatorios"
            description="Los recordatorios se generan al registrar vehículos y al completar services."
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {evaluated.map(({ reminder, evaluation, badge }) => (
            <div
              key={reminder.id}
              className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-content2 border border-divider"
            >
              <LicenceTable licence={reminder.car.licensePlate} dialog />

              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">
                    {reminder.car.brand} {reminder.car.model}
                  </p>
                  <Chip size="sm" color={badge.color} variant="flat">
                    {badge.label}
                  </Chip>
                </div>
                <p className="text-foreground-400 text-xs mt-0.5">
                  {formatDueSummary(evaluation)}
                  {reminder.dueDate &&
                    ` · vence ${formatDate(reminder.dueDate)}`}
                  {reminder.dueKm !== null &&
                    ` · a los ${reminder.dueKm.toLocaleString("es-AR")} km`}
                </p>
                {/* El plazo del postergado se muestra explícito: si no, el único
                    rastro de haberlo pospuesto era el chip. */}
                {evaluation.urgency === "snoozed" && reminder.snoozedUntil && (
                  <p className="text-primary-500 text-xs flex items-center gap-1">
                    <MdSchedule size={12} />
                    Postergado hasta {formatDate(reminder.snoozedUntil)}
                  </p>
                )}
                <p className="text-foreground-400 text-xs">
                  {reminder.owner.fullname}
                  {reminder.owner.phone && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <MdPhone size={12} /> {reminder.owner.phone}
                    </span>
                  )}
                  {reminder.contactedAt && (
                    <span className="text-success-400 ml-2">
                      · avisado {formatDate(reminder.contactedAt)}
                    </span>
                  )}
                </p>
              </div>

              <ReminderActions
                reminder={reminder}
                evaluation={evaluation}
                isBusy={actioningId === reminder.id}
                onRun={(action) => runAction(reminder.id, action)}
                onWhatsapp={() => handleWhatsapp(reminder)}
                onAddJob={() =>
                  navigate("/cars/add-job", {
                    state: { license: reminder.car.licensePlate },
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default ServiceAlertsPage;
