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

9. **[a testear]** Activar validación de DTOs (class-validator ya decorado, falta ejecutar)
   - Archivos: `electron/validation.ts` (nuevo), `electron/DataBase/Endpoints/car.endpoints.ts` (`car:create`), `electron/DataBase/Endpoints/client.endpoints.ts` (`client:create`, `client:update`).
   - Cambios: nuevo helper `validateDto(cls, plain)` que hace `plainToInstance` + `validate` (class-validator) y devuelve `{ ok, dto }` o `{ ok:false, message, errors }` con los mensajes aplanados (incluye anidados de `@ValidateNested`, ej. el `owner`). `whitelist: true` descarta props no decoradas (anti asignación masiva). Aplicado a `car:create`, `client:create` y `client:update` al inicio del handler (antes de abrir transacción); ante error devuelve `{status:'failed', message}`. Se quitó el chequeo manual `if(!id)` de `client:update` (ahora lo cubre `@IsNotEmpty` del DTO). **Nota:** no se usa conversión implícita de tipos porque esbuild no emite `design:type`; el frontend ya manda los tipos correctos (verificado con `tsx`: validación, mensajes en español, anidados y `@Transform` de patente funcionan). Endpoints de trabajos (`car:add-job`/`car:update-job`) quedan fuera: su tipo de borde es `CreateCarJob` (frontend), cablear `JobsDto`/`UpdateJobDto` es un cambio aparte.
10. **[a testear]** `APIResponse<T>` consistente
   - Archivos: `src/Types/apiTypes.ts`, `electron/DataBase/Types/types.ts`, `global.d.ts`, `src/Services/{car,client}.service.ts`, `src/Store/{carAsync,clientAsync}.methods.ts`, `src/Store/carSlice.ts`, `electron/DataBase/Endpoints/{dashboard,car,backup}.endpoints.ts`.
   - Cambios: `APIResponse<T>` ahora es un **union discriminado por `status`** (`success` con `result: T` | `failed`/`cancelled` sin result), `message` siempre presente, `result` genérico en vez de `any`, y se agregó el estado `'cancelled'` (que ya usaba backup). Se eliminó el tipo duplicado `ApiResponse` de electron (ahora reexporta el canónico del front, con alias por compat). `global.d.ts` tipa todos los endpoints envelope con `APIResponse<ConcreteType>` (Car, Jobs, Client, DashboardStats, ServiceAlert[], string[]) y se corrigió el desfasaje `results`→`result` de `clients.search`. Servicios y thunks propagados con genéricos concretos; `updatedCar` reescrito sin `any`. Se detectó y corrigió una inconsistencia latente que ocultaba `any`: `fetchClientByName`/`updateClient` no formateaban las fechas de los autos del cliente (sí lo hacía el listado) → helper `formatClient` compartido, devuelven `APIResponse<Clients>`. Se agregó `message` a los handlers de solo-lectura (dashboard, service-alerts, backup:list/open-folder) para cumplir el contrato. **Excepciones documentadas** (no usan el envelope, a propósito): `car:get-all`/`client:get-all`/`car:find-jobs` (colecciones crudas) y `global:search` (forma `{status,cars,clients}`). Verificado: `tsc` (src+electron) + lint completo + 36 tests OK.
11. **[a testear]** Separar `car.endpoints.ts` por dominio (CRUD/jobs/search)
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts` (nuevo), `car.jobs.endpoints.ts` (nuevo), `car.search.endpoints.ts` (nuevo); eliminado `car.endpoints.ts`; `electron/main.ts` (imports).
   - Cambios: se dividió `car.endpoints.ts` (11 handlers, ~455 líneas) en tres módulos por dominio, **sin cambiar el código de los handlers** (solo reubicación + imports acotados a lo que cada archivo usa): CRUD (create, get-all, get-by-license, update, delete, reassign-owner), jobs (add-job, find-jobs, update-job) y search/consultas (service-alerts + global:search, esta última cross-dominio). `main.ts` ahora importa los tres para registrar los handlers. Verificado: 11 canales presentes, `tsc` + lint completo + 36 tests OK.
12. **[pendiente]** Caché de estadísticas del dashboard

## Sprint 3 — Modelo de datos grande

13. **[pendiente]** Normalizar `jobs` como entidad separada (alta complejidad/riesgo)
14. **[pendiente]** Formateo de fechas fuera del store Redux
15. **[pendiente]** Paginación en `car:get-all` / `client:get-all`

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
