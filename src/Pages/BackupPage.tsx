import React from "react";
import { Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import {
  MdBackup,
  MdUploadFile,
  MdInfo,
  MdTableChart,
  MdFolderOpen,
  MdSchedule,
  MdBugReport,
} from "react-icons/md";
import { useToasts } from "../Hooks/useToasts";

const BackupPage: React.FC = () => {
  const { showToast } = useToasts();
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [exportingCsv, setExportingCsv] = React.useState(false);
  const [autoBackups, setAutoBackups] = React.useState<string[]>([]);

  React.useEffect(() => {
    window.api.backup.list().then((res) => {
      if (res.status === "success") setAutoBackups(res.result);
    });
  }, []);

  const handleOpenBackupFolder = () => {
    window.api.backup.openFolder();
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
      if (res.status === "success") {
        showToast(res.message, "success", "Exportar base de datos");
      } else {
        showToast(res.message, "danger", "Exportar base de datos");
      }
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await window.api.backup.import();
      if (res.status === "success") {
        showToast(
          res.message + " Reiniciá la app para ver los cambios.",
          "success",
          "Importar base de datos"
        );
      } else {
        showToast(res.message, "danger", "Importar base de datos");
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto overflow-x-hidden shadow shadow-primary bg-content1 rounded-md p-4 text-foreground">
      <h4 className="font-semibold text-4xl text-shadow-2xs text-shadow-primary mb-6">
        Gestión de datos
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {/* Export */}
        <Card className="bg-content2 shadow shadow-primary border border-divider">
          <CardHeader className="flex items-center gap-3 pb-0">
            <MdBackup size={28} className="text-primary-400" />
            <div>
              <h5 className="font-semibold text-lg text-primary-300">
                Exportar base de datos
              </h5>
              <p className="text-foreground-400 text-xs">
                Guardar una copia de seguridad
              </p>
            </div>
          </CardHeader>
          <Divider className="my-3 bg-content3" />
          <CardBody className="pt-0 flex flex-col gap-3">
            <p className="text-foreground-300 text-sm text-justify">
              Genera una copia del archivo de base de datos y te permite
              guardarla donde prefieras de forma segura. Es ideal para realizar
              respaldos manuales o para transferir la información a otra
              computadora o entorno sin complicaciones.
            </p>
            <div className="flex items-start gap-2 bg-content1 rounded-lg p-3">
              <MdInfo
                size={16}
                className="text-primary-400 flex-shrink-0 mt-0.5"
              />
              <p className="text-foreground-400 text-xs">
                Los backups automáticos diarios se guardan en la carpeta de la
                aplicación y se conservan por 7 días.
              </p>
            </div>
            <Button
              color="primary"
              startContent={<MdBackup size={18} />}
              onPress={handleExport}
              isLoading={exporting}
              fullWidth
            >
              {exporting ? "Exportando..." : "Exportar ahora"}
            </Button>
          </CardBody>
        </Card>

        {/* Export CSV */}
        <Card className="bg-content2 shadow shadow-success border border-success-800">
          <CardHeader className="flex items-center gap-3 pb-0">
            <MdTableChart size={28} className="text-success-400" />
            <div>
              <h5 className="font-semibold text-lg text-success-300">
                Exportar a CSV
              </h5>
              <p className="text-foreground-400 text-xs">
                Compatible con Excel
              </p>
            </div>
          </CardHeader>
          <Divider className="my-3 bg-content3" />
          <CardBody className="pt-0 flex flex-col gap-3">
            <p className="text-foreground-300 text-sm text-justify">
              Genera un archivo CSV con todos los vehículos, sus titulares y un
              resumen de trabajos. El archivo incluye marca BOM para abrirse
              correctamente en Excel con acentos y caracteres especiales.
            </p>
            <div className="flex items-start gap-2 bg-content1 rounded-lg p-3">
              <MdInfo
                size={16}
                className="text-success-400 flex-shrink-0 mt-0.5"
              />
              <p className="text-foreground-400 text-xs">
                Separador ";" — compatible con Excel en configuración regional
                en español.
              </p>
            </div>
            <Button
              color="success"
              startContent={<MdTableChart size={18} />}
              onPress={handleExportCsv}
              isLoading={exportingCsv}
              fullWidth
            >
              {exportingCsv ? "Exportando..." : "Exportar CSV"}
            </Button>
          </CardBody>
        </Card>

        {/* Auto-backups */}
        <Card className="bg-content2 shadow shadow-secondary border border-secondary-800">
          <CardHeader className="flex items-center gap-3 pb-0">
            <MdSchedule size={28} className="text-secondary-400" />
            <div>
              <h5 className="font-semibold text-lg text-secondary-300">
                Respaldos automáticos
              </h5>
              <p className="text-foreground-400 text-xs">
                {autoBackups.length > 0
                  ? `${autoBackups.length} respaldo${autoBackups.length !== 1 ? "s" : ""} guardado${autoBackups.length !== 1 ? "s" : ""}`
                  : "Sin respaldos aún"}
              </p>
            </div>
          </CardHeader>
          <Divider className="my-3 bg-content3" />
          <CardBody className="pt-0 flex flex-col gap-3">
            <p className="text-foreground-300 text-sm text-justify">
              La aplicación genera un respaldo diario automático al iniciar. Se
              conservan los últimos 7 respaldos en la carpeta de Documentos.
            </p>
            {autoBackups.length > 0 && (
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                {autoBackups.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 text-xs text-foreground-400 bg-content1 rounded px-2 py-1"
                  >
                    <MdBackup
                      size={12}
                      className="text-secondary-400 flex-shrink-0"
                    />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
            <Button
              color="secondary"
              variant="flat"
              startContent={<MdFolderOpen size={18} />}
              onPress={handleOpenBackupFolder}
              fullWidth
            >
              Abrir carpeta
            </Button>
          </CardBody>
        </Card>

        {/* Import */}
        <Card className="bg-content2 shadow shadow-warning border border-warning-800">
          <CardHeader className="flex items-center gap-3 pb-0">
            <MdUploadFile size={28} className="text-warning-400" />
            <div>
              <h5 className="font-semibold text-lg text-warning-300">
                Importar base de datos
              </h5>
              <p className="text-foreground-400 text-xs">
                Restaurar desde un archivo
              </p>
            </div>
          </CardHeader>
          <Divider className="my-3 bg-content3" />
          <CardBody className="pt-0 flex flex-col gap-3">
            <p className="text-foreground-300 text-sm text-justify">
              Reemplaza la base de datos actual usando un archivo externo que
              selecciones. Es útil para restaurar un backup previo o migrar
              datos desde otra instalación o equipo de forma rápida y segura.
            </p>
            <div className="flex items-start gap-2 bg-warning-900/40 border border-warning-800 rounded-lg p-3">
              <MdInfo
                size={16}
                className="text-warning-400 flex-shrink-0 mt-0.5"
              />
              <p className="text-warning-400 text-xs">
                <strong>Atención:</strong> Esta acción reemplazará todos los
                datos actuales. Se creará un backup automático antes de
                continuar.
              </p>
            </div>
            <Button
              color="warning"
              startContent={<MdUploadFile size={18} />}
              onPress={handleImport}
              isLoading={importing}
              fullWidth
            >
              {importing ? "Importando..." : "Importar archivo"}
            </Button>
          </CardBody>
        </Card>

        {/* Logs */}
        <Card className="bg-content2 shadow shadow-foreground-500 border border-divider">
          <CardHeader className="flex items-center gap-3 pb-0">
            <MdBugReport size={28} className="text-foreground-300" />
            <div>
              <h5 className="font-semibold text-lg text-foreground-200">
                Logs de la aplicación
              </h5>
              <p className="text-foreground-400 text-xs">
                Registro de errores y eventos
              </p>
            </div>
          </CardHeader>
          <Divider className="my-3 bg-content3" />
          <CardBody className="pt-0 flex flex-col gap-3">
            <p className="text-foreground-300 text-sm text-justify">
              Abre la carpeta donde se guardan los archivos de log de la
              aplicación. Útil para diagnosticar errores o reportar problemas.
            </p>
            <Button
              color="default"
              variant="flat"
              startContent={<MdFolderOpen size={18} />}
              onPress={() => window.api.global.openLogsFolder()}
              fullWidth
            >
              Ver logs
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default BackupPage;
