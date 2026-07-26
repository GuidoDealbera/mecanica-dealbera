import React from "react";
import { useLocation } from "react-router-dom";
import { Input, Pagination } from "@heroui/react";
import { IoSearch } from "react-icons/io5";
import AddJobForm from "../Components/Forms/AddJobForm";
import { useCarQueries } from "../Hooks/useCarQueries";
import { useDebounce } from "../Hooks/useDebounce";
import CarsList from "./Components/CarsList";
import { CarQueryParams, CreateCarJob } from "../Types/apiTypes";

const PICKER_PAGE_SIZE = 12;

const AddJobPage: React.FC = () => {
  const { state } = useLocation();
  const { list, loading, addCarJob, getCars, cleanCars } = useCarQueries();
  const [selectedLicense, setSelectedLicense] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debouncedSearch = useDebounce(search, 250);

  const params = React.useMemo<CarQueryParams>(
    () => ({
      page,
      pageSize: PICKER_PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
    }),
    [page, debouncedSearch],
  );

  React.useEffect(() => {
    getCars(params);
  }, [getCars, params]);

  React.useEffect(() => {
    return () => cleanCars();
  }, [cleanCars]);

  React.useEffect(() => {
    if (state?.license) {
      setSelectedLicense(state.license);
    }
  }, [state]);

  const handleSubmit = async (data: CreateCarJob) => {
    return await addCarJob(selectedLicense, data);
  };

  const pages = Math.max(1, Math.ceil(list.total / PICKER_PAGE_SIZE));

  return (
    <div className="text-white shadow shadow-primary bg-foreground-800 rounded-md p-3 min-h-full">
      <h4 className="mb-1 font-semibold text-4xl text-shadow-2xs text-shadow-primary">
        Registrar nuevo trabajo
      </h4>
      <h5 className="mt-4 mb-2 font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
        Seleccione un automóvil
      </h5>

      <Input
        className="max-w-xs"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.toUpperCase());
          setPage(1);
        }}
        placeholder="Buscar por patente..."
        startContent={<IoSearch className="text-foreground-400" />}
        isClearable
        onClear={() => {
          setSearch("");
          setPage(1);
        }}
      />

      <CarsList
        cars={list.items}
        selectedLicense={selectedLicense}
        onSelect={setSelectedLicense}
        isLoading={loading}
      />

      {pages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination
            showControls
            showShadow
            page={page}
            total={pages}
            onChange={setPage}
          />
        </div>
      )}

      <AddJobForm license={selectedLicense} onSubmit={handleSubmit} isLoading={loading} />
    </div>
  );
};

export default AddJobPage;
