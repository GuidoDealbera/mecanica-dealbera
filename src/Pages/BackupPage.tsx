import React from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import {
  MdBackup,
  MdUploadFile,
  MdInfo,
  MdTableChart,
  MdFolderOpen,
  MdSchedule,
  MdBugReport,
  MdWarningAmber,
  MdDescription,
  MdDeleteOutline,
} from "react-icons/md";
import CustomDialog from "../Components/CustomDialog";
import DocumentHistory from "../Components/DocumentHistory";
import DataCard from "../Components/DataCard";
import PageShell from "../Components/PageShell";
import { useToasts } from "../Hooks/useToasts";
import type { BackupEntry } from "../Types/apiTypes";
import type { SequenceCheck } from "../Types/apiTypes";
import type { TrashItem } from "../../electron/DataBase/trash.service";

/** "sábado 6 de septiembre" — más legible que `taller_2026-09-06.db`. */
const formatBackupDate = (iso: string): string => {
  const date = new Date(iso);
  const texto = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Aviso con ícono, el formato que usan todas las tarjetas de la pantalla. */
const Note: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <>
    <span className="flex-shrink-0 mt-0.5">{icon}</span>
    <p className="text-foreground-500 text-xs">{children}</p>
  </>
);

/** Cómo se nombra cada tipo de documento en la revisión del correlativo. */
const TIPO_ETIQUETA: Record<string, string> = {
  budget: "Presupuestos",
  invoice: "Facturas",
};

/** Cómo se nombra cada origen en la lista de respaldos. */
const ORIGEN_ETIQUETA: Record<string, string> = {
  automatico: "automático",
  manual: "manual",
  previo: "previo a actualizar",
};

/**
 * Revisa que la numeración de documentos no tenga huecos.
 *
 * Toda la maquinaria del correlativo —la transacción, el índice único, el
 * descarte cuando algo falla— existe para que no falte ninguno, y no había
 * **forma de comprobarlo**: ni una pantalla, ni un aviso. Un hueco quedaba
 * invisible.
 *
 * Se revisa cuando el usuario lo pide y no en cada render: es una verificación,
 * no un dato de la pantalla.
 */
const RevisionDelCorrelativo: React.FC = () => {
  const [revisando, setRevisando] = React.useState(false);
  const [resultado, setResultado] = React.useState<SequenceCheck[] | null>(
    null
  );
  const { showToast } = useToasts();

  const revisar = async () => {
    setRevisando(true);
    try {
      const res = await window.api.documents.checkSequence();
      if (res.status !== "success") {
        showToast(res.message, "danger", "Numeración");
        return;
      }
      setResultado(res.result);
    } finally {
      setRevisando(false);
    }
  };

  const conHuecos = (resultado ?? []).filter((r) => r.missing.length > 0);

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="flat"
          color="primary"
          isLoading={revisando}
          onPress={revisar}
        >
          Revisar numeración
        </Button>
        {resultado !== null && conHuecos.length === 0 && (
          <span className="text-xs text-success">
            Sin huecos: la numeración está completa.
          </span>
        )}
      </div>

      {conHuecos.map((r) => (
        <p key={r.type} className="text-xs text-warning">
          {TIPO_ETIQUETA[r.type]}: faltan {r.missing.length}
          {r.truncated ? " o más" : ""} de {r.last} —{" "}
          {r.missing.slice(0, 12).join(", ")}
          {r.missing.length > 12 ? "…" : ""}
        </p>
      ))}
    </div>
  );
};

/**
 * La papelera.
 *
 * Borrar un vehículo se llevaba sus trabajos, su historial de kilometraje y su
 * recordatorio; borrar un cliente se llevaba además todos sus vehículos. Era
 * irreversible salvo restaurando un respaldo entero, o sea eligiendo entre
 * perder un dato y perder un día de trabajo.
 */
const Papelera: React.FC = () => {
  const [items, setItems] = React.useState<TrashItem[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [trabajando, setTrabajando] = React.useState<string | null>(null);
  const [aTirar, setATirar] = React.useState<TrashItem | null>(null);
  const { showToast } = useToasts();

  const cargar = React.useCallback(() => {
    setCargando(true);
    window.api.trash
      .list()
      .then((res) => setItems(res.result ?? []))
      .catch(() => setItems([]))
      .finally(() => setCargando(false));
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta al proceso principal
    cargar();
  }, [cargar]);

  const accion = async (
    item: TrashItem,
    fn: () => Promise<{ status: string; message: string }>
  ) => {
    setTrabajando(item.id);
    try {
      const res = await fn();
      showToast(
        res.message,
        res.status === "success" ? "success" : "danger",
        "Papelera"
      );
      if (res.status === "success") cargar();
    } finally {
      setTrabajando(null);
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-foreground-400 text-sm py-2">
        No hay nada borrado. Lo que borres va a aparecer acá.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-content2 border border-divider px-3 py-2"
          >
            <MdDeleteOutline size={16} className="text-danger flex-shrink-0" />
            <span className="font-medium text-sm truncate max-w-[220px]">
              {item.label}
            </span>
            <Chip size="sm" variant="flat">
              {item.kind === "car" ? "Vehículo" : "Cliente"}
            </Chip>
            {/* Qué arrastra: lo que se recupera no es sólo la fila. */}
            <span className="text-xs text-foreground-400">
              {item.kind === "client" && `${item.counts.cars} vehículo(s) · `}
              {item.counts.jobs} trabajo(s)
            </span>
            <span className="text-xs text-foreground-400 ml-auto">
              {formatBackupDate(item.deletedAt)}
            </span>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="h-6 min-w-0 px-2"
              isLoading={trabajando === item.id}
              onPress={() =>
                accion(item, () => window.api.trash.restore(item.id))
              }
            >
              Recuperar
            </Button>
            <Button
              size="sm"
              variant="light"
              color="danger"
              className="h-6 min-w-0 px-2"
              isDisabled={trabajando === item.id}
              onPress={() => setATirar(item)}
            >
              Tirar
            </Button>
          </div>
        ))}
      </div>

      {/* Tirar de la papelera sí es definitivo, así que se pregunta. */}
      <CustomDialog
        isOpen={aTirar !== null}
        onClose={() => setATirar(null)}
        onConfirm={() => {
          const item = aTirar;
          setATirar(null);
          if (item) accion(item, () => window.api.trash.purge(item.id));
        }}
        title="Eliminar definitivamente"
        content={`"${aTirar?.label ?? ""}" se va a borrar para siempre. Esto no se puede deshacer.`}
      />
    </>
  );
};

const BackupPage: React.FC = () => {
  const { showToast } = useToasts();
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [exportingCsv, setExportingCsv] = React.useState(false);
  const [autoBackups, setAutoBackups] = React.useState<BackupEntry[]>([]);
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [toRestore, setToRestore] = React.useState<BackupEntry | null>(null);

  const loadBackups = React.useCallback(() => {
    window.api.backup
      .list()
      .then((res) => {
        if (res.status === "success") setAutoBackups(res.result);
      })
      // La lista de respaldos es informativa: si falla se deja vacía, pero el
      // rechazo se atiende (si no, queda una promesa rechazada sin manejar).
      .catch(() => setAutoBackups([]));
  }, []);

  React.useEffect(() => loadBackups(), [loadBackups]);

  const handleRestore = async () => {
    if (!toRestore) return;
    const name = toRestore.name;
    setToRestore(null);
    setRestoring(name);
    try {
      const res = await window.api.backup.restore(name);
      showToast(
        res.status === "success"
          ? `${res.message} Reiniciá la app para ver los cambios.`
          : res.message,
        res.status === "success" ? "success" : "danger",
        "Restaurar respaldo"
      );
      if (res.status === "success") loadBackups();
    } finally {
      setRestoring(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await window.api.backup.exportCsv();
      if (res.status === "success") {
        showToast(res.message, "success", "Exportar CSV");
      } else if (res.status !== "cancelled") {
        showToast(res.message, "danger", "Exportar CSV");
      }
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await window.api.backup.export();
      showToast(
        res.message,
        res.status === "success" ? "success" : "danger",
        "Exportar base de datos"
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await window.api.backup.import();
      showToast(
        res.status === "success"
          ? res.message + " Reiniciá la app para ver los cambios."
          : res.message,
        res.status === "success" ? "success" : "danger",
        "Importar base de datos"
      );
    } finally {
      setImporting(false);
    }
  };

  const header = (
    <div>
      <h4 className="font-semibold text-4xl text-shadow-2xs text-shadow-primary">
        Gestión de datos
      </h4>
      <p className="text-foreground-400 text-sm mt-1">
        Respaldos, exportaciones y diagnóstico de la aplicación.
      </p>
    </div>
  );

  return (
    <PageShell header={header}>
      {/* Tres columnas en pantallas anchas: con dos, la quinta tarjeta quedaba
          suelta en una fila propia. `items-stretch` + `h-full` en la tarjeta
          igualan las alturas de cada fila. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch pb-2">
        <DataCard
          accent="primary"
          icon={<MdBackup size={24} />}
          title="Exportar base de datos"
          subtitle="Guardar una copia de seguridad"
          description="Genera una copia del archivo de base de datos y te permite guardarla donde prefieras. Sirve para respaldos manuales y para llevar la información a otra computadora."
          note={
            <Note icon={<MdInfo size={16} className="text-primary" />}>
              Los respaldos automáticos se guardan en la carpeta Documentos y se
              conservan por días, semanas y meses.
            </Note>
          }
          action={
            <Button
              color="primary"
              startContent={!exporting ? <MdBackup size={18} /> : undefined}
              onPress={handleExport}
              isLoading={exporting}
              fullWidth
            >
              {exporting ? "Exportando..." : "Exportar ahora"}
            </Button>
          }
        />

        <DataCard
          accent="success"
          icon={<MdTableChart size={24} />}
          title="Exportar a CSV"
          subtitle="Compatible con Excel"
          description="Genera un archivo CSV con todos los vehículos, sus titulares y un resumen de trabajos. Incluye marca BOM para que Excel respete los acentos."
          note={
            <Note icon={<MdInfo size={16} className="text-success" />}>
              Separador ";" — compatible con Excel en configuración regional en
              español.
            </Note>
          }
          action={
            <Button
              color="success"
              startContent={
                !exportingCsv ? <MdTableChart size={18} /> : undefined
              }
              onPress={handleExportCsv}
              isLoading={exportingCsv}
              fullWidth
            >
              {exportingCsv ? "Exportando..." : "Exportar CSV"}
            </Button>
          }
        />

        <DataCard
          accent="secondary"
          icon={<MdSchedule size={24} />}
          title="Respaldos automáticos"
          subtitle={
            autoBackups.length > 0
              ? `${autoBackups.length} respaldo${autoBackups.length !== 1 ? "s" : ""} guardado${autoBackups.length !== 1 ? "s" : ""}`
              : "Sin respaldos aún"
          }
          description="La aplicación genera un respaldo diario automático al iniciar, verificado antes de guardarlo. Se conservan los de los últimos días, semanas y meses."
          action={
            <Button
              color="secondary"
              variant="flat"
              startContent={<MdFolderOpen size={18} />}
              onPress={() => window.api.backup.openFolder()}
              fullWidth
            >
              Abrir carpeta
            </Button>
          }
        >
          {autoBackups.length > 0 && (
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
              {autoBackups.map((backup) => (
                <div
                  key={backup.name}
                  className="flex items-center gap-2 text-xs text-foreground-500 bg-content1 rounded px-2 py-1"
                >
                  <MdBackup
                    size={12}
                    className="text-secondary flex-shrink-0"
                  />
                  <span className="truncate flex-1">
                    {formatBackupDate(backup.date)}
                  </span>
                  {/* De dónde salió. Los tres no significan lo mismo: el
                      automático se va rotando solo, el manual lo guardó el
                      usuario y el previo lo dejó una actualización. */}
                  <span className="flex-shrink-0 text-foreground-400">
                    {ORIGEN_ETIQUETA[backup.origin]}
                  </span>
                  <span className="flex-shrink-0 tabular-nums text-foreground-400">
                    {backup.sizeKb} KB
                  </span>
                  <Button
                    size="sm"
                    variant="light"
                    color="secondary"
                    className="h-6 min-w-0 px-2"
                    isLoading={restoring === backup.name}
                    onPress={() => setToRestore(backup)}
                  >
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard
          accent="warning"
          icon={<MdUploadFile size={24} />}
          title="Importar base de datos"
          subtitle="Restaurar desde un archivo"
          description="Reemplaza la base de datos actual con un archivo que elijas. Sirve para restaurar un respaldo o migrar los datos desde otro equipo."
          note={
            <Note icon={<MdWarningAmber size={16} className="text-warning" />}>
              <strong className="text-warning">Atención:</strong> reemplaza
              todos los datos actuales. Se crea un respaldo automático antes de
              continuar.
            </Note>
          }
          action={
            <Button
              color="warning"
              startContent={!importing ? <MdUploadFile size={18} /> : undefined}
              onPress={handleImport}
              isLoading={importing}
              fullWidth
            >
              {importing ? "Importando..." : "Importar archivo"}
            </Button>
          }
        />

        <DataCard
          accent="default"
          icon={<MdBugReport size={24} />}
          title="Logs de la aplicación"
          subtitle="Registro de errores y eventos"
          description="Abre la carpeta donde se guardan los archivos de log. Útil para diagnosticar un error o para reportar un problema."
          action={
            <Button
              variant="flat"
              startContent={<MdFolderOpen size={18} />}
              onPress={() => window.api.global.openLogsFolder()}
              fullWidth
            >
              Ver logs
            </Button>
          }
        />

        <DataCard
          accent="warning"
          icon={<MdDeleteOutline size={24} />}
          title="Papelera"
          subtitle="Vehículos y clientes borrados"
          description="Lo que se borra queda acá con sus trabajos y su historial, y se puede recuperar. Se conservan los últimos 50."
          note={
            <Note icon={<MdInfo size={16} className="text-warning" />}>
              Recuperar un vehículo lo devuelve con todo lo que tenía. Tirarlo
              de la papelera sí es definitivo.
            </Note>
          }
        >
          <Papelera />
        </DataCard>

        <DataCard
          accent="primary"
          icon={<MdDescription size={24} />}
          title="Documentos emitidos"
          subtitle="Presupuestos y facturas"
          description="Últimos documentos emitidos con su número correlativo, vehículo, titular y total. Sirve para ubicar un número cuando el cliente lo menciona por teléfono."
          note={
            <Note icon={<MdInfo size={16} className="text-primary" />}>
              De cada documento se guarda lo que se imprimió, así que se puede
              volver a generar el PDF con el botón de cada fila.
            </Note>
          }
        >
          <RevisionDelCorrelativo />
          <DocumentHistory filters={{ pageSize: 15 }} showPlate searchable />
        </DataCard>
      </div>

      <CustomDialog
        isOpen={toRestore !== null}
        onClose={() => setToRestore(null)}
        onConfirm={handleRestore}
        title="Restaurar respaldo"
        content={
          toRestore
            ? `Se van a reemplazar todos los datos actuales por los del respaldo del ${formatBackupDate(
                toRestore.date
              ).toLowerCase()}. Todo lo cargado después de esa fecha se pierde.\n\nAntes de reemplazar se guarda una copia de la base actual, así que la operación se puede deshacer.`
            : ""
        }
        confirmText="Restaurar"
        isLoading={restoring !== null}
      />
    </PageShell>
  );
};

export default BackupPage;
