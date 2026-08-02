import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { KmRecord } from "../../Types/types";

interface KmHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  kmHistory: KmRecord[];
  currentKm: number;
  licensePlate: string;
}

const KmHistoryModal: React.FC<KmHistoryModalProps> = ({
  isOpen,
  onClose,
  kmHistory,
  currentKm,
  licensePlate,
}) => {
  // Datos en orden cronológico ascendente para el eje X del gráfico.
  const chartData = React.useMemo(
    () =>
      [...(kmHistory ?? [])]
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )
        .map((r) => ({
          date: new Date(r.date).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          }),
          km: r.km,
        })),
    [kmHistory],
  );

  const hasData = chartData.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      placement="center"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="text-xl font-bold">
          Historial de kilometraje — {licensePlate}
        </ModalHeader>
        <ModalBody>
          {!hasData ? (
            <p className="text-center text-foreground-400 py-8">
              Sin registros de kilometraje
            </p>
          ) : (
            <div className="pt-2">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={(v) => Number(v).toLocaleString("es-AR")}
                    width={70}
                    domain={["dataMin", "dataMax"]}
                  />
                  <RechartsTooltip
                    formatter={(v) => [
                      `${Number(v ?? 0).toLocaleString("es-AR")} km`,
                      "Kilometraje",
                    ]}
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#60a5fa" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="km"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#3b82f6" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex justify-between items-center">
          <span className="text-sm text-foreground-400">
            Kilometraje actual:{" "}
            <strong className="text-white">
              {currentKm.toLocaleString("es-AR")} km
            </strong>
            {" · "}
            {chartData.length} registro{chartData.length === 1 ? "" : "s"}
          </span>
          <Button color="primary" onPress={onClose}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default KmHistoryModal;
