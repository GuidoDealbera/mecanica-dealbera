import { Button, Tab, Tabs } from "@heroui/react";
import React, { useEffect } from "react";
import { useCarQueries } from "../Hooks/useCarQueries";
import { useParams } from "react-router-dom";
import DetailCar from "./Components/DetailCar";
import Jobs from "./Components/Jobs";
import { HiOutlineRefresh } from "react-icons/hi";
import LicenceTable from "../Components/Licenses/LicenceTable";
import { MdEdit } from "react-icons/md";

const CarDetailPage: React.FC = () => {
  const { licence } = useParams();
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const { car, getCarDetail, loading, refreshing, refreshCar /*updateJob*/ } =
    useCarQueries();
  const isLoading = loading || refreshing;
  useEffect(() => {
    if (licence) {
      getCarDetail(licence);
    }
  }, [getCarDetail, licence]);

  if (!car || !licence) {
    return <div>Error</div>;
  }
  const tabs = [
    {
      key: "jobs",
      label: "Trabajos",
      content: <Jobs jobs={car.jobs} isLoading={isLoading} />,
    },
    {
      key: "car",
      label: "Información",
      content: (
        <div>
          <div className="w-full flex justify-end items-center">
            <Button
              onPress={() => setIsEditing(!isEditing)}
              color={isEditing ? "danger" : "primary"}
              isLoading={isLoading}
              startContent={
                !isLoading && !isEditing ? <MdEdit size={20} /> : undefined
              }
              isDisabled={isLoading}
            >
              {isEditing ? "Cancelar edición" : "Editar"}
            </Button>
          </div>
          <DetailCar car={car} isLoading={loading} isEditing={isEditing} />
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Detalle del vehículo
        </h4>
        <div className="flex justify-center items-center gap-2">
          <Button
            isLoading={loading}
            startContent={
              !isLoading ? <HiOutlineRefresh size={20} /> : undefined
            }
            color="primary"
            className="font-bold"
            onPress={() => licence && refreshCar(licence)}
          >
            {loading && !refreshing
              ? "Cargando..."
              : refreshing && !loading
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
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} title={tab.label}>
              {tab.content}
            </Tab>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default CarDetailPage;
