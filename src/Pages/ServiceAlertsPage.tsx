import React from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { HiOutlineRefresh } from "react-icons/hi";
import { MdWarning, MdPhone } from "react-icons/md";
import { IoCarSportSharp } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { ServiceAlert } from "../Types/types";
import LicenceTable from "../Components/Licenses/LicenceTable";

const ServiceAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = React.useState<ServiceAlert[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchAlerts = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.cars.getServiceAlerts();
      if (res.status === "success") setAlerts(res.result);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const urgency = (days: number | null): "danger" | "warning" | "default" => {
    if (days === null) return "warning";
    if (days > 365) return "danger";
    if (days > 180) return "warning";
    return "default";
  };

  const urgencyLabel = (days: number | null) => {
    if (days === null) return "Sin trabajos";
    if (days > 365) return `${Math.floor(days / 30)} meses`;
    return `${days} días`;
  };

  const columns = [
    { key: "licensePlate", label: "Patente", width: 160 },
    { key: "vehicle", label: "Vehículo", width: 200 },
    { key: "owner", label: "Titular", width: 200 },
    { key: "phone", label: "Teléfono", width: 150 },
    { key: "km", label: "Kilometraje", width: 130 },
    { key: "lastJob", label: "Último trabajo", width: 150 },
    { key: "actions", label: "Acciones", width: 100 },
  ];

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-4 text-white">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <MdWarning size={28} className="text-warning-400" />
          <div>
            <h4 className="font-semibold text-3xl text-shadow-2xs text-shadow-primary">
              Recordatorios de service
            </h4>
            <p className="text-foreground-400 text-sm mt-0.5">
              Vehículos sin actividad en los últimos 6 meses
            </p>
          </div>
        </div>
        <Button
          isLoading={loading}
          startContent={!loading ? <HiOutlineRefresh size={20} /> : undefined}
          color="primary"
          className="font-bold"
          onPress={fetchAlerts}
        >
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" color="primary" />
        </div>
      ) : alerts.length === 0 ? (
        <Card className="bg-success-900/30 border border-success-700">
          <CardBody className="flex flex-row items-center gap-3 p-5">
            <IoCarSportSharp size={24} className="text-success-400" />
            <div>
              <p className="text-success-300 font-semibold text-lg">
                ¡Todo en orden!
              </p>
              <p className="text-success-500 text-sm">
                No hay vehículos sin service en los últimos 6 meses.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="text-foreground-400 text-sm mb-3">
            Se encontraron{" "}
            <strong className="text-warning-400">{alerts.length}</strong>{" "}
            vehículo{alerts.length > 1 ? "s" : ""} que requieren atención.
          </p>
          <div className="bg-white rounded-lg">
            <Table aria-label="Alertas de service">
              <TableHeader>
                {columns.map((col, i) => (
                  <TableColumn
                    key={col.key}
                    className={`bg-warning-600 text-white text-sm font-bold ${
                      i !== columns.length - 1 ? "border-r-2 border-white" : ""
                    }`}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody>
                {alerts.map((alert, i) => (
                  <TableRow
                    key={alert.licensePlate}
                    className={i % 2 === 0 ? "bg-foreground-100" : "bg-foreground-50"}
                  >
                    <TableCell className="border-r-2 border-white">
                      <LicenceTable licence={alert.licensePlate} dialog />
                    </TableCell>
                    <TableCell className="border-r-2 border-white">
                      <div>
                        <p className="font-semibold text-sm">{alert.brand} {alert.model}</p>
                        <p className="text-foreground-500 text-xs">{alert.year}</p>
                      </div>
                    </TableCell>
                    <TableCell className="border-r-2 border-white text-sm">
                      {alert.ownerName}
                    </TableCell>
                    <TableCell className="border-r-2 border-white">
                      <div className="flex items-center gap-1 text-sm">
                        <MdPhone size={14} className="text-foreground-400" />
                        {alert.ownerPhone}
                      </div>
                    </TableCell>
                    <TableCell className="border-r-2 border-white text-sm text-center">
                      {alert.kilometers.toLocaleString("es-AR")} km
                    </TableCell>
                    <TableCell className="border-r-2 border-white text-center">
                      <Chip
                        size="sm"
                        color={urgency(alert.daysSinceLastJob)}
                        variant="flat"
                      >
                        {urgencyLabel(alert.daysSinceLastJob)}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={() => navigate(`/cars/${alert.licensePlate}`)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default ServiceAlertsPage;
