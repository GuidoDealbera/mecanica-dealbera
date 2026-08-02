import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../Store/store";
import {
  selectCarsList,
  selectCarsListLoaded,
  selectCar,
  selectCarLoaded,
  selectCarLoadingStates,
  selectCarError,
} from "../Store/selectors";
import {
  createCar as createCarThunk,
  fetchCarByLicence as fetchCarByLicenceThunk,
  fetchCars as fetchCarsThunk,
  deleteCar as deleteCarThunk,
  updateJobInCar as updateJobInCarThunk,
  updatedCar as updatedCarThunk,
  addJob as addJobThunk,
} from "../Store/carAsync.methods";
import { cleanCarsState, cleanCarState, cleanError } from "../Store/carSlice";
import {
  CarQueryParams,
  CreateCarBody,
  CreateCarJob,
  UpdateJobBody,
} from "../Types/apiTypes";

/**
 * Hook de datos "puro" del slice de autos: expone el estado del store y
 * acciones que despachan los thunks y devuelven la promesa **desenvuelta**
 * (`.unwrap()`), es decir, resuelven con el resultado o rechazan con el error.
 *
 * No tiene nada de UI (ni toasts, ni navegación, ni loading local): de eso se
 * encarga la capa de presentación (`useCarQueries`). Las callbacks son estables
 * (dependen solo de `dispatch`), así se pueden usar en `useEffect` sin loops.
 */
export const useCarStore = () => {
  const dispatch = useDispatch<AppDispatch>();

  const list = useSelector(selectCarsList);
  const listLoaded = useSelector(selectCarsListLoaded);
  const car = useSelector(selectCar);
  const carLoaded = useSelector(selectCarLoaded);
  const error = useSelector(selectCarError);
  const loadingStates = useSelector(selectCarLoadingStates);

  const fetchList = useCallback(
    (params: CarQueryParams) => dispatch(fetchCarsThunk(params)).unwrap(),
    [dispatch],
  );

  const fetchByLicence = useCallback(
    (licence: string) => dispatch(fetchCarByLicenceThunk(licence)).unwrap(),
    [dispatch],
  );

  const create = useCallback(
    (body: CreateCarBody) => dispatch(createCarThunk(body)).unwrap(),
    [dispatch],
  );

  const remove = useCallback(
    (licence: string) => dispatch(deleteCarThunk(licence)).unwrap(),
    [dispatch],
  );

  const update = useCallback(
    (carId: string, kilometers: number) =>
      dispatch(updatedCarThunk({ carId, kilometers })).unwrap(),
    [dispatch],
  );

  const addJob = useCallback(
    (licence: string, job: CreateCarJob) =>
      dispatch(addJobThunk({ licence, job })).unwrap(),
    [dispatch],
  );

  const updateJob = useCallback(
    (licence: string, jobId: string, body: UpdateJobBody) =>
      dispatch(updateJobInCarThunk({ licence, jobId, body })).unwrap(),
    [dispatch],
  );

  const cleanCar = useCallback(() => {
    dispatch(cleanCarState());
  }, [dispatch]);

  const cleanCars = useCallback(() => {
    dispatch(cleanCarsState());
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(cleanError());
  }, [dispatch]);

  return {
    // Estado
    list,
    listLoaded,
    car,
    carLoaded,
    error,
    loadingStates,
    // Acciones (devuelven la promesa desenvuelta)
    fetchList,
    fetchByLicence,
    create,
    remove,
    update,
    addJob,
    updateJob,
    // Limpieza de estado
    cleanCar,
    cleanCars,
    clearError,
  };
};
