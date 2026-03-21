import { Button, Spinner, Tab, Tabs } from "@heroui/react";
import React, { useEffect, useState } from "react";
import { useCarQueries } from "../Hooks/useCarQueries";
import { useParams } from "react-router-dom";
import DetailCar from "./Components/DetailCar";
import Jobs from "./Components/Jobs";
import { HiOutlineRefresh } from "react-icons/hi";
import { MdHistory } from "react-icons/md";
import LicenceTable from "../Components/Licenses/LicenceTable";
import KmHistoryModal from "./Components/KmHistoryModal";

const CarDetailPage: React.FC = () => {
  const { licence } = useParams();
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [kmHistoryOpen, setKmHistoryOpen] = useState(false);
  const { car, getCarDetail, loading, refreshing, refreshCar } =
    useCarQueries();
  const isLoading = loading || refreshing;

  useEffect(() => {
    if (licence) {
      getCarDetail(licence);
    }
  }, [getCarDetail, licence]);

  if (isLoading && !car) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!car || !licence) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <p className="text-danger text-xl font-semibold">
          Vehículo no encontrado
        </p>
      </div>
    );
  }

  const tabs = [
    {
      key: "jobs",
      label: "Trabajos",
      content: <Jobs jobs={car.jobs} isLoading={isLoading} license={licence} />,
    },
    {
      key: "car",
      label: "Información",
      content: (
        <DetailCar
          car={car}
          onRefresh={getCarDetail}
          isLoading={loading}
          isEditing={isEditing}
          onEdit={() => setIsEditing(!isEditing)}
        />
      ),
    },
  ];

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h4 className="text-white font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Detalle del vehículo
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            color="default"
            isDisabled={isEditing}
            isLoading={isLoading}
            startContent={!isLoading ? <MdHistory size={20} /> : undefined}
            onPress={() => setKmHistoryOpen(true)}
          >
            Historial KM
          </Button>
          <Button
            isLoading={loading}
            startContent={
              !isLoading ? <HiOutlineRefresh size={20} /> : undefined
            }
            color="primary"
            className="font-bold"
            isDisabled={isEditing}
            onPress={() => licence && refreshCar(licence)}
          >
            {loading && !refreshing
              ? "Cargando..."
              : refreshing
                ? "Actualizando"
                : "Actualizar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <LicenceTable licence={licence} dialog />
        <Tabs
          color="primary"
          size="lg"
          classNames={{ tabList: "bg-foreground-700" }}
          isDisabled={isEditing}
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} title={tab.label}>
              {tab.content}
            </Tab>
          ))}
        </Tabs>
      </div>

      <KmHistoryModal
        isOpen={kmHistoryOpen}
        onClose={() => setKmHistoryOpen(false)}
        kmHistory={car.kmHistory ?? []}
        currentKm={car.kilometers}
        licensePlate={licence}
      />
    </div>
  );
};

export default CarDetailPage;
