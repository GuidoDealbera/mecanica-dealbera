import React from "react";
import { Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import { MdBackup, MdUploadFile, MdInfo } from "react-icons/md";
import { useToasts } from "../Hooks/useToasts";

const BackupPage: React.FC = () => {
  const { showToast } = useToasts();
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

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
          "Importar base de datos",
        );
      } else {
        showToast(res.message, "danger", "Importar base de datos");
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-4 text-white">
      <h4 className="font-semibold text-4xl text-shadow-2xs text-shadow-primary mb-6">
        Gestión de datos
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {/* Export */}
        <Card className="bg-foreground-700 shadow shadow-primary border border-foreground-600">
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
          <Divider className="my-3 bg-foreground-600" />
          <CardBody className="pt-0 flex flex-col gap-3">
            <p className="text-foreground-300 text-sm text-justify">
              Genera una copia del archivo de base de datos y te permite
              guardarla donde prefieras de forma segura. Es ideal para realizar
              respaldos manuales o para transferir la información a otra
              computadora o entorno sin complicaciones.
            </p>
            <div className="flex items-start gap-2 bg-foreground-800 rounded-lg p-3">
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

        {/* Import */}
        <Card className="bg-foreground-700 shadow shadow-warning border border-warning-800">
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
          <Divider className="my-3 bg-foreground-600" />
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
      </div>
    </div>
  );
};

export default BackupPage;
