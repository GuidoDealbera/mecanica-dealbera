import React from "react";
import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { IoCarSportSharp } from "react-icons/io5";
import { MdPostAdd, MdWarning, MdPeople, MdBuild, MdBarChart, MdPieChart } from "react-icons/md";
import { FaSackDollar } from "react-icons/fa6";
import { HiOutlineRefresh } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { DashboardStats } from "../Types/types";
import LicenceTable from "../Components/Licenses/LicenceTable";
import { formatARS } from "../Utils/utils";
import { useToasts } from "../Hooks/useToasts";

const StatCard: React.FC<{
  label: string;
  value: number | string;
  sub?: string;
  color?: "primary" | "success" | "warning" | "danger" | "default";
  icon: React.ReactNode;
}> = ({ label, value, sub, color = "primary", icon }) => (
  <Card className="bg-foreground-700 shadow shadow-primary">
    <CardBody className="flex flex-row items-center gap-4 p-4">
      <div
        className={`p-3 rounded-full text-${color}-400 flex-shrink-0`}
      >
        {icon}
      </div>
      <div>
        <p className="text-foreground-400 text-sm">{label}</p>
        <p className={`text-3xl font-bold text-${color}-400`}>{value}</p>
        {sub && <p className="text-foreground-400 text-xs mt-1">{sub}</p>}
      </div>
    </CardBody>
  </Card>
);

// Estado vacío para los gráficos: mensaje explicativo centrado, con la misma
// altura que el gráfico para que el layout no salte cuando no hay datos.
const ChartEmpty: React.FC<{ icon: React.ReactNode; message: string }> = ({
  icon,
  message,
}) => (
  <div
    className="flex flex-col items-center justify-center gap-2 text-foreground-500"
    style={{ height: 200 }}
  >
    <div className="opacity-40">{icon}</div>
    <p className="text-sm text-center px-4 max-w-xs">{message}</p>
  </div>
);

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToasts();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchStats = React.useCallback(
    async (refresh?: boolean) => {
      setLoading(true);
      try {
        const res = await window.api.dashboard.getStats();
        if (res.status === "success") setStats(res.result);
        if (refresh) {
          showToast(
            "Datos actualizados correctamente",
            "success",
            "Actualizar",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Datos de la torta con el color atado a cada estado (así el color no se
  // corre cuando algún estado está ausente). Se descartan los estados en 0.
  const jobStatusData = stats
    ? [
        { name: "Sin comenzar", value: stats.pendingJobs, color: "#6b7280" },
        { name: "En progreso", value: stats.jobsInProgress, color: "#3b82f6" },
        { name: "Completados", value: stats.completedJobs, color: "#22c55e" },
        { name: "Entregados", value: stats.deliveredJobs, color: "#a855f7" },
      ].filter((d) => d.value > 0)
    : [];
  const hasJobStatus = jobStatusData.length > 0;
  const hasRevenue = stats?.monthlyRevenue?.some((m) => m.revenue > 0) ?? false;

  return (
    <div className="w-full min-h-full bg-foreground-800 rounded-md p-5 text-white flex flex-col gap-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <h1 className="font-michroma text-4xl md:text-5xl italic text-primary-500 font-bold">
          MECÁNICA DEALBERA
        </h1>
        <Button
          color="primary"
          isLoading={loading}
          onPress={() => fetchStats(true)}
          startContent={!loading ? <HiOutlineRefresh size={20} /> : undefined}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" color="primary" />
        </div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Vehículos registrados"
              value={stats.totalCars}
              sub={`+${stats.newCarsThisMonth} este mes`}
              color="primary"
              icon={<IoCarSportSharp size={22} />}
            />
            <StatCard
              label="Clientes activos"
              value={stats.activeClients}
              sub={`+${stats.newClientsThisMonth} este mes`}
              color="success"
              icon={<MdPeople size={22} />}
            />
            <StatCard
              label="Trabajos en curso"
              value={stats.jobsInProgress}
              sub={`${stats.completedThisMonth} trabajos completados este mes`}
              color="warning"
              icon={<MdBuild size={22} />}
            />
            <StatCard
              label="Ingresos del mes"
              value={formatARS(stats.revenueThisMonth)}
              sub={`${stats.deliveredThisMonth} trabajos entregados este mes`}
              color="success"
              icon={<FaSackDollar size={22} />}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar chart: ingresos últimos 6 meses */}
            <Card className="lg:col-span-2 bg-foreground-700 shadow shadow-primary">
              <CardBody className="p-4">
                <p className="text-primary-400 text-base font-semibold mb-3 flex items-center gap-2">
                  <MdBarChart size={20} /> Ingresos últimos 6 meses
                </p>
                {hasRevenue ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.monthlyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        formatter={(v) => [formatARS(Number(v ?? 0)), "Ingresos"]}
                        contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                        labelStyle={{ color: "#e5e7eb" }}
                        itemStyle={{ color: "#60a5fa" }}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    icon={<FaSackDollar size={32} />}
                    message="Todavía no hay ingresos registrados en los últimos 6 meses. Aparecerán acá al completar o entregar trabajos."
                  />
                )}
              </CardBody>
            </Card>

            {/* Pie chart: distribución de estados de trabajos */}
            <Card className="bg-foreground-700 shadow shadow-primary">
              <CardBody className="p-4">
                <p className="text-primary-400 text-base font-semibold mb-3 flex items-center gap-2">
                  <MdPieChart size={20} /> Trabajos por estado
                </p>
                {hasJobStatus ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={jobStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {jobStatusData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                      />
                      <RechartsTooltip
                        contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                        labelStyle={{ color: "#e5e7eb" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    icon={<MdBuild size={32} />}
                    message="Aún no hay trabajos cargados para mostrar su distribución por estado."
                  />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Alerts */}
          {stats.carsWithAlerts > 0 && (
            <Card className="bg-warning-900/30 border border-warning-700 shadow shadow-warning-800">
              <CardBody className="flex flex-row items-center gap-3 p-4">
                <MdWarning
                  size={24}
                  className="text-warning-400 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-warning-300 font-semibold">
                    {stats.carsWithAlerts} vehículo
                    {stats.carsWithAlerts > 1 ? "s" : ""} sin service en los
                    últimos 6 meses
                  </p>
                  <p className="text-warning-400 text-sm">
                    Revisalos en la sección de Autos
                  </p>
                </div>
                <Button
                  size="sm"
                  color="warning"
                  onPress={() => navigate("/cars")}
                >
                  Ver autos
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Active Jobs */}
          {stats.recentActiveJobs.length > 0 && (
            <div>
              <h5 className="text-lg font-semibold text-primary-400 mb-3">
                Trabajos en curso
              </h5>
              <div className="flex flex-col gap-2">
                {stats.recentActiveJobs.map((job, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-foreground-700 rounded-lg cursor-pointer hover:bg-foreground-600 transition-colors border border-transparent hover:border-foreground-500"
                    onClick={() => navigate(`/cars/${job.licensePlate}`)}
                  >
                    <LicenceTable licence={job.licensePlate} dialog />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {job.description}
                      </p>
                      <p className="text-foreground-400 text-xs">
                        {job.brand} {job.model}
                      </p>
                    </div>
                    <Chip color="primary" variant="flat" className="text-white">{formatARS(job.price)}</Chip>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-3 mt-auto pt-4 border-t border-foreground-700">
            <Button
              onPress={() => navigate("/cars/new")}
              startContent={<IoCarSportSharp />}
              color="primary"
              className="text-base"
            >
              Ingresar Vehículo
            </Button>
            <Button
              onPress={() => navigate("/cars/add-job")}
              startContent={<MdPostAdd />}
              color="primary"
              variant="bordered"
              className="text-base"
            >
              Nuevo Trabajo
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            onPress={() => navigate("/cars/new")}
            startContent={<IoCarSportSharp />}
            color="primary"
            className="text-lg"
          >
            Ingresar Vehículo
          </Button>
          <Button
            onPress={() => navigate("/cars/add-job")}
            startContent={<MdPostAdd />}
            color="primary"
            variant="bordered"
            className="text-lg"
          >
            Nuevo Trabajo
          </Button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
