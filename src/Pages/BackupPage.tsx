import React from "react";
import { Button } from "@heroui/react";
import {
  MdBackup,
  MdUploadFile,
  MdInfo,
  MdTableChart,
  MdFolderOpen,
  MdSchedule,
  MdBugReport,
  MdWarningAmber,
} from "react-icons/md";
import DataCard from "../Components/DataCard";
import PageShell from "../Components/PageShell";
import { useToasts } from "../Hooks/useToasts";

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

const BackupPage: React.FC = () => {
  const { showToast } = useToasts();
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [exportingCsv, setExportingCsv] = React.useState(false);
  const [autoBackups, setAutoBackups] = React.useState<string[]>([]);

  React.useEffect(() => {
    window.api.backup
      .list()
      .then((res) => {
        if (res.status === "success") setAutoBackups(res.result);
      })
      // La lista de respaldos es informativa: si falla se deja vacía, pero el
      // rechazo se atiende (si no, queda una promesa rechazada sin manejar).
      .catch(() => setAutoBackups([]));
  }, []);

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
              Los respaldos automáticos diarios se guardan en la carpeta de la
              aplicación y se conservan por 7 días.
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
          description="La aplicación genera un respaldo diario automático al iniciar. Se conservan los últimos 7 en la carpeta de Documentos."
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
            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
              {autoBackups.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 text-xs text-foreground-500 bg-content1 rounded px-2 py-1"
                >
                  <MdBackup
                    size={12}
                    className="text-secondary flex-shrink-0"
                  />
                  <span className="truncate">{name}</span>
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
      </div>
    </PageShell>
  );
};

export default BackupPage;
