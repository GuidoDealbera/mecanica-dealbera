# Plan de Mejoras — Mecánica Dealbera

Revisión integral del proyecto al **10/08/2026**, hecha después de cerrar el plan
anterior (33 tareas, sprints 0 a 7). Este archivo reemplaza ese plan: lo que
estaba hecho quedó en el historial de git y en los commits; acá queda **sólo lo
que falta**, ordenado por valor y riesgo.

Estados posibles: `pendiente` · `en progreso` · `a testear` · `hecho`

Convención de trabajo: una tarea por vez → implementar → probar → commitear.

---

## Contexto del proyecto

Aplicación de escritorio (Electron + React 18 + Redux Toolkit + TypeORM/SQLite)
para la gestión de un taller mecánico: vehículos, titulares, trabajos,
recordatorios de service, documentos (presupuesto/factura) y resguardo de datos.

- **Renderer**: React + HeroUI + Tailwind v4, HashRouter con rutas diferidas,
  layout de alto fijo (`PageShell`) y tema claro/oscuro (`hero.ts` como fuente de
  verdad de la paleta).
- **Main**: endpoints IPC por dominio (`electron/DataBase/Endpoints/*`) envueltos
  en `handleIpc`, migraciones automáticas al iniciar, logs estructurados
  (`electron-log`), auto-update y respaldo diario.
- **Reglas de dominio compartidas** entre main y renderer en `src/Utils/`
  (`serviceReminders.ts`, `budgetPdf.ts`, `timeline.ts`): son módulos puros y son
  los únicos con tests.
- **Verificación**: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `npx vite build`, `npm run format:check`.

---

## Sprint A — Bugs confirmados

Todos están verificados leyendo el código (y varios contra una copia de la base
real). Son chicos y de bajo riesgo: conviene empezar por acá.

1. **[hecho]** El error del auto-updater nunca llega a la interfaz
   - Archivos: `electron/main.ts`, `electron/preload.ts`, `global.d.ts`,
     `src/Components/Header.tsx`.
   - Diagnóstico afinado al implementar: `autoUpdater.on("error")` emitía
     `{ error: error.message }` mientras el contrato (`UpdateError`) y el `Header`
     leen `data.message`, así que llegaba `undefined`. Y `checkForUpdates()`, ante
     un fallo, **emite el evento `error` y además rechaza la promesa**: el
     handler de `check-for-updates` reenviaba el mensaje por su cuenta, con lo
     cual una búsqueda manual fallida mostraba **dos** avisos y el estado final
     dependía del orden de llegada. El caso realmente roto era el de
     los fallos **automáticos** (chequeo periódico y descarga), donde sólo se
     emite el evento: ahí la interfaz no mostraba nada útil. Encima el error **no
     se logueaba en ningún lado**, así que no quedaba rastro para diagnosticar.
   - Cambios: un único emisor del canal (el listener de `error`), con la clave
     `message` y `logError`; el handler `check-for-updates` sólo absorbe el
     rechazo (con el motivo documentado) para que el `await` del renderer no quede
     como promesa rechazada sin atender; `downloadUpdate()` también atiende su
     rechazo; el renderer muestra el motivo real en el toast **y** en el ítem del
     menú; y se agregó `updater.removeAllListeners()` con limpieza en el efecto,
     porque los `ipcRenderer.on` del preload acumulaban un handler por montaje
     (en desarrollo `StrictMode` los duplica siempre).

2. **[hecho]** El historial de kilometraje suma un registro aunque el km no cambie
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
     `src/Utils/apiResponse.ts` (nuevo, + tests), `src/Hooks/useCarQueries.ts`,
     `src/Hooks/useClientQueries.ts`, `src/Pages/CarDetailPage.tsx`,
     `src/Pages/ClientDetailPage.tsx`.
   - El historial ya no crece si el kilometraje no cambió (el formulario de
     edición lo manda siempre, incluso cuando sólo se editó el titular): con km
     igual no se escribe nada, así que tampoco se toca `updatedAt` ni se
     invalida la caché del dashboard por una edición que no ocurrió. Se midió el
     daño antes de decidir: 2 registros repetidos en la base de desarrollo y
     **0** en la que tiene forma de producción, así que no hace falta una
     migración de limpieza.
   - Se agregó validación del kilometraje en el endpoint (entero finito y no
     negativo): la validación con class-validator sólo cubre el alta, y `NaN` no
     es menor que nada, así que un valor no numérico pasaba el control de "no
     bajar los km" y se guardaba.
   - **Bug más grave encontrado en el mismo camino**: un rechazo del backend se
     reportaba como éxito. Los thunks **resuelven** con `status: "failed"` (sólo
     rechazan si falla la llamada IPC), así que al bajar los kilómetros el
     formulario del vehículo mostraba "Vehículo y titular actualizados
     correctamente" sin haber guardado nada. Se resolvió con un helper puro
     `ensureSuccess` en la capa de presentación (`useCarQueries.updateCar` y
     `useClientQueries.updateOwner`), y las pantallas ahora muestran el motivo
     que devuelve el backend en vez de un "Error al actualizar datos" genérico.
     5 tests nuevos.

3. **[hecho]** Borrar un vehículo puede borrar al titular sin avisarlo
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
     `src/Components/DeleteCarDialog.tsx`.
   - **Decisión del usuario (10/08/2026): el titular se conserva.** `car:delete`
     ya no elimina al cliente cuando se borra su último vehículo. Era la única
     operación de la app que destruía un registro que el usuario no había elegido
     borrar, y se llevaba teléfono, dirección y correo de forma irreversible en
     una acción que era "borrar un auto". Se midió antes de decidir: en la base
     de desarrollo **18 de 42 clientes (43%) tienen un solo vehículo**, así que
     pasaba seguido; y la base con forma de producción **ya tenía un cliente sin
     vehículos**, o sea que el estado era válido y soportado.
   - Un cliente sin autos no necesitó trabajo extra de interfaz: `ClientsTable`
     ya muestra "Sin vehículos" y la ficha del cliente tiene su estado vacío.
     Para darlo de baja de verdad sigue estando `client:delete` (que avisa su
     cascada) y el flag activo/inactivo.
   - El diálogo de borrado ahora dice qué se elimina (trabajos, historial de
     kilometraje **y el recordatorio de service**) y, en un bloque aparte, qué se
     conserva: el titular, con su nombre.
   - Verificado contra una copia de la base: el vehículo se borra, el titular
     sobrevive, los trabajos y el recordatorio caen por la cascada de la FK
     (`PRAGMA foreign_keys = 1`), no quedan huérfanos y `foreign_key_check` e
     `integrity_check` salen limpios.

4. **[hecho]** El recordatorio de service se programa fuera de la transacción del trabajo
   - Archivos: `electron/DataBase/Endpoints/car.jobs.endpoints.ts`,
     `src/Hooks/useCarQueries.ts`.
   - `car:add-job` y `car:update-job` ahora corren dentro de un `QueryRunner` y
     le pasan `qr.manager` a `completeAndScheduleNext` (el módulo de dominio
     recibe el `EntityManager` por parámetro justamente para esto). Cerrar un
     service es **un solo hecho**: el trabajo y el recordatorio se guardan juntos
     o no se guarda ninguno. La invalidación de la caché del dashboard pasó a
     ejecutarse **después** del commit.
   - De paso, en `useCarQueries.updateJob` el color del toast estaba fijo en
     `"success"`: con los handlers ahora devolviendo `{status:"failed"}` en vez
     de propagar la excepción, un fallo se habría mostrado como un toast **verde**
     con un mensaje de error. Ahora el color sale del estado de la respuesta.
   - Verificado contra una copia de la base, replicando el cuerpo transaccional:
     con un fallo simulado después de guardar el trabajo, **el trabajo vuelve a
     su estado anterior** y los recordatorios quedan intactos; en el camino feliz
     el trabajo queda completado, el recordatorio anterior pasa a `done` y se
     programa el siguiente.

5. **[hecho]** `car:find-jobs` es código muerto y su contrato miente
   - Archivos: `electron/DataBase/Endpoints/car.jobs.endpoints.ts`,
     `electron/preload.ts`, `global.d.ts`, `src/Types/apiTypes.ts`.
   - Eliminado el handler, el método del preload, el tipo y la mención en el
     comentario de `APIResponse`. No lo usaba ninguna pantalla, devolvía `null`
     cuando no había resultados aunque estaba tipado como array, y traía **todos**
     los autos con todos sus trabajos a memoria.
   - Se verificó el contrato IPC completo con un chequeo cruzado preload ↔ main:
     **43 handlers registrados, ninguno huérfano y ninguno invocado sin
     registrar**.

6. **[hecho]** Los trabajos de la ficha no tienen un orden garantizado
   - Archivos: `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
     `src/Store/carSlice.ts`.
   - `car:get-by-license` ahora pide `order: { jobs: { createdAt: "DESC" } }`. Se
     eligió `createdAt` sobre `updatedAt` para que las filas no salten de lugar
     al cambiarle el estado a un trabajo. Se verificó contra una copia de la base
     que el orden anidado de `find` funciona y que **el orden por defecto no
     coincidía** con el pedido, así que el problema era real y visible (la tabla
     pagina de 5 en 5).
   - También se corrigió el reducer de `addJob`: insertaba el trabajo nuevo **al
     final** del array, así que hasta el próximo refresco el trabajo recién
     cargado aparecía en la última página en lugar de arriba.
   - Se revisaron los otros lectores de `car.jobs`: el CSV calcula el último
     trabajo con un `reduce` por fecha máxima (no depende del orden) y el
     historial ordena sus eventos por su cuenta. El dashboard sí arma sus listas
     de "trabajos recientes" tomando los primeros que encuentra, pero eso se
     resuelve con su reescritura a agregados SQL (tarea 8).

7. **[hecho]** Robustez del arranque de Electron
   - Archivos: `electron/main.ts`, `electron/splash.html`.
   - `uncaughtException` ya no sigue con la app viva: nuevo `fatalError()` que
     registra, cierra el splash, avisa al usuario y sale con `app.exit(1)`. Es lo
     correcto para algo que escribe en una base de datos, y el riesgo de cortar
     de más es bajo porque los errores de los endpoints los captura `handleIpc`
     (llegan al renderer como promesa rechazada, no como excepción del proceso
     principal).
   - Nuevo `process.on("unhandledRejection")` con `logError`: antes una promesa
     rechazada en el proceso principal no dejaba ningún rastro. **No** cierra la
     app (suele ser una operación puntual).
   - **El caso más grave era otro y apareció al implementar**: si
     `initializeDB()` fallaba —base corrupta o migración a medias, justo el
     escenario de la actualización— `createWindow` rechazaba, nadie lo atendía y
     la app quedaba **con el splash abierto para siempre y sin ninguna ventana**.
     Ahora ese camino cierra el splash y sale (sin duplicar el cuadro de error,
     porque `initializeDB` ya muestra el suyo con la ruta de la base).
   - El splash dejó de poder quedar colgado: se creó `closeSplash()` idempotente,
     un plazo máximo de 20 s que lo cierra y muestra la ventana igual, y un
     handler de `did-fail-load` (ignorando `ERR_ABORTED`, que es normal con el
     recargado en caliente). Además su creación es best-effort: si
     `splash.html` no está empaquetado, se registra y la app arranca igual.
   - **Pantalla de carga** (pedido del usuario, opcional): era blanca con un azul
     de Tailwind (`#3b82f6`) que no correspondía a ningún color del sistema, así
     que se veía un fogonazo blanco antes de la app en oscuro. Ahora usa la
     paleta de `hero.ts` (`#006FEE`, fondo oscuro con un halo tenue del color de
     marca) y la ventana se crea con `backgroundColor` oscuro para que no haya
     flash antes de cargar el HTML. También se corrigió el tamaño del título
     (había medidas fijas y media queries que nunca se aplicaban, porque la
     ventana mide 600×600 y el título desbordaba) y el escudo va en una tarjeta
     redondeada, porque es un JPG sin transparencia y sobre el fondo oscuro se
     veía como un rectángulo suelto.

---

## Sprint B — Rendimiento y modelo de datos

8. **[hecho]** El dashboard recorre toda la base en memoria
   - Archivos: `electron/DataBase/dashboardStats.service.ts` (nuevo),
     `electron/DataBase/Endpoints/dashboard.endpoints.ts`.
   - El cálculo se movió a un módulo de dominio que recibe el `EntityManager` por
     parámetro (mismo patrón que `serviceReminders.service.ts`, así no depende de
     Electron y se puede probar). El endpoint quedó sólo con la caché.
   - Cada número sale de un `COUNT`/`SUM` en la base (9 consultas chicas en
     paralelo) en vez de traer todos los autos con todos sus trabajos al proceso
     principal. Medido sobre copias de la base, haciéndola crecer:

     | trabajos  | nuevo (SQL) | anterior (memoria) |
     | --------- | ----------- | ------------------ |
     | 312 (hoy) | 3,7 ms      | 7,6 ms             |
     | 5.000     | 12,4 ms     | 114 ms             |
     | 20.000    | 59 ms       | 421 ms             |
     | 80.000    | 232 ms      | 1.817 ms           |

   - Las listas de "trabajos recientes" ahora **sí** son las más recientes
     (`ORDER BY updatedAt DESC LIMIT 6` en la base); antes eran los primeros seis
     que aparecían al recorrer los autos, sin ningún orden.
   - **Se conservaron todos los números exactamente igual**, validado con un
     script que corre las dos implementaciones sobre la misma base y compara
     campo por campo: sin diferencias en los 13 escalares ni en `monthlyRevenue`,
     tanto en la base de desarrollo como en la de producción ya migrada.
   - Detalle de implementación: los filtros por mes usan
     `strftime('%Y-%m', columna)` en vez de un `>=` contra un datetime, porque
     `job.createdAt/updatedAt` **no tiene un único formato** guardado (ver la
     tarea 30). Comparar la clave del mes es equivalente a lo que hacía el código
     anterior y además es inmune al formato.
   - **Resuelto después (decisión del usuario, 10/08/2026): el ingreso es lo
     entregado.** Completado significa que el trabajo terminó y está listo para
     entregar; el que se cobró de verdad es el entregado. Se cambió
     `revenueThisMonth` (antes sumaba los completados) **y** el gráfico de seis
     meses (antes sumaba completados + entregados), que medían cosas distintas.
     Ahora la tarjeta coincide con su propio subtítulo ("N trabajos entregados
     este mes") y con la barra del mes actual del gráfico —verificado como
     invariante—. En la base de desarrollo el número del mes pasa de $1.131.920 a
     $617.585.

9. **[hecho]** El listado de clientes trae todos los vehículos para mostrar un número
   - Archivos: `electron/DataBase/Endpoints/client.endpoints.ts`,
     `src/Types/types.ts` (documentación del tipo).
   - **La solución planificada no servía**: se había anotado resolverlo con un
     `COUNT` como columna calculada, pero la tabla no muestra sólo la cantidad —
     cuando el cliente tiene **un** vehículo muestra su patente. Así que se
     conserva la relación y lo que se recorta es **qué columnas viajan**:
     `leftJoin` + `addSelect(["cars.id", "cars.licensePlate"])` en lugar de
     `leftJoinAndSelect`, que traía todas las columnas de cada auto por IPC,
     incluido el historial de kilometraje completo.
   - Medido sobre una copia, una página de 8 clientes: **16.824 → 4.023 bytes
     (76% menos)** y 9,5 ms → 2,1 ms. Verificado que no cambia nada de lo que se
     muestra: mismo total, mismos clientes y orden, misma cantidad de vehículos
     por cliente y misma patente en el caso de un solo auto.
   - Se documentó en `Client.cars` que el listado devuelve los vehículos
     **parciales** (sólo `id` y patente) y la ficha los devuelve completos, para
     que nadie lea de ahí un campo que no viajó. (La ficha del cliente usa
     `client:find-by-name`, que no se tocó.)

10. **[hecho]** Índices que faltan para las consultas que ya existen
    - Archivos: `electron/DataBase/Migrations/AddJobStatusIndex1700000008000.ts`
      (nueva), `electron/DataBase/Entities/job.entity.ts`,
      `electron/DataBase/dataSource.ts`,
      `electron/DataBase/dashboardStats.service.ts`.
    - **El índice quedó compuesto `(status, updatedAt)`, no sólo `(status)`**:
      los listados de "trabajos recientes" son
      `WHERE status = ? ORDER BY updatedAt DESC LIMIT 6`, y con la segunda
      columna el índice ya entrega las filas ordenadas —SQLite corta a las seis
      en vez de ordenar todo el subconjunto del estado—. Medido sobre una copia
      inflada a 20.000 trabajos: 38,9 → 0,2 ms. Un índice de tres columnas
      `(status, updatedAt, id)` no mejoraba nada y ocupaba el doble (1.556 vs
      824 KB), así que se descartó.
    - **Hallazgo del camino: `COUNT(job.id)` era contraproducente.** El PK es un
      uuid, no el rowid de SQLite, así que nombrar la columna obliga a leer la
      fila: con el índice puesto, el conteo por estado empeoraba de 6,9 a 88 ms
      (20.000 lookups). Con `COUNT(*)` el índice alcanza solo y baja a 1,1 ms.
      Se cambiaron los cuatro conteos del dashboard (son equivalentes: el PK
      nunca es NULL).
    - **Segundo hallazgo: el orden de los "recientes" no era determinista.**
      `updatedAt` no es único y no había desempate, así que el orden lo decidía
      el plan de ejecución —y cambió al agregar el índice—. Se agregó
      `addOrderBy("job.id", "DESC")`: SQLite ordena sólo dentro de cada empate
      ("LAST TERM OF ORDER BY"), 0,21 → 0,26 ms.
    - Resumen de las mediciones (20.000 trabajos):

      | consulta                          | antes   | después |
      | --------------------------------- | ------- | ------- |
      | badge de trabajos activos         | 3,9 ms  | 0,5 ms  |
      | dashboard: conteo por estado      | 6,9 ms  | 1,1 ms  |
      | dashboard: cerrados del mes       | 6,6 ms  | 3,2 ms  |
      | dashboard: 6 recientes por estado | 38,9 ms | 0,2 ms  |

    - Verificado sobre copias de la base de desarrollo y de la de producción: la
      migración se registra y es idempotente, los planes de ejecución usan el
      índice, `integrity_check`/`foreign_key_check` siguen sanos y el dashboard
      devuelve exactamente los mismos datos (los listados de recientes, el mismo
      conjunto, ahora en orden determinista).
    - `job.carId` ya tenía su índice (`IDX_job_car`), `service_reminder` sus dos
      y `document(type, number)` el compuesto: no faltaba ninguno más.

11. **[hecho]** Revisar el paginado en dos pasos de TypeORM en el resto de los listados
    - Archivos: `electron/pagination.ts` (la regla),
      `electron/DataBase/Endpoints/car.crud.endpoints.ts`,
      `electron/DataBase/Endpoints/client.endpoints.ts`,
      `electron/DataBase/Endpoints/service.endpoints.ts`.
    - La regla quedó documentada arriba de `resolvePage()`, que es la función que
      llaman todos los listados: **joins `*-a-uno` → `offset/limit`; algún join
      `a-muchos` → `skip/take`**, con las dos trampas que ya se pagaron y su
      evidencia medida.
    - Se comprobaron las dos direcciones sobre una copia:
      - `offset/limit` en un listado con join a-muchos (`client.cars`) pidiendo 8
        clientes devuelve **4**, y al último de la página le faltan vehículos —el
        `total` sí sale bien, así que la interfaz mostraría "37 clientes"
        paginando de a 4—. Por eso `client:get-all` **conserva** `skip/take`.
      - `offset/limit` en un listado con joins `*-a-uno` (`car.owner`) devuelve
        exactamente lo mismo que `skip/take` en todas las páginas, con y sin
        filtros, y en una consulta menos. Por eso `car:get-all` **pasa** a
        `offset/limit`: de tres consultas por página a dos, y de paso deja de
        estar expuesto al `TypeError` si algún día se ordena por una expresión.
    - **Hallazgo del camino: ningún listado desempataba el orden.** `car:get-all`
      ordena por año, kilómetros o titular, y `service:list` por `dueDate`:
      columnas con repetidos. Se verificó recorriendo todas las páginas que hoy
      **no** hay repetidos ni faltantes, así que no era un bug activo, pero el
      orden entre iguales lo decidía el plan de ejecución —y en la tarea 10 ya se
      vio que un índice nuevo lo reacomoda—. Ahora los tres desempatan por una
      columna única y con sentido para quien mira la pantalla: patente en los
      vehículos, patente del vehículo en los recordatorios, nombre en los
      clientes.
    - Verificado: los cuatro órdenes de `car:get-all` en las dos direcciones y
      con filtros devuelven el mismo conjunto que antes, sin repetidos ni
      faltantes, y el mismo orden al repetir la lectura; el listado de clientes
      sigue trayendo las páginas completas con todos sus vehículos; los 113
      recordatorios se recorren enteros y los que vencen el mismo día quedan
      ordenados por patente.

Queda una tarea de este sprint sin hacer. Lleva el número **30** —fuera de la
numeración corrida— porque su lugar en el tiempo no es acá: reescribe datos de
producción, así que va **después de la tarea 13** (el snapshot previo a
migraciones), que es la red que le falta.

30. **[pendiente]** Normalizar el formato de fecha guardado en `job.createdAt/updatedAt`
    - Descubierto al implementar la tarea 8. La columna tiene **dos formatos**:
      lo que escribe TypeORM es `YYYY-MM-DD HH:MM:SS.SSS` en hora **local**, pero
      las filas que generó la migración `NormalizeJobs` —los trabajos que ya
      existían, tomados del JSON de `car.jobs`— quedaron en ISO con `T` y `Z`
      (hora UTC). Verificado sobre la copia de producción migrada: **todos** sus
      trabajos históricos están en ISO.
    - Por qué importa: cualquier comparación SQL sobre esas columnas es una
      comparación de **texto** entre formatos distintos. Hoy no rompe nada (la
      tarea 8 quedó escrita de forma tolerante y el resto de los consumidores usan
      `new Date()`, que lee ambos), pero es una trampa para cualquier consulta
      futura, y el mes de las filas en `Z` se interpreta en UTC (un trabajo de las
      últimas 3 horas del mes puede caer en el mes siguiente).
    - Se comprobó que el problema **no** afecta a `car.createdAt`,
      `client.createdAt` ni a `service_reminder.dueDate` (que sí se compara con
      `<=` en SQL): esas están todas en el formato canónico.
    - Solución: migración que reescriba las dos columnas al formato canónico,
      convirtiendo de UTC a hora local sólo las que estén en ISO
      (`strftime('%Y-%m-%d %H:%M:%f', columna, 'localtime')` para las que
      terminan en `Z`, dejando intactas las demás). Probar contra una copia
      comparando los instantes antes y después.
    - Esfuerzo: bajo · Riesgo: medio (toca datos de producción → **después de la
      tarea 13**).

---

## Sprint C — Empaquetado y resguardo de datos

Es la recomendación que quedó pendiente al descartar el multi-usuario (tarea 33
del plan anterior). El objetivo es que un imprevisto —corte de luz, disco lleno,
una migración a medio aplicar, el usuario moviendo un archivo— no se lleve los
datos del taller.

12. **[a testear]** Mover la base de `Documentos` a `userData`
    - Archivos: `electron/DataBase/dataLocation.ts` (nuevo),
      `electron/DataBase/dataSource.ts`.
    - **La base y los respaldos van ahora a carpetas distintas, a propósito.** La
      base viva a `userData` (`%APPDATA%/mecanica-dealbera`), que el usuario no ve
      ni sincroniza; los respaldos **siguen en `Documentos/backups`**, que es
      donde tienen que estar: son lo que hay que encontrar, copiar a un pendrive
      o mandar por correo. Para un archivo que se escribe una vez y se cierra, la
      sincronización de OneDrive deja de ser un riesgo y pasa a ser una ventaja.
    - El traslado usa **`VACUUM INTO`** y no `copyFileSync`, por el mismo motivo
      que la copia previa a las migraciones: el motor escribe una base nueva y
      consistente aunque hubiera un journal pendiente.
    - Orden pensado para no perder nada: primero se escribe la base nueva
      completa (a `.parcial`, después se renombra) y **sólo cuando está lista** se
      aparta la vieja como `taller.db.migrated`. Si el proceso muere en el medio,
      la vieja sigue en su lugar y el próximo arranque reintenta.
    - **Un fallo detiene el arranque.** Si no se pudo trasladar, arrancar igual
      crearía una base nueva y vacía en la ubicación nueva y el usuario vería su
      taller sin un solo vehículo. Mejor no abrir y decir dónde están los datos
      (el mensaje sugiere cerrar OneDrive, que es la causa más probable).
    - Verificado sobre copias, los siete escenarios: traslado de una base 1.0.3
      real (datos completos, vieja apartada y legible, sin `.parcial`);
      idempotencia; reaparición de una base con el nombre viejo (**no** pisa la
      que está en uso); instalación limpia; archivos auxiliares de SQLite;
      segunda vuelta con una apartada ya existente (usa marca de tiempo, no
      pisa); y base vieja ilegible (falla sin dejar una base nueva a medias).
    - Verificado además **sobre el paquete real**, dos arranques seguidos: el
      primero traslada, saca la copia previa, migra y verifica integridad; el
      segundo no hace nada. Documentos queda con `taller.db.migrated` y userData
      con `taller.db` más `backups/`. Los tres archivos —original, trasladada y
      apartada— tienen los mismos datos.
    - Se comprobó también que `userData` y `documents` resuelven a carpetas
      distintas (`%APPDATA%/mecanica-dealbera` y `C:/Users/<usuario>/Documents`).
    - Nota de implementación: `overrideDir()` e `isDev()` son declaraciones
      `function` y no constantes. `AppDataSource` se construye al cargar el
      módulo llamando a `getDBPath()`, que las usa: como `const` quedarían en la
      zona muerta temporal y el módulo reventaría al importarse, algo que
      TypeScript no marca.
    - Se agregó `MECANICA_LEGACY_DB`, hermana de `MECANICA_DATA_DIR`, para poder
      ejercitar el traslado completo dentro de la aplicación real sin tocar los
      Documentos de nadie. Es la operación más delicada del arranque; conviene
      poder probarla de verdad.

13. **[hecho]** Snapshot previo a migraciones + verificación de integridad
    - Archivos: `electron/DataBase/migrationSafety.ts` (nuevo),
      `electron/DataBase/dataSource.ts`, `electron/main.ts`,
      `electron/DataBase/Endpoints/backup.endpoints.ts`.
    - `migrationsRun: true` pasa a **`false`**: las migraciones ya no corren al
      conectar sino que las lanza `initializeDB` en tres pasos —copia previa con
      `VACUUM INTO`, migración, `integrity_check`—. La lógica vive en un módulo
      que recibe el `DataSource` y las rutas por parámetro (mismo patrón que
      `serviceReminders.service.ts`), así se puede ejercitar contra copias.
    - Decisiones que conviene tener presentes:
      - **Sin copia no se migra.** Si no se puede escribir la copia (disco lleno,
        permisos), la aplicación no arranca y avisa qué hacer. Dejar la base
        intacta es recuperable; una migración a medias sobre la única copia de
        los datos del taller, no.
      - **`integrity_check` sólo cuando hubo migraciones**: recorre el archivo
        entero, no tiene sentido pagarlo en cada arranque.
      - **`foreign_key_check` avisa pero no bloquea**: una referencia huérfana
        puede venir de datos viejos anteriores a la restricción, no es
        corrupción.
      - **Restaurar no reintenta**: la aplicación se cierra, porque volver a
        abrirla correría la misma migración fallida sobre los mismos datos. El
        cuadro lo dice explícitamente.
      - `VACUUM INTO` y no `copyFileSync`: el motor escribe una base nueva y
        consistente, no una foto de un archivo que puede estar a mitad de una
        escritura. Se escribe a `.parcial` y se renombra al final, así un corte
        no deja un archivo con nombre de copia buena y contenido incompleto.
    - Verificado sobre copias reales, incluido el camino de fallo:
      - Base de **producción** (1.0.3): se detectan las 8 pendientes, se saca la
        copia (40 KB), migran las 8, `integrity_check` correcto y sin huérfanos.
        La copia resulta ser del estado previo (sin tabla `job`, sin ninguna
        migración aplicada) y es una base SQLite válida y sana.
      - Base ya migrada: no hay pendientes y **no se saca copia**.
      - Migración que revienta a mitad (inyectada): se restaura y la base queda
        byte a byte igual a la copia, sin rastro de lo que la migración había
        alcanzado a hacer, sana y con sus 100 vehículos. La base rota se conserva
        al lado con sufijo `.rota-<marca>`.
      - Rotación: se conservan las 3 copias más recientes.
    - Detalle que apareció verificando: consultar si hay migraciones pendientes
      **crea la tabla `migrations`** vacía. Es inocuo (al restaurar, cero
      aplicadas = corren todas igual) y quedó documentado en el código.
    - También: TypeORM envuelve cada migración en una transacción, así que un
      fallo limpio ya revierte solo. La copia cubre lo que la transacción no:
      corte de luz, archivo corrupto, o una migración que "termina bien" pero
      deja los datos mal.
    - De paso se unificaron las **tres copias** de `getBackupDir()` (estaba
      duplicada en `main.ts` y en `backup.endpoints.ts`) en una sola en
      `dataSource.ts`, derivada de la ruta de la base. En producción resuelve a
      lo mismo de siempre (`Documentos/backups`); en desarrollo pasa a
      `data/backups`, así deja de escribir en los Documentos del usuario.
    - **Verificado también sobre el paquete real** (23/08/2026): se empaquetó con
      `electron-builder --dir` y se ejecutó en modo producción contra carpetas de
      datos descartables. Con base nueva loguea `Copia previa a las migraciones
creada`, `Migraciones aplicadas (8)` y `Verificación de integridad
correcta`; con base ya migrada no saca copia. Es la primera vez que este
      camino corre fuera de un script.
    - **Lo único no verificado**: el cuadro de diálogo que ofrece restaurar. Se
      puede provocar su lógica, pero verlo requiere abrirlo a mano.

14. **[pendiente]** Respaldos: `VACUUM INTO` en vez de `copyFileSync` y retención por niveles
    - Archivo: `electron/main.ts:54` (`performAutoBackup`) y
      `backup.endpoints.ts`.
    - `fs.copyFileSync` de un `.db` puede capturar un archivo inconsistente si
      hay una escritura o un journal/WAL en curso, y hoy se conservan 7 copias
      diarias: un problema que se detecta a los 10 días ya no tiene backup sano.
    - Solución: usar `VACUUM INTO` (produce una copia consistente y compactada),
      correr `integrity_check` sobre el resultado y aplicar retención por niveles
      (7 diarios + 4 semanales + 6 mensuales).
    - Esfuerzo: medio · Riesgo: bajo.

15. **[pendiente]** Restaurar un respaldo desde la propia pantalla de Gestión de datos
    - Hoy "Importar base de datos" abre un explorador de archivos: para volver al
      respaldo de anteayer hay que saber dónde está y cuál es.
    - Solución: listar los respaldos automáticos con fecha y tamaño y permitir
      restaurar uno con un click (con la confirmación que ya existe). El listado
      ya se muestra en la tarjeta "Respaldos automáticos"; falta la acción.
    - Esfuerzo: bajo · Riesgo: medio (es una operación destructiva → confirmación
      explícita + respaldo previo, que el endpoint de importación ya hace).

Y una tarea que apareció verificando la 12, con el número **31** fuera de la
numeración corrida para no renumerar el resto.

31. **[a testear]** ⚠️ Si falla la pantalla de carga, la aplicación se cierra sola al arrancar
    - Archivo: `electron/main.ts`.
    - **Resuelto** con una bandera `isStartingUp` que arranca en `true` y se baja
      justo antes de crear la ventana principal. Mientras está levantada,
      `window-all-closed` no cierra la aplicación: durante el arranque "no quedan
      ventanas" significa "el splash se fue", no "el usuario terminó".
    - Verificado reproduciendo el escenario exacto: aplicación sin empaquetar en
      modo producción (donde `splash.html` no existe). Antes se cerraba sola en
      medio del arranque; ahora el splash falla, queda registrado, y la
      aplicación completa el traslado, la copia previa, las migraciones y la
      verificación de integridad, y sigue viva.
    - Secuencia: `showSplash()` abre el splash, y si `loadFile` falla se registra
      el aviso y se llama a `closeSplash()`. Pero eso puede pasar **mientras
      `initializeDB()` todavía está corriendo**, y en ese momento el splash es la
      **única ventana abierta**: al cerrarse dispara `window-all-closed`, que
      llama a `app.quit()`. La aplicación se cierra sin ventana y sin explicar
      nada, en medio del arranque.
    - Observado de verdad al ejecutar la aplicación sin empaquetar en modo
      producción (ahí `process.resourcesPath` apunta dentro de
      `node_modules/electron`, así que `splash.html` no existe). Empaquetada el
      archivo sí está, con lo cual hoy no se dispara — pero basta un
      `splash.html` que no se copie, un antivirus que lo bloquee o un arranque
      lento para que sí.
    - El splash es deliberadamente _best-effort_ (tarea 7): un fallo suyo no
      debería poder tumbar la aplicación, y hoy puede.
    - Solución: que `window-all-closed` no cierre la aplicación mientras el
      arranque está en curso —basta una bandera que se levante al terminar
      `createWindow`—, o no cerrar el splash ante un fallo de carga hasta que la
      ventana principal exista.
    - Esfuerzo: mínimo · Riesgo: bajo.

---

## Sprint D — Producto y UX

16. **[pendiente]** Definir los tipos de service (o eliminarlos)
    - Archivos: `src/Types/apiTypes.ts` (`ServiceType`), `AddJobForm`,
      `Jobs.tsx`, `service.endpoints.ts`.
    - Hay cinco tipos (general, aceite, correa, frenos, otro) y el modelo soporta
      un recordatorio vigente **por tipo**, pero en la práctica sólo se usa
      "general": por eso se quitó el filtro por tipo de la bandeja. Queda una
      abstracción a medio usar.
    - Solución: o se definen los intervalos por tipo (correa cada 60.000 km,
      aceite cada 10.000, etc.) y se aprovecha el modelo, o se reduce el campo a
      un booleano "es service" y se simplifica todo el circuito.
    - Esfuerzo: medio · Riesgo: bajo · **Decisión de negocio pendiente.**

17. **[pendiente]** Editar el próximo service desde la ficha del vehículo
    - El endpoint `service:save` (y `SaveReminderBody`) ya existe, está expuesto
      en el preload y no lo usa ninguna pantalla: hoy no hay forma de corregir a
      mano la fecha o el kilometraje del próximo service, ni de fijar un intervalo
      propio para un vehículo (`car.serviceIntervalMonths/Km` sólo se puede
      cambiar por SQL).
    - Solución: modal "Editar próximo service" en el bloque de la ficha, con
      fecha, km e intervalo del vehículo.
    - Esfuerzo: medio · Riesgo: bajo.

18. **[pendiente]** Historial de documentos emitidos
    - `document:list` está implementado y expuesto, sin UI. Los documentos se
      registran con su número correlativo, patente, titular y total, así que ya
      hay con qué armar el historial; hoy no hay forma de ver qué se emitió.
    - Solución: pestaña o modal con los documentos del vehículo (número, tipo,
      fecha, total) y el mismo listado global en Gestión de datos. Ideal:
      permitir re-descargar el PDF a partir del registro.
    - Esfuerzo: medio (alto si se quiere reimprimir fiel: habría que guardar los
      ítems del documento, no sólo el total) · Riesgo: bajo.

19. **[pendiente]** Filtrar la bandeja por "ya avisado"
    - `contactedAt` se guarda y se muestra, pero no se puede filtrar. Con 72
      recordatorios vencidos, lo primero que se necesita es "a quién todavía no
      le avisé".
    - Solución: filtro de dos estados (avisados / sin avisar) en la bandeja,
      resuelto en la consulta.
    - Esfuerzo: bajo · Riesgo: nulo.

20. **[pendiente]** Las notas internas nunca salen en el documento
    - Decisión original (tarea 20 del plan anterior): las notas son internas y no
      se imprimen. Está bien por defecto, pero a veces hace falta una
      observación para el cliente.
    - Solución: campo aparte "observaciones para el cliente" por trabajo, o un
      check por trabajo en el modal de emisión para incluir su nota.
    - Esfuerzo: bajo · Riesgo: nulo.

21. **[pendiente]** Refresco de contadores por evento en vez de por navegación
    - Los badges de la barra ahora se recalculan en cada cambio de pantalla (ver
      notas de sesión). Alcanza para un solo usuario, pero sigue siendo un
      "polling" atado a navegar.
    - Solución: canal `main → renderer` que emita "datos cambiados" cuando se
      invalida la caché del dashboard, y que el Header y el dashboard escuchen.
    - Esfuerzo: bajo · Riesgo: bajo.

22. **[pendiente]** Emitir un documento consolidado desde la ficha del cliente
    - Hoy el presupuesto/factura es por vehículo. Un cliente con dos autos en el
      taller necesita dos documentos.
    - Solución: reusar el modal de emisión con los trabajos de todos sus
      vehículos, agrupados por patente en la tabla del PDF.
    - Esfuerzo: medio · Riesgo: bajo.

---

## Sprint E — Calidad y automatización

23. **[pendiente]** No hay tests de componentes ni de endpoints
    - Los 97 tests actuales cubren **sólo** módulos puros
      (`serviceReminders`, `budgetPdf`, `timeline`, `utils`). Todo lo que rompió
      en las últimas sesiones (el paginado de la bandeja, el layout que
      comprimía las tarjetas, el filtro de trabajos del PDF) está fuera de esa
      cobertura.
    - Solución: (a) React Testing Library + jsdom para los componentes con
      reglas —`DocumentModal` (elegibilidad y totales), `ReminderActions`
      (botones según estado), tablas paginadas—; (b) tests de endpoints con una
      base SQLite en memoria y las migraciones aplicadas, que es donde vive la
      lógica más delicada.
    - Esfuerzo: alto (setup + primeros casos) · Riesgo: nulo · **Es la mejora con
      mejor relación costo/beneficio a mediano plazo.**

24. **[pendiente]** Verificación automática antes de publicar
    - Hoy `tsc`, `lint`, `vitest` y `build` se corren a mano.
    - Solución: script `npm run verify` que encadene los cuatro, y un workflow de
      GitHub Actions que lo ejecute en cada push a `feat/*` y `main`.
    - Esfuerzo: bajo · Riesgo: nulo.

25. **[pendiente]** Diferir el stack de PDF
    - `jsPDF` + `jspdf-autotable` + la fuente embebida pesan ~516 kB y hoy entran
      en el chunk de la ficha del vehículo, que es la pantalla más usada.
    - Solución: `import()` dinámico dentro de `useBudgetPDF` (el hook ya es el
      único punto de entrada), así el peso se paga sólo al emitir un documento.
    - Esfuerzo: bajo · Riesgo: bajo.

26. **[pendiente]** Documentar las convenciones del proyecto en `CLAUDE.md`/README
    - Hay reglas aprendidas a fuerza de romper cosas que no están escritas en
      ningún lado: HeroUI invierte las escalas numéricas entre temas (usar tokens
      base + transparencia), un contenedor con scroll no debe maquetear (las
      Cards se comprimen), `min-h-0` en los hijos flex, `PageShell` como
      contenedor estándar, y el dominio compartido recibe el `EntityManager` por
      parámetro.
    - Solución: escribirlas en un `CLAUDE.md` (o `docs/CONVENCIONES.md`).
    - Esfuerzo: bajo · Riesgo: nulo.

---

## Sprint F — Interfaz: observaciones de uso

Detectadas usando la aplicación (10/08/2026). La 27 es un **bug de flujo** y
conviene que entre antes del despliegue; las otras dos son de presentación.

27. **[pendiente]** El vehículo preseleccionado no se ve si no está en la primera página
    - Archivos: `src/Pages/AddJobPage.tsx:39-43`, `src/Pages/Components/CarsList.tsx`.
    - Al entrar a "Nuevo trabajo" desde la ficha de un vehículo, la patente llega
      por el `state` de la navegación y se guarda en `selectedLicense`, pero el
      selector muestra la **primera página** del listado paginado. Si el vehículo
      no cae en esa página, no se ve ninguna tarjeta marcada: la selección existe
      (el formulario funciona) pero el usuario no tiene forma de confirmarla, y
      parece que no se seleccionó nada.
    - Solución propuesta, en dos partes que se complementan:
      1. Al llegar con `state.license`, **precargar el buscador** con esa patente.
         La búsqueda ya es server-side, así que el vehículo queda en la primera
         página sin necesidad de endpoints nuevos.
      2. Mostrar arriba del listado un **resumen fijo del vehículo seleccionado**
         (patente + marca/modelo + titular, con un botón para desmarcarlo), que
         se vea siempre sin importar la página o el filtro. Esto además arregla
         el caso general: elegir un auto, paginar y perder de vista qué se eligió.
    - Esfuerzo: bajo · Riesgo: bajo.

28. **[pendiente]** Las tarjetas de vehículos no tienen el mismo tamaño
    - Archivo: `src/Pages/Components/CarCard.tsx:28` y la grilla de
      `src/Pages/Components/CarsList.tsx:19`.
    - La `Card` usa `w-full max-w-fit`: `max-w-fit` gana sobre `w-full`, así que
      el ancho lo define el contenido (el nombre del titular, la cantidad de
      dígitos del kilometraje) en lugar de la celda de la grilla. El resultado es
      una grilla con tarjetas de anchos distintos y huecos irregulares.
    - Solución: quitar `max-w-fit` y dejar `w-full h-full`; en la grilla, bajar la
      separación (`gap-3` → `gap-2`) y agregar `items-stretch` para que además
      igualen la altura dentro de cada fila.
    - Esfuerzo: mínimo · Riesgo: nulo.

29. **[pendiente]** Las tarjetas del dashboard quedan pegadas a la cabecera
    - Archivos: `src/Components/PageShell.tsx:46`, `src/Pages/HomePage.tsx`.
    - El cuerpo de `PageShell` no lleva padding superior cuando hay cabecera
      (`${header ? "" : "pt-4"}`). En el dashboard la cabecera es una sola fila
      sin margen inferior propio, así que las `StatCard` arrancan pegadas al
      borde y su `shadow shadow-primary` queda recortada por el `overflow-y-auto`
      del contenedor: las tarjetas no se aprecian completas.
    - Solución: agregar un padding superior chico (`pt-1`) al cuerpo de
      `PageShell` — beneficia a todas las pantallas con cabecera, no sólo al
      dashboard. Verificar que no afecte al encabezado adherido (`isHeaderSticky`)
      de las tablas de Autos y Clientes; si molesta ahí, aplicarlo sólo en el
      contenedor interno del dashboard.
    - Esfuerzo: mínimo · Riesgo: bajo.

## Notas de sesión

### 2026-08-10 — Correcciones sobre observaciones de uso (esta sesión)

Cinco observaciones del usuario + una mejora pedida sobre la marcha. Todo
verificado con `tsc`, `lint`, Prettier, 97 tests y `vite build`.

1. **La bandeja de recordatorios salía vacía y tiraba un `TypeError`** — mismo
   bug de raíz para las dos cosas. `service:list` combinaba `skip/take` con joins
   y un `ORDER BY` con expresión (`reminder.dueDate IS NULL`): TypeORM resuelve
   ese paginado con una subconsulta de ids distintos y necesita mapear cada
   `ORDER BY` a una columna real, así que fallaba con
   `Cannot read properties of undefined (reading 'databaseName')`. El rechazo no
   estaba atendido en la pantalla, así que se veía "Todo al día" con 72
   recordatorios en la base. Reproducido y corregido contra una copia de la base
   real (`offset/limit`, correcto acá porque los joins son `*-a-uno`): 72
   resultados, 9 páginas, los recordatorios sin fecha al final. Se agregó además
   el `catch` con toast en la pantalla.
2. **Acciones de los recordatorios** — se definieron las reglas y viven en un
   solo lugar (`getReminderActions`, en el módulo puro compartido): un service
   **al día no se puede posponer** (posponer no cambia el vencimiento, sólo lo
   escondía), un **postergado no se vuelve a posponer** sino que primero se
   **reactiva** (acción nueva, con endpoint `service:reactivate` que respeta la
   invariante de un recordatorio vigente por vehículo y tipo), y los estados
   cerrados no admiten acciones. Las reglas las **valida el backend**, no sólo la
   UI. La bandeja y la ficha del vehículo ahora comparten la misma barra de
   acciones (`ReminderActions`) y muestran "Postergado hasta dd/mm/aaaa", que es
   lo que antes no se reflejaba en ningún lado. También se corrigió el chip de
   estado: un service ya hecho se mostraba como "Al día" porque la urgencia no
   evalúa los cerrados (`getReminderBadge`). 10 tests nuevos.
3. **Presupuesto/factura con selección de trabajos** — los **entregados quedan
   siempre afuera** (ya se cobraron: su lugar es el historial). Nuevo
   `DocumentModal`: se elige el tipo y se marcan los trabajos con checkboxes,
   con el total en vivo y un aviso de cuántos entregados se excluyeron. El
   presupuesto admite sin comenzar / en progreso / completados; la factura, sólo
   completados. `filterJobsForDocument(jobs, onlyCompleted)` pasó a ser
   `eligibleJobsForDocument(jobs, type)` y la regla se reaplica en el hook (no
   sólo en la UI). El `Dropdown` de "Descargar" se reemplazó por el modal y se
   eliminó la variante `compact` del botón, que no se usaba.
4. **Banner del dashboard** — decía "N vehículos sin service en los últimos 6
   meses", que era la heurística vieja; ahora dice "N vehículos requieren
   service" con la aclaración de que son vencidos o por vencer, por fecha o por
   kilometraje (que es lo que realmente cuenta `countDueReminders`). Además los
   endpoints de recordatorios **invalidan la caché del dashboard**: posponer o
   completar un service cambiaba el número real pero el banner seguía mostrando
   el viejo.
5. **Gestión de datos** — nuevo componente `DataCard` (ícono + título +
   descripción + aviso + acción, con el botón anclado al pie para que la fila
   quede pareja) y las cinco tarjetas pasaron a usarlo, en una grilla de tres
   columnas para que no quede una suelta. Los colores se rehicieron con **tokens
   base + transparencia** (`text-success`, `bg-warning/10`) en vez de tonos
   numéricos: HeroUI invierte las escalas entre temas, así que los
   `text-success-300` / `border-warning-800` se veían lavados o pesados según el
   tema. La pantalla ahora usa `PageShell` como el resto.
6. **Filtro "Tipo de service"** — quitado de la bandeja (hoy hay un solo circuito
   real). El parámetro sigue en el endpoint para cuando los tipos se usen de
   verdad (ver tarea 16).
7. **Acciones rápidas fijas en el inicio** (pedido sobre la marcha) — "Ingresar
   Vehículo" y "Nuevo Trabajo" se movieron a la cabecera fija del dashboard
   (`PageShell`), así están siempre a la vista sin depender del scroll; antes
   estaban al pie y se duplicaban en el estado sin datos.
8. **Extra encontrado en la revisión** — los badges de la barra de navegación se
   cargaban una única vez al montar, y como el `Header` nunca se desmonta,
   quedaban congelados toda la sesión (cargar un trabajo o cerrar un service no
   se reflejaba hasta reiniciar). Ahora se recalculan en cada cambio de pantalla.

Archivos nuevos: `src/Components/DocumentModal.tsx`,
`src/Components/DataCard.tsx`, `src/Pages/Components/ReminderActions.tsx`.
Modificados: `electron/DataBase/Endpoints/service.endpoints.ts`,
`electron/preload.ts`, `global.d.ts`, `src/Utils/serviceReminders.ts` (+ tests),
`src/Utils/budgetPdf.ts` (+ tests), `src/Utils/pdfPreview.test.ts`,
`src/Hooks/useBudgetPdf.ts`, `src/Components/BudgetButton.tsx`,
`src/Components/Header.tsx`, `src/Pages/{HomePage,BackupPage,ServiceAlertsPage}.tsx`,
`src/Pages/Components/NextServiceCard.tsx`.

### 2026-08-10 — Evaluación previa al despliegue

Se relevó el estado del entregable: **48 commits** en la rama (29/03 → 10/08) y
la versión sigue en `1.0.3`, igual que la instalada.

El riesgo principal era la actualización de la base: la versión publicada usa
**`synchronize: true` con `migrations: []`** y sólo las entidades `Car` y
`Client`, así que la base del taller no tiene tabla de migraciones y en el primer
arranque de la versión nueva corren **las 7 migraciones de una**. Se simuló ese
escenario sobre una **copia de la base de producción de este equipo**
(`Documents/taller.db`): las 7 migraciones se aplicaron en orden, los datos se
conservaron, el trabajo que vivía en el JSON de `car.jobs` quedó como fila de
`job`, el backfill generó los recordatorios, `integrity_check` devolvió `ok`,
`foreign_key_check` salió limpio y las entidades nuevas leen los datos. El camino
de actualización **está verificado** (`InitialSchema` usa
`CREATE TABLE IF NOT EXISTS`, así que sobre el esquema existente es un no-op).

Dos hallazgos de esa evaluación:

- **Divergencia dev/producción en `car.brand`**: en producción la columna tiene un
  `CHECK` con la lista de marcas (lo generó `synchronize` desde el `simple-enum`)
  que en desarrollo **no existe**, porque `InitialSchema` la crea como `varchar`
  simple. Hoy no hay riesgo (se compararon las dos listas: 104 marcas, idénticas),
  pero **agregar una marca nueva va a requerir una migración que reconstruya la
  tabla**, y en desarrollo el problema no se va a notar.
- **Volver atrás no es sólo reinstalar**: con `synchronize: true`, la 1.0.3 sobre
  una base ya migrada reconstruye la tabla `car` para que coincida con la entidad
  vieja (le devuelve `jobs` vacía y le saca `serviceIntervalMonths/Km`). Las
  tablas nuevas sobreviven huérfanas, así que los trabajos no se pierden, pero la
  app los muestra en cero. El rollback exige **reinstalar la 1.0.3 y restaurar el
  respaldo pre-migración**.

Lo que **no** está verificado: todas las rutas detrás de
`NODE_ENV !== "development"` (base en `Documentos`, respaldo automático,
notificación de arranque, splash desde `resourcesPath` y el auto-updater
completo) nunca se ejecutaron en estos cuatro meses y medio, y el paquete NSIS no
se armó ni una vez con este código.

Pasos acordados antes de publicar: copiar a mano `Documents/taller.db`, arreglar
la tarea 1 (el error del updater no llega a la interfaz, relevante justamente
para un release), subir la versión a `1.1.0`, armar el instalador y probarlo en
este equipo —que ya tiene una base con forma de producción— y recién después
publicar y probar el auto-update desde una 1.0.3 instalada. Pendiente, y es el
paso con mejor relación esfuerzo/certeza: correr la misma simulación sobre una
copia de la base **real del taller**, que es la única que tiene datos de meses.

Se agregaron además las tareas 27 a 29 (Sprint F) a partir de observaciones de
uso: el vehículo preseleccionado que no se ve al cargar un trabajo, el tamaño
desigual de las tarjetas de vehículos y las tarjetas del dashboard pegadas a la
cabecera.

### 2026-08-15 — Migración huérfana en la base de desarrollo

Al verificar la tarea 10 apareció que la tabla `migrations` de
`data/taller.db` tiene una fila **`AddSparePartsToCar1775272596631`** que no
existe en el repositorio (ni la migración ni ninguna columna `spareParts`):
sobra de una prueba abandonada. No rompe nada —TypeORM sólo mira qué migraciones
del código faltan en la tabla, y esa base es descartable— y **la de producción no
la tiene**. Queda anotado por si aparece una inconsistencia rara de esquema en
desarrollo: la solución es borrar la fila o regenerar la base.

Además, dato para dimensionar: la copia de producción de este equipo, ya migrada,
tiene **un solo trabajo** (72 vehículos, pero los trabajos recién empiezan a
cargarse con la versión nueva). Las optimizaciones del Sprint B no se van a notar
hoy en el taller; valen para cuando la tabla `job` crezca.

### 2026-08-16 — Pruebas de extremo a extremo: evaluadas y descartadas por ahora

Se evaluó agregar Playwright para probar el arranque y los cuadros de diálogo del
proceso principal (los que no puede tocar ningún test unitario). Se llegó a tener
el arnés armado y funcionando en lo suyo, pero **no se incorporó al repositorio**.

Lo que se aprendió, que vale más que la suite:

- **Los cuadros nativos no se pueden clickear desde Playwright.** `showMessageBox`
  abre una ventana del sistema operativo, fuera de Chromium. La técnica válida es
  sustituir `dialog` en el proceso principal desde un punto de entrada de prueba:
  permite verificar qué hace la aplicación con cada respuesta y qué texto muestra,
  pero **nunca** el aspecto visual. Eso siempre va a requerir abrirlo a mano una
  vez.
- **Por qué se descartó**: 545 líneas y una dependencia, para una suite que sólo
  rinde si algo la ejecuta sola. Si más adelante hace falta un chequeo automático
  antes de publicar, lo natural es un paso chico en `release.yml` que arranque el
  instalador y verifique que abre, no una suite.
- Quedó en el proyecto una sola cosa de todo eso: **`MECANICA_DATA_DIR`** en
  `getDBPath()`, que permite arrancar la aplicación contra una carpeta
  descartable. Sin eso, cualquier prueba de arranque escribe sobre la base real
  del usuario.
- También se agregó **`.npmrc`** con `legacy-peer-deps=true`: hoy cualquier
  `npm install` local falla con ERESOLVE porque `typeorm` declara `sqlite3@^5` y
  el proyecto usa el 6. El flujo de CI ya pasaba la bandera a mano; esto arregla
  el caso local.

### 2026-08-23 — Falsa alarma: "la aplicación no arranca"

Se abrió una tarea urgente dando por hecho que la aplicación no arrancaba —ni en
desarrollo ni empaquetada— por un `SyntaxError: The requested module 'electron'
does not provide an export named 'BrowserWindow'`. **Era un artefacto del entorno
desde el que se ejecutaban las pruebas, no un problema del proyecto**, y la tarea
se eliminó.

La causa: la variable **`ELECTRON_RUN_AS_NODE=1`**, que define el host de
extensiones de VS Code. Cualquier binario de Electron lanzado con esa variable
heredada corre como **Node puro**, y ahí el especificador `electron` resuelve al
paquete de npm —que exporta la ruta del binario, no la API—, así que todo import
nombrado falla. La aplicación estaba perfecta; el arranque estaba contaminado.

Queda anotado porque es una trampa cara: el error apunta al formato del módulo
(ESM contra CJS) y manda a investigar la configuración de Vite, el `type` del
`package.json` y la versión de Electron, que no tienen nada que ver. **Antes de
lanzar Electron desde cualquier script o herramienta, limpiar
`ELECTRON_RUN_AS_NODE`.**

Del episodio salió algo aprovechable: se empaquetó la aplicación con
`electron-builder --dir` y se la ejecutó en modo producción contra carpetas de
datos descartables, lo que **verificó la tarea 13 sobre el paquete real**. Con
base nueva registra `Copia previa a las migraciones creada` (12 KB), `Migraciones
aplicadas (8)` y `Verificación de integridad correcta`; con base ya migrada no
saca copia. Es la primera vez que el camino de producción se ejecuta desde que se
escribió.

### Historial anterior

El plan de 33 tareas (sprints 0 a 7) se completó entre el 18/07/2026 y el
08/08/2026: fixes urgentes, tests de utilidades, índices, logs estructurados,
wrapper de IPC, validación de DTOs, `APIResponse` unificada, separación de
endpoints por dominio, caché del dashboard, normalización de `jobs` como entidad,
paginación server-side, hooks de datos vs UI, features de taller (WhatsApp,
notas, historiales, filtros, atajos de teclado, tema claro/oscuro, PDF con
numeración correlativa, historial cruzado de cliente) y el sistema de
recordatorios de service. Dos tareas quedaron fuera por decisión del usuario:
**fotos del vehículo** (descartada) y **multi-usuario con PIN** (pospuesta, y
reemplazada por las tareas 12 a 15 de este plan).
