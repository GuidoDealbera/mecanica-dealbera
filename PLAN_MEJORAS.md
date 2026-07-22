# Plan de Mejoras — Mecánica Dealbera

Estado de las 33 tareas del plan de mejoras. Un sprint por sesión de trabajo, un commit por tarea.
Este archivo se actualiza a medida que se avanza para poder retomar en cualquier sesión futura.

Estados posibles: `pendiente` · `en progreso` · `a testear` · `hecho`

---

## Sprint 0 — Fixes urgentes

1. **[hecho]** Try-catch en `JSON.parse` de migración `AddPartsToExistingJobs`
   - Archivo: `electron/DataBase/Migrations/AddPartsToExistingJobs1700000002000.ts`
   - Cambios: try-catch en `up` y `down` alrededor del `JSON.parse(car.jobs)`; si falla, loguea `carId` + error con `electron-log` y hace `continue` (no aborta la migración completa).
2. **[hecho]** `car:reassign-owner` sin transacción QueryRunner
   - Archivo: `electron/DataBase/Endpoints/car.endpoints.ts:322`
   - Cambios: handler reescrito con QueryRunner (connect/startTransaction/commit/rollback/release) siguiendo el patrón de `car:delete` y `car:create`. Toda validación de fallo hace rollback antes de retornar; catch general loguea y hace rollback.
3. **[hecho]** `client:update` busca por `fullname` en lugar de `id`
   - Archivo: `electron/DataBase/Endpoints/client.endpoints.ts:118`
   - Cambios: nuevo `UpdateClientDto` (id requerido) en `client.dto.ts`; endpoint busca por `id` y permite renombrar con chequeo de duplicado. Nuevo tipo frontend `UpdateClientBody` (`apiTypes.ts`) propagado por `client.service.ts`, `clientAsync.methods.ts`, `useClientQueries.ts`, `global.d.ts` y `preload.ts`. Call sites: `ClientDetailPage` (guard + `id`) y `CarDetailPage` (`id` del owner cargado). Desbloquea renombrar clientes a nivel API.
4. **[hecho]** Sin debounce en barras de búsqueda
   - Archivos: `src/Components/SearchBars/FilterLicence.tsx`, `FilterName.tsx`, `GlobalSearch.tsx`
   - Cambios: nuevo hook `useDebounce<T>(value, delay)` en `src/Hooks/`. FilterLicence/FilterName mantienen input+validación inmediatos y debouncean `onFilterChange` (250ms, skip primer render). Callbacks de CarsPage/ClientPage envueltos en `useCallback`. GlobalSearch migrado del debounce inline (`debounceRef`) al hook compartido (280ms).

## Sprint 1 — Fundaciones de calidad

5. **[hecho]** Setup Vitest + tests de utilidades (formatDate, formatARS, alertas de service)
   - Archivos: `vitest.config.ts` (nuevo), `src/Utils/serviceAlerts.ts` (nuevo), `src/Utils/utils.test.ts` (nuevo), `src/Utils/serviceAlerts.test.ts` (nuevo), `src/Pages/ServiceAlertsPage.tsx` (refactor), `package.json` (scripts `test`/`test:watch`).
   - Cambios: instalado `vitest` (dev). Config aislada en `vitest.config.ts` (entorno `node`, sin plugin de Electron). Lógica de urgencia de alertas extraída de `ServiceAlertsPage` a `serviceAlerts.ts` (`getServiceUrgency`, `formatServiceUrgencyLabel`) para poder testearla pura. 36 tests: utilidades (`formatLicence`, `capitalizeWords`, `formatDate`, `formatThousands`, `parseNumber`, `formatARS`, `formatNumbers`, `normalizeText`, `toCsv`) + alertas de service. Correr con `npm test`.
6. **[hecho]** Índices DB
   - Archivos: `electron/DataBase/Migrations/AddOwnerIndex1700000003000.ts` (nuevo), `electron/DataBase/Entities/car.entity.ts`, `electron/DataBase/dataSource.ts`.
   - Cambios: **ajuste de alcance respecto al plan original.** `licensePlate`, `fullname` y `phone` ya tienen índice automático por su restricción `UNIQUE` (verificado: `sqlite_autoindex_car_*`), y las búsquedas con `LIKE '%x%'` no pueden usar índice por el comodín inicial → agregarles `@Index()` sería redundante. El índice que sí faltaba es sobre la FK `ownerId` de `car` (TypeORM no indexa ManyToOne por defecto), usada en listados de autos por dueño, joins con `owner` y reasignación/borrado de clientes. Se crea `IDX_car_owner` vía migración (`migrationsRun: true`), se declara `@Index("IDX_car_owner")` en la entidad para mantener esquema/entidad en sincronía, y se registra la migración en `dataSource.ts`. Migración ejecutada y verificada en la DB de desarrollo.
7. **[hecho]** Logs estructurados (electron-log con objetos)
   - Archivos: `electron/logger.ts` (nuevo), `electron/main.ts`, `electron/DataBase/dataSource.ts`, `electron/DataBase/Endpoints/{car,client,backup}.endpoints.ts`, `electron/DataBase/Migrations/AddPartsToExistingJobs1700000002000.ts`.
   - Cambios: nuevo helper central `logger.ts` con `logError(scope, error, context?)`, `logInfo(scope, message?, context?)` y `logWarn(...)`. `logError` serializa el error a `{ name, message, stack }` (antes se perdía el stack al concatenarlo en string) y emite un único objeto `{ scope, ...context, error }` por entrada. Migrados todos los call sites (14) de `log.error/info("texto:", x)` a llamadas estructuradas con `scope` por operación (ej. `car:create`, `db:init`, `backup:import`). `main.ts` conserva `import log` solo para `initialize()`/`transports`. `electron-log/main` es singleton, así que la config de `main.ts` aplica también al helper.
8. **[hecho]** Wrapper global de errores para `ipcMain.handle`
   - Archivos: `electron/ipc.ts` (nuevo), `electron/main.ts`, `electron/DataBase/Endpoints/{car,client,backup,dashboard}.endpoints.ts`.
   - Cambios: nuevo helper `handleIpc(channel, handler)` que envuelve `ipcMain.handle` con try/catch: ante error no controlado loguea estructurado (`logError` con el canal como `scope`) y **re-lanza** para que el renderer lo reciba como promesa rechazada (contrato ya manejado por los thunks con `rejectWithValue`). Es genérico (`<Args, R>`) para preservar los tipos de argumentos de cada handler sin casts en los call sites. Migrados los 26 handlers `ipcMain.handle` → `handleIpc`. Los handlers con try/catch propio (transacciones) siguen devolviendo su `{status:'failed'}` específico y no llegan al catch del wrapper (sin doble log). `main.ts` conserva `ipcMain` solo para los `.on(...)` de auto-update.

## Sprint 2 — Arquitectura de API

9. **[hecho]** Activar validación de DTOs (class-validator ya decorado, falta ejecutar)
   - Archivos: `electron/validation.ts` (nuevo), `electron/DataBase/Endpoints/car.endpoints.ts` (`car:create`), `electron/DataBase/Endpoints/client.endpoints.ts` (`client:create`, `client:update`).
   - Cambios: nuevo helper `validateDto(cls, plain)` que hace `plainToInstance` + `validate` (class-validator) y devuelve `{ ok, dto }` o `{ ok:false, message, errors }` con los mensajes aplanados (incluye anidados de `@ValidateNested`, ej. el `owner`). `whitelist: true` descarta props no decoradas (anti asignación masiva). Aplicado a `car:create`, `client:create` y `client:update` al inicio del handler (antes de abrir transacción); ante error devuelve `{status:'failed', message}`. Se quitó el chequeo manual `if(!id)` de `client:update` (ahora lo cubre `@IsNotEmpty` del DTO). **Nota:** no se usa conversión implícita de tipos porque esbuild no emite `design:type`; el frontend ya manda los tipos correctos (verificado con `tsx`: validación, mensajes en español, anidados y `@Transform` de patente funcionan). Endpoints de trabajos (`car:add-job`/`car:update-job`) quedan fuera: su tipo de borde es `CreateCarJob` (frontend), cablear `JobsDto`/`UpdateJobDto` es un cambio aparte.
10. **[hecho]** `APIResponse<T>` consistente
   - Archivos: `src/Types/apiTypes.ts`, `electron/DataBase/Types/types.ts`, `global.d.ts`, `src/Services/{car,client}.service.ts`, `src/Store/{carAsync,clientAsync}.methods.ts`, `src/Store/carSlice.ts`, `electron/DataBase/Endpoints/{dashboard,car,backup}.endpoints.ts`.
   - Cambios: `APIResponse<T>` ahora es un **union discriminado por `status`** (`success` con `result: T` | `failed`/`cancelled` sin result), `message` siempre presente, `result` genérico en vez de `any`, y se agregó el estado `'cancelled'` (que ya usaba backup). Se eliminó el tipo duplicado `ApiResponse` de electron (ahora reexporta el canónico del front, con alias por compat). `global.d.ts` tipa todos los endpoints envelope con `APIResponse<ConcreteType>` (Car, Jobs, Client, DashboardStats, ServiceAlert[], string[]) y se corrigió el desfasaje `results`→`result` de `clients.search`. Servicios y thunks propagados con genéricos concretos; `updatedCar` reescrito sin `any`. Se detectó y corrigió una inconsistencia latente que ocultaba `any`: `fetchClientByName`/`updateClient` no formateaban las fechas de los autos del cliente (sí lo hacía el listado) → helper `formatClient` compartido, devuelven `APIResponse<Clients>`. Se agregó `message` a los handlers de solo-lectura (dashboard, service-alerts, backup:list/open-folder) para cumplir el contrato. **Excepciones documentadas** (no usan el envelope, a propósito): `car:get-all`/`client:get-all`/`car:find-jobs` (colecciones crudas) y `global:search` (forma `{status,cars,clients}`). Verificado: `tsc` (src+electron) + lint completo + 36 tests OK.
11. **[hecho]** Separar `car.endpoints.ts` por dominio (CRUD/jobs/search)
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts` (nuevo), `car.jobs.endpoints.ts` (nuevo), `car.search.endpoints.ts` (nuevo); eliminado `car.endpoints.ts`; `electron/main.ts` (imports).
   - Cambios: se dividió `car.endpoints.ts` (11 handlers, ~455 líneas) en tres módulos por dominio, **sin cambiar el código de los handlers** (solo reubicación + imports acotados a lo que cada archivo usa): CRUD (create, get-all, get-by-license, update, delete, reassign-owner), jobs (add-job, find-jobs, update-job) y search/consultas (service-alerts + global:search, esta última cross-dominio). `main.ts` ahora importa los tres para registrar los handlers. Verificado: 11 canales presentes, `tsc` + lint completo + 36 tests OK.
12. **[hecho]** Caché de estadísticas del dashboard
   - Archivos: `electron/DataBase/dashboardCache.ts` (nuevo), `electron/DataBase/Endpoints/dashboard.endpoints.ts`, `car.crud.endpoints.ts`, `car.jobs.endpoints.ts`, `client.endpoints.ts`, `backup.endpoints.ts`.
   - Cambios: caché en memoria de `DashboardStats` (`dashboardCache.ts` con get/set/invalidate). `dashboard:get-stats` devuelve la caché si existe y solo recalcula (recorrido de todos los autos + trabajos) cuando fue invalidada. Estrategia: **invalidación ante cualquier mutación** (freshness perfecta sin TTL, válido por ser app single-user donde toda escritura pasa por estos handlers). 11 puntos de invalidación tras mutación exitosa: car create/update/delete/reassign, add-job/update-job, client create/update/toggle-active/delete, y backup:import (reemplaza toda la DB). Verificado: `tsc` + lint + 36 tests OK.

## Sprint 3 — Modelo de datos grande

13. **[hecho]** Normalizar `jobs` como entidad separada (alta complejidad/riesgo)
   - Archivos: `electron/DataBase/Entities/job.entity.ts` (nuevo), `Migrations/NormalizeJobs1700000004000.ts` (nuevo), `Entities/car.entity.ts`, `Types/car.dto.ts`, `dataSource.ts`, `Endpoints/{car.jobs,car.crud,car.search,dashboard,backup}.endpoints.ts`, `electron/main.ts`.
   - Cambios: `jobs` deja de ser columna `simple-json` en `Car` y pasa a ser **entidad propia `Job`** con FK a `car` (`@ManyToOne` con `ON DELETE CASCADE`; `Car` tiene `@OneToMany jobs`). `parts` queda como JSON dentro de `Job` (ítems de línea, no ameritan tabla). Migración `NormalizeJobs1700000004000`: crea tabla `job` + índice `IDX_job_car`, transfiere los trabajos del JSON a filas (preserva id/timestamps/parts) y hace `DROP COLUMN car.jobs`; `down` reversible (recrea la columna, repuebla desde `job`, dropea la tabla). Endpoints de lectura cargan `relations: ['jobs']` (get-all, get-by-license, dashboard, service-alerts, export-csv, notificación de arranque). `car:add-job`/`car:update-job` operan sobre `jobRepository` (devuelven el job sin la relación `car` para no serializar el auto completo). Se eliminó el tipo `Jobs` duplicado del backend (fuente de verdad = entidad `Job`; el frontend mantiene su `Jobs`). **Frontend sin cambios**: `car.jobs` sigue siendo un array. Verificado: migración ejecutada en DB dev (`DROP COLUMN` soportado), y prueba end-to-end a nivel datos (relación, parts round-trip, update, cascade delete) + `tsc`/lint/36 tests OK.
14. **[hecho]** Formateo de fechas fuera del store Redux
   - Archivos: `src/Types/types.ts`, `src/Store/carAsync.methods.ts`, `src/Store/clientAsync.methods.ts`, `src/Store/store.ts`, `src/Pages/CarDetailPage.tsx`.
   - Cambios: los thunks dejan de aplicar `formatDate` antes de guardar; guardan los **datos crudos**. Se eliminó el helper `formatClient` (clientAsync) y el mapeo de fechas (carAsync `fetchCars`/`fetchCarByLicence`/`updatedCar`), que quedaron mucho más simples (devuelven la respuesta tal cual). Como ya no hay versión "formateada", los tipos `Cars`/`Clients` pasan a ser **alias** de `Car`/`Client` (fechas `Date`). El único display de fechas del store (`CarDetailPage`, Registrado/Actualizado) ahora formatea con `formatDate()` en el render. `store.ts`: se configura `serializableCheck` con un `isSerializable` que acepta `Date` (sin desactivar el chequeo para otros valores no serializables), ya que el store ahora guarda fechas crudas. Robusto ante IPC que entregue `Date` o `string` (formatDate y new Date manejan ambos). Verificado: `tsc` + lint + 36 tests OK.
15. **[en progreso — planificado, sin código aún]** Paginación en `car:get-all` / `client:get-all`
   - **Decisión (2026-07-21):** el usuario eligió **paginación server-side real** (por sobre la alternativa pragmática de solo aligerar `get-all` manteniendo el modelo en memoria). Es un cambio grande y de blast radius amplio → se difiere la implementación a la próxima sesión.
   - **Hallazgos del análisis previo (para retomar):**
     - La paginación de *display* YA existe: `CarsTable`/`ClientsTable` usan `Pagination` de HeroUI (5/pág) + orden por columna + filtro/búsqueda instantáneos, todo client-side sobre el array completo del store.
     - Hoy `car:get-all`/`client:get-all` hacen `repo.find({relations})` y devuelven TODO. `car:get-all` carga además TODOS los `jobs` de todos los autos (post Task 13) aunque el listado no los muestre.
     - **4 consumidores dependen del dataset completo en memoria** (hay que repuntarlos):
       - `AddCarForm` (autocomplete de titular ← `selectAllClients`) → pasar a `client:search`.
       - `ReassignOwnerModal` (autocomplete de cliente existente ← `selectAllClients`) → pasar a `client:search`.
       - `AddJobPage`/`CarsList` (selector de auto ← `allCars`) → agregar búsqueda + fetch paginado.
       - `ClientDetailPage` (`allCars.filter(owner.id===client.id)` + `car.jobs?.length`) → usar `client.cars` (ya viene de `client:find-by-name`; sumarle `relations:['cars','cars.jobs']` para el conteo) y sacar `getAllCars()`.
     - `Header.tsx` usa `selectPendingJobsCount` (reduce sobre `selectAllCars`) para el badge de alertas → con paginación server-side deja de tener el dataset completo; resolver con contador dedicado (reusar `dashboard:get-stats`, que ya trae `pendingJobs`+`jobsInProgress`, o un `car:count-active-jobs`).
     - `selectCarsByOwnerId` está definido pero NO se usa → eliminar.
   - **Plan de implementación (server-side real):**
     1. Tipos: `Paginated<T>` + `CarQueryParams`/`ClientQueryParams` (`page`, `pageSize`, `search?`, `sortBy?`, `sortDir?`; clientes además `includeInactive?`) en `src/Types/apiTypes.ts`; re-export en `electron/DataBase/Types/types.ts`.
     2. Backend: reescribir `car:get-all` (`car.crud.endpoints.ts`) y `client:get-all` (`client.endpoints.ts`) con QueryBuilder → `skip/take` + `LIKE ESCAPE` (búsqueda) + `orderBy` (sort) + filtro `isActive` (includeInactive) → devolver `{items,total,page,pageSize}` vía `getManyAndCount()`. `car:get-all` deja de cargar la relación `jobs`.
     3. Boundary: `preload.ts` (getAll recibe params) + `global.d.ts` (firmas + `Paginated<Car>`/`Paginated<Client>`).
     4. Servicios/thunks: `getAll(params)`; `fetchCars`/`fetchClients` reciben params y devuelven `Paginated`.
     5. Estado: `CarState`/`ClientState` guardan `list: {items,total,page,pageSize}` en vez de `allCars`/`allClients`; adaptar slices.
     6. Selectores: `selectCarsList`/`selectClientsList`; adaptar/eliminar `selectAllCars`/`selectAllClients` y derivados.
     7. Páginas: `CarsPage`/`ClientPage` suben el estado de page/search/sort/showInactive y disparan fetch (search debounced); las tablas pasan a componentes controlados (reciben page/total/items + `onPageChange`/`onSortChange`).
     8. Repuntar los 4 consumidores + el badge de `Header`.
     9. Verificar: `tsc -p tsconfig.json` + `npm run lint` + `npx vitest run`.

## Sprint 4 — Separación de responsabilidades

16. **[pendiente]** Hooks de datos vs UI (`useCarStore`/`useClientStore` puros)

## Sprint 5 — Features rápidas

17. **[pendiente]** WhatsApp directo desde la ficha del auto
18. **[pendiente]** Confirmación de borrado descriptiva
19. **[pendiente]** Estado vacío con CTA en listados
20. **[pendiente]** Notas internas por trabajo
21. **[pendiente]** Resumen de actividad en la ficha del cliente
22. **[pendiente]** KM history como gráfico de línea
23. **[pendiente]** Acceso directo desde alerta de service a lista filtrada
24. **[pendiente]** Badge de trabajos activos en la barra de navegación

## Sprint 6 — Features de esfuerzo medio

25. **[pendiente]** Quick-actions de estado en listado de trabajos
26. **[pendiente]** Filtros avanzados y ordenamiento en tablas
27. **[pendiente]** Atajos de teclado globales
28. **[pendiente]** Modo claro/oscuro con toggle persistido
29. **[pendiente]** Presupuesto PDF mejorado con número correlativo
30. **[pendiente]** Historial cruzado de cliente

## Sprint 7 — Features grandes (alta complejidad)

31. **[pendiente]** Sistema de recordatorios de service
32. **[pendiente]** Fotos del vehículo (galería)
33. **[pendiente]** Multi-usuario básico con PIN

---

## Notas de sesión

- 2026-07-18: arranque del plan, definido orden de sprints, confirmado trabajar sobre `feat/news`, un commit por tarea.
- 2026-07-18: **Sprint 0 completo** (tareas 1-4). Todo testeado y pusheado a `feat/news`. Próxima sesión: Sprint 1 (fundaciones de calidad).
- 2026-07-18: **Sprint 1 completo** (tareas 5-8). Todo testeado. Notas de alcance: (6) los índices de `licensePlate/fullname/phone` ya existían por `UNIQUE` → se agregó solo `IDX_car_owner`; (8) el wrapper loguea y re-lanza (no traga el error) porque el frontend ya maneja la promesa rechazada. Vitest incorporado como framework de tests (`npm test`, 36 tests). Próxima sesión: Sprint 2 (arquitectura de API).
- 2026-07-19: **Sprint 2 completo** (tareas 9-12). Todo testeado. Extras de la sesión: fix email vacío en alta/edición de cliente (`@Transform` "" → undefined); fix del botón "Atrás" que requería varios clicks (filtros con `setSearchParams({replace:true})`); y fix de los gráficos del dashboard en casos vacíos (`src/Pages/HomePage.tsx`): estados vacíos explicativos por gráfico (`ChartEmpty`), la grilla se muestra siempre, y se corrigió un bug de colores en la torta (color atado a cada estado en vez de por índice, así no se corre cuando falta un estado). Notas de alcance: (9) validación activada en car:create/client:create/client:update; jobs quedan fuera. (10) `APIResponse<T>` union discriminado; `global:search` y los get-all quedan como excepciones documentadas. (11) `car.endpoints.ts` → 3 archivos por dominio. (12) caché de dashboard con invalidación por mutación. Próxima sesión: Sprint 3 (modelo de datos grande).
- 2026-07-21: **Sprint 3 en curso.** Tareas 13 (normalizar `jobs` como entidad) y 14 (formateo de fechas fuera del store Redux) **hechas y testeadas**. Task 15 (paginación): se hizo el análisis completo y el usuario decidió **paginación server-side real**; queda planificada con detalle (ver ítem 15) pero **sin código aún** — se implementa la próxima sesión. Único cambio sin commitear al cerrar: `PLAN_MEJORAS.md` (estado de tareas + plan de la 15).
