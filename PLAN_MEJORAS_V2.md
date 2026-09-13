# Plan de mejoras v2 — revisión completa del proyecto

Segunda pasada, hecha sobre el código en `2.0.0` (commit `6897f50`), después de
cerrar el [plan v1](PLAN_MEJORAS.md). Ese plan nació de una lista de mejoras
pedidas; **este nace de leer el proyecto entero buscando qué está mal**.

Se revisaron los 45 archivos de `electron/` y los 15.000 renglones de `src/`, y
donde había una duda se comprobó contra la base en vez de suponer.

## Cómo leer esto

Cada tarea tiene un **identificador fijo** (`A1`, `B2`, …) y no un número de
lista. Es a propósito: Prettier renumera las listas ordenadas de Markdown al
formatear, y en el plan v1 eso corrió los números y provocó una tarea duplicada
y una edición fallida. Con identificadores el orden puede cambiar sin que se
rompa ninguna referencia.

Estados: `pendiente` · `en progreso` · `a testear` · `hecho`

Cada tarea dice **qué pasa**, **por qué importa** (con el escenario concreto en
el que muerde) y **dónde**. Las que no tienen un escenario de fallo concreto
están en los sprints de más abajo, que son de calidad y no de corrección.

**Severidad**:

- 🔴 **Rompe o puede romper datos**, o deja al usuario con información falsa.
- 🟠 **Comportamiento inesperado** que el usuario va a notar.
- 🟡 **Deuda real**: hoy no muerde, pero es la causa raíz de la próxima tanda.
- ⚪ **Pulido**: profesionalismo, consistencia, mantenibilidad.

## Resumen

| Sprint                               | Tareas | 🔴  | 🟠  | 🟡  | ⚪  |
| ------------------------------------ | ------ | --- | --- | --- | --- |
| A — Bugs confirmados                 | 13     | 7   | 4   | 1   | 1   |
| B — Validación que existe y no corre | 7      | 3   | 3   | 1   | 0   |
| C — Seguridad y endurecimiento       | 7      | 1   | 0   | 5   | 1   |
| D — Integridad de datos              | 6      | 2   | 3   | 1   | 0   |
| E — Errores no atajados              | 8      | 1   | 4   | 3   | 0   |
| F — Consistencia del contrato        | 9      | 0   | 3   | 4   | 2   |
| G — Rendimiento                      | 7      | 0   | 1   | 4   | 2   |
| H — Huecos de producto               | 8      | 0   | 5   | 2   | 1   |
| I — Interfaz y accesibilidad         | 6      | 0   | 2   | 2   | 2   |
| J — Tests                            | 7      | 0   | 0   | 5   | 2   |
| K — Empaquetado y mantenimiento      | 7      | 0   | 1   | 4   | 2   |
| **Total**                            | **85** | 14  | 26  | 32  | 13  |

---

## Sprint A — Bugs confirmados

Cosas que están mal hoy, con el escenario concreto en el que muerden.

### A1 · 🔴 Restaurar un respaldo viejo deja la aplicación contra un esquema que no entiende

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts` →
`replaceDatabaseWith`

Restaurar o importar copia el archivo encima de la base y hace
`AppDataSource.initialize()`. Pero el `DataSource` declara `migrationsRun: false`
—las migraciones sólo las lanza `initializeDB` en el arranque—, así que **la base
restaurada nunca se migra**.

Escenario: se restaura un respaldo de marzo (esquema de la 1.0.3) desde la 2.0.0.
La base entra sin la tabla `service_reminder`, sin `document`, sin
`job.clientNote`, y con `job.serviceType` en vez de `isService`. La aplicación
sigue abierta y **cada pantalla que toque esas columnas revienta**.

`checkDatabaseHealth` no lo detecta, y no es su culpa: `integrity_check` mira la
estructura del archivo, no si el esquema es el que la aplicación espera. Una base
vieja está perfectamente sana.

Solución: después de reemplazar, correr el mismo camino que el arranque —copia
previa, migraciones pendientes, verificación—. Si no se puede migrar, volver a la
base anterior; el mecanismo de `_pre_import_` ya está escrito.

**Resuelto.** El núcleo "migrar y verificar" se extrajo a `applyPendingMigrations`
—exportado desde `dataSource.ts`— y ahora lo usan los dos caminos: el arranque
(que le agrega la copia previa y el ofrecimiento de restaurar) y la restauración
(cuya red es la base que se acaba de apartar). El mensaje avisa cuántos cambios se
aplicaron: el respaldo ya no es idéntico a lo que quedó restaurado.

De paso se cerró el caso inverso, que era el mismo agujero al revés: una base
escrita por una versión **posterior** no tiene migraciones pendientes —para este
código no las hay— así que pasaba el control igual. `findUnknownMigrations` la
detecta y la aplicación no la toca.

Dos cosas que sólo aparecieron probándolo de verdad:

- **`constructor.name` no sirve para identificar una migración.** El bundle del
  proceso principal va minificado, así que ahí el nombre de la clase es una
  letra: la primera versión daba por desconocidas a las once migraciones propias
  y la aplicación no arrancaba. Va por la propiedad `name` que cada migración
  declara, que es lo que usa TypeORM por el mismo motivo. Hay un test que fija la
  causa —que todas la declaren—, porque el síntoma no se reproduce sin minificar.
- **La base real de la 1.0.3 ya tenía dos migraciones anotadas**
  (`InitialSchema` y `AddPartsToExistingJobs`), así que al ponerla al día corren
  nueve y no once. La afirmación de que la 1.0.3 no tenía ninguna migración, en la
  descripción original de esta tarea, estaba equivocada.

Cubierto por `electron/DataBase/applyPendingMigrations.test.ts` (4 casos) y
`electron/DataBase/Endpoints/backupRestore.test.ts` (3 casos, sobre el handler
real: respaldo viejo, archivo que no es una base —con la vuelta atrás— y respaldo
inexistente). Se comprobó que el test falla si se saca la corrección.

### A2 · 🔴 `service:save` no invalida la caché del dashboard

**[a testear]** · `electron/DataBase/Endpoints/service.endpoints.ts`

`snooze`, `dismiss`, `reactivate`, `complete` y `settings-set` llaman a
`invalidateDashboardStatsCache()`. **`service:save` no.**

Escenario: se corrige a mano la fecha del próximo service de un vehículo para que
venza mañana. El recordatorio cambia, pero el badge de la barra y el dashboard
siguen mostrando el conteo viejo hasta que otra cosa invalide la caché. Es
información incorrecta en la pantalla principal, que es exactamente lo que una
caché no puede permitirse.

**Resuelto.** El test no espía la llamada sino la señal que sale de ella
(`onDashboardStatsInvalidated`), que es la misma por la que el proceso principal
manda `data-changed` al renderer: lo que importa no es que se invoque una
función, es que el contador de la barra se entere.

### A3 · 🔴 `service:save` puede dejar dos recordatorios vigentes en el mismo vehículo

**[a testear]** · `electron/DataBase/Endpoints/service.endpoints.ts`

La invariante del sistema es **un solo recordatorio vigente por vehículo**, y el
endpoint la cuida sólo en la rama sin `id`: si no se pasa uno, reutiliza el
vigente. Pero con `body.id` toma ese recordatorio **sea cual sea su estado** y lo
pone en `pending` sin comprobar que no haya otro activo.

Escenario: se completa un service (el viejo pasa a `done`, se genera uno nuevo
`pending`) y después se edita el viejo desde el historial. Quedan dos vigentes: el
vehículo aparece duplicado en la bandeja y se cuenta dos veces en el badge.

Que esto ya pasó está documentado: la migración `SimplifyServiceType` tuvo que
**colapsar los múltiples recordatorios activos por vehículo** que había en la base
real.

`service:reactivate` sí hace la comprobación con `findActiveReminder`; `save`
tiene que hacer la misma.

**Resuelto junto con A4**: los dos eran el mismo hueco —tomar el recordatorio del
`id` sin mirar nada más— así que se cerró con un solo bloque de tres controles.

### A4 · 🔴 `service:save` puede mover un recordatorio de un vehículo a otro

**[a testear]** · `electron/DataBase/Endpoints/service.endpoints.ts`

El endpoint busca el recordatorio por `body.id` y después hace
`reminder.car = car`, donde `car` sale de `body.licensePlate`. **No comprueba que
el recordatorio pertenezca a ese vehículo.** Un `id` equivocado —o una pantalla
con datos viejos— lo reasigna en silencio a otro auto.

**Resuelto junto con A3.** Escribiendo los controles apareció un tercer caso que
no estaba anotado: si el `id` **ya no existe**, el código caía en el `create` de
más abajo y **creaba un recordatorio nuevo** sin decir nada. Ahora falla y lo
explica.

### A5 · 🔴 Un teléfono repetido revienta con el error crudo de SQLite

**[a testear]** · `electron/DataBase/Endpoints/client.endpoints.ts`

`Client.phone` es `unique` en la base. `client:create` comprueba el **nombre**
duplicado y devuelve un mensaje claro, pero **no comprueba el teléfono**;
`client:update` no comprueba ninguno de los dos al cambiarlo.

Escenario: se carga un cliente con un teléfono que ya tiene otro. `repo.save()`
lanza `SQLITE_CONSTRAINT: UNIQUE constraint failed: client.phone`, `handleIpc` lo
relanza y el usuario ve ese texto —o un "Error inesperado"— en vez de "el teléfono
ya está registrado a nombre de X".

Lo llamativo es que **el mensaje bueno ya existe**: `car:create` y
`car:reassign-owner` sí hacen esa comprobación. Es la misma regla escrita dos
veces y faltando en un tercer lugar.

**Resuelto, y de paso F4.** En vez de escribir la tercera y la cuarta copia, la
regla se mudó a `clients.service.ts` (`findClientConflict`) y ahora la usan los
cuatro caminos. Recibe el `EntityManager` por parámetro, como el resto del
dominio, así que funciona igual dentro de las transacciones de `car:create` y
`car:reassign-owner`.

Detalle que apareció escribiendo el test: `@IsPhoneNumber("AR")` es estricto y
rechaza números inventados como `3510000001`. Los datos de prueba usan números
con formato válido de verdad.

### A6 · 🔴 `car:create` descarta en silencio los datos del titular recién cargados

**[a testear]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts`

Al registrar un vehículo, si ya existe un cliente **con el mismo nombre**, se
reutiliza ese cliente y **se ignoran el teléfono, la dirección, la localidad y el
correo que el usuario acaba de escribir**. Sin avisar: el mensaje es "Vehículo
registrado correctamente".

Escenario: llega un cliente que se llama igual que uno viejo. Su vehículo queda a
nombre del otro, con el teléfono del otro. Cuando haya que llamarlo por el
recordatorio de service, se llama a la persona equivocada.

Y si es la misma persona pero cambió de teléfono, el dato nuevo se pierde igual.

Mínimo: avisar que se va a asociar a un cliente existente y mostrar sus datos para
que el usuario confirme. Ver también **D5**.

**Resuelto sin tocar la interfaz.** Se compara lo cargado contra el cliente que ya
existe con ese nombre: si coincide, el vehículo se le asocia como siempre; si
difiere, se frena y el mensaje dice **qué campo** no coincide y qué hacer —si es
la misma persona, actualizarla desde Clientes; si es otra, usar un nombre que las
distinga—.

El flujo normal no se ve afectado, y eso está probado: el autocompletar del
formulario rellena los datos del cliente elegido, así que llegan idénticos. Y un
campo que el usuario dejó en blanco no cuenta como diferencia: no retipearlo no es
pedir que se borre.

### A7 · 🔴 La búsqueda global trata los comodines de `LIKE` como comodines

**[a testear]** · `electron/DataBase/Endpoints/car.search.endpoints.ts`

`global:search` arma su patrón **sin escapar** `%` ni `_`, cuando el proyecto
tiene un helper (`escapeLike`) escrito justamente para eso y usado en todos los
demás listados.

Escenario: buscar `_` devuelve todo. Una patente parcial con guión bajo devuelve
resultados que no corresponden. No es explotable —la consulta está parametrizada,
no hay inyección— pero los resultados son incorrectos.

De paso, `client:search` **reimplementa** el escape a mano en vez de usar
`escapeLike`, que hace exactamente eso.

**Resuelto, y con él F5.** `global:search` pasó de `Like()` —que no admite
cláusula `ESCAPE`— a un query builder con `escapeLike`, igual que el resto de los
listados, y `client:search` usa el helper en vez de su copia. Los dos ignoran
ahora un término que no sea texto, que era una vía de caída
(`query.replace` sobre `undefined`).

Se comprobó que los tests fallan si se saca el escape.

### A8 · ⚪ `useFormGuard` nunca resetea el bloqueador de navegación

**[a testear]** · `src/Hooks/useFormGuard.ts`

`useBlocker` de React Router deja el bloqueador en estado `blocked` hasta que se
llame a `proceed()` o a `reset()`. `confirmNavigation` llama a `proceed()`, pero
**`cancelNavigation` sólo cierra el modal**: nunca llama a `blocker.reset()`.

**El síntoma que decía esta tarea no existe, y estaba mal anotado acá.** Yo
había escrito que el siguiente intento de salir podía no volver a preguntar. Se
probó y no pasa: React Router evalúa el bloqueador otra vez en cada navegación y
la vuelve a frenar. Midiendo los estados por los que pasa sin el `reset`, la
secuencia es `unblocked → blocked → blocked`, y la pantalla no se abandona
ninguna de las dos veces.

Así que baja de 🟠 a ⚪: el `reset()` **se agregó igual** —es el uso que documenta
la API, deja `blocker.state` diciendo la verdad y suelta los `proceed`/`reset`
viejos— pero no arregla nada que el usuario pudiera ver.

Lo que sí quedó de valor es la cobertura: el guard no tenía ninguna, y ahora hay
tres casos sobre el ciclo completo (preguntar, quedarse y volver a intentar,
confirmar y salir).

### A9 · 🟠 Cerrar la aplicación con cambios sin guardar no avisa nada

**[a testear]** · `src/Hooks/useFormGuard.ts`, `electron/main.ts`

El guard sólo intercepta navegaciones de React Router. **Cerrar la ventana no está
cubierto**: se pierde el formulario sin una palabra. Hace falta atender el `close`
de la ventana principal y preguntar.

**Resuelto.** `useFormGuard` —que ya es el único lugar que sabe si el formulario
está sucio— le avisa al proceso principal por un canal nuevo, y el proceso
principal atiende el `close` de la ventana y pregunta antes de cerrar. El aviso se
retira al desmontar: una pantalla que ya no está no tiene cambios sin guardar, y
sin eso la aplicación quedaría preguntando para siempre. También se limpia en
`did-finish-load`, porque al recargar el renderer arranca de cero.

Detalles que aparecieron probándolo contra la aplicación real:

- **El cuadro va en su variante sincrónica.** `close` no espera promesas: con la
  asíncrona la ventana se cierra igual mientras el cuadro se dibuja.
- **`window.close()` desde el renderer no pasa por `BrowserWindow.on("close")`.**
  Se descubrió porque la primera prueba —hecha justamente con eso— cerraba la
  aplicación sin disparar el guard. Los caminos reales (la X, Alt+F4, `app.quit`)
  sí pasan, y se verificó que ahí el guard frena el cierre y muestra el cuadro.
  Ningún archivo del renderer llama a `window.close()`, así que no hay una vía de
  escape; queda anotado por si alguien la agrega.

### A10 · 🟠 Los hooks devuelven el `Error` donde el llamador espera la respuesta del backend

**[a testear]** · `src/Hooks/useCarQueries.ts`

Varios `catch` hacen `return error`, y los llamadores hacen
`if (response.status === "success")`. Un `Error` no tiene `status`, así que da
`undefined`: hoy **funciona de casualidad**, porque `undefined` es falsy y se
interpreta como fallo.

El archivo además arranca con un `eslint-disable` de `no-explicit-any` y tiene
seis `catch (error: any)`: si lo que se lanza no es un `Error`, `error.message` es
`undefined` y el toast sale vacío.

**Resuelto.** Dos helpers nuevos en `src/Utils/apiResponse.ts`, que es donde ya
vive `ensureSuccess`: `errorMessage` saca un texto legible de lo que sea que se
haya lanzado, y `failureFrom` arma una respuesta con la forma del backend. Los
seis `catch` pasaron a `unknown` y el `eslint-disable` del archivo se fue.

Los tres que no devolvían nada útil —`getCars`, `refresh` y `refreshCar`, cuyos
llamadores ignoran el retorno— dejaron de devolver el error: devolverlo sólo
servía para confundir sobre el contrato.

### A11 · 🟠 Las notificaciones de Windows no declaran la identidad de la aplicación

**[a testear]** · `electron/main.ts`

No se llama a `app.setAppUserModelId("com.dealbera.mecanica")`. En Windows, sin
eso las notificaciones nativas pueden no mostrarse, o mostrarse atribuidas a
`electron.app.…` en vez de a Mecánica Dealbera.

Es justo la notificación de arranque de "N vehículos requieren service", que es la
única que la aplicación manda.

**Resuelto.** El identificador coincide con el `appId` de
`electron-builder.json5`, que es con el que el instalador registra el acceso
directo: Windows empareja la notificación con la aplicación por ahí. En
desarrollo se usa la ruta del ejecutable, que es lo que documenta Electron —un
identificador propio sin registrar en el menú de inicio hace que la notificación
no aparezca en absoluto—.

Es lo único de este sprint que **no se puede verificar con una prueba**: depende
del centro de notificaciones de Windows. Hay que mirarlo con la aplicación
instalada, con algún vehículo con el service vencido.

### A12 · 🟠 La segunda instancia sigue arrancando después de pedir el cierre

**[a testear]** · `electron/main.ts`

`app.quit()` no interrumpe la ejecución del módulo: si no se obtuvo el lock, se
siguen registrando `whenReady`, los handlers de IPC y el resto. En la práctica
Electron termina cerrando antes, pero es una carrera contra un arranque que
**abriría la misma base**. Corresponde salir de verdad y no seguir ejecutando.

**Resuelto** enganchando el arranque sólo en la instancia principal, que es el
patrón que documenta Electron. Lo demás que el módulo registra —handlers de IPC,
listeners de `app`— es inofensivo en un proceso que se está yendo; abrir la base
no lo sería.

Verificado lanzando dos instancias contra la misma carpeta de datos: la segunda
sale con código 0 y **no aparece ni una línea de `db:init` en su log**, mientras
la primera sigue andando.

---

### A13 · 🟡 El linter arrastraba once avisos que nadie iba a mirar

**[a testear]** · `src/Routes/index.tsx`, `src/Components/Forms/*`,
`package.json`

`npm run lint` terminaba con **11 avisos** en cada corrida, local y en CI. Un
aviso permanente no se lee: se vuelve parte del paisaje, y el día que aparece uno
nuevo tampoco se lee.

Eran dos causas distintas:

- **Nueve de `react-refresh/only-export-components`**, todas en el archivo del
  router. Definía las nueve pantallas diferidas pero exportaba un objeto, no un
  componente, así que cualquier cambio ahí obligaba a recargar la página entera
  en desarrollo. Se resolvió como pedía la regla: las pantallas se mudaron a
  `src/Routes/lazyPages.ts`, que exporta sólo componentes, y el router quedó
  exportando sólo el router.
- **Dos de `react-hooks/incompatible-library`**, en los dos formularios que usan
  `watch()` de react-hook-form. Acá **no hay nada que corregir**: el compilador de
  React avisa que no puede memoizar esos componentes y ya hace lo correcto,
  saltearlos; la alternativa sería dejar react-hook-form. Se silencian en el
  lugar y con el motivo escrito, no apagando la regla, para que si mañana otro
  componente usa una librería incompatible el aviso aparezca.

Y para que no vuelvan: `npm run lint` pasó a correr con `--max-warnings 0`. Sin
eso, llegar a cero es cuestión de tiempo hasta que deje de estarlo.

**Apareció además un fallo intermitente del CI**, que se destapó al mirar por qué
una corrida fallaba y la anterior no con el mismo código. Los tests de los
endpoints importan `electron/logger.ts`, que usa `electron-log`, que hace **su
propio `require("electron")`** —y eso no lo intercepta el `vi.mock("electron")`
de cada test: el mock vale para el módulo bajo prueba, no para lo que pida una
dependencia por su cuenta—. Cuando la descarga del binario de Electron no
llegaba en el runner, trece tests se caían con "Electron failed to install
correctly". En local nunca, porque el binario está.

Dos arreglos, uno por cada mitad del problema: un alias en `vitest.config.ts` que
sustituye `electron-log/main` por un doble, y `ELECTRON_SKIP_BINARY_DOWNLOAD` en
el flujo de verificación, que no necesita el binario para nada. Se comprobó
escondiendo `path.txt` en local: `npm run verify` pasa entero sin él.

---

## Sprint B — Validación: la que existe y no se ejecuta

Este sprint sale de un hallazgo que conviene leer entero antes que las tareas
sueltas.

El proyecto tiene **seis clases DTO** con decoradores de `class-validator`, un
helper (`validateDto`) que las aplica bien —con `whitelist: true`, mensajes en
castellano y validación anidada— y **sólo tres se usan**:

| DTO               | ¿Se valida?  | Dónde                                   |
| ----------------- | ------------ | --------------------------------------- |
| `CreateCarDto`    | ✅           | `car:create`                            |
| `CreateClientDto` | ✅           | `client:create`                         |
| `UpdateClientDto` | ✅           | `client:update`                         |
| `UpdateJobDto`    | ❌ **nunca** | definido y no usado en `car:update-job` |
| `UpdateCarDto`    | ❌ **nunca** | definido y no usado en ningún lado      |
| `JobsDto`         | ❌ **nunca** | definido y no usado en ningún lado      |

O sea: **la mitad de la validación del proyecto está escrita, revisada y muerta**.
Los endpoints que deberían usarla leen las propiedades directamente del objeto que
llega por IPC.

Es la causa raíz común de B1 a B4. Vale la pena resolverlo como una sola tarea de
fondo —"todo endpoint que reciba un objeto valida su DTO"— y no una por una.

### B1 · 🔴 `car:add-job` guarda lo que le manden, sin validar nada

**[a testear]** · `electron/DataBase/Endpoints/car.jobs.endpoints.ts`

El endpoint no valida ningún DTO y hace `price: jobDto.price as number` —un
**cast**, que en TypeScript no comprueba nada en tiempo de ejecución—.

Qué entra sin control:

- `price` negativo, decimal o `NaN`. La columna es `integer`; SQLite es de tipado
  laxo y guarda lo que le den.
- `status` con cualquier texto. La columna es `varchar` sin `CHECK`, así que un
  estado inventado se guarda y después **ninguna pantalla sabe pintarlo** y ningún
  filtro lo encuentra: el trabajo queda invisible en los listados.
- `parts` con cualquier JSON. El total del presupuesto lo suma con `reduce`: un
  `price` que sea texto convierte el total en `"0abc"` o `NaN`, y eso va impreso
  en la factura.

`UpdateJobDto` ya declara `@IsEnum(JobStatus)` y `@IsInt()` para esto. Sólo hay
que aplicarlo, y crear el DTO equivalente para el alta.

**Resuelto.** El DTO del alta **ya existía**: era `JobsDto`, escrito completo y
sin usar. Se renombró a `CreateJobDto` —para que se lea como sus hermanos
`CreateCarDto` y `CreateClientDto`— y se conectó al endpoint.

Los repuestos necesitaron una clase propia (`JobPartDto`): `@IsArray()` sólo
comprueba que sea un arreglo, y lo de adentro seguía pasando sin mirar.

Dos cosas que aparecieron escribiendo los tests:

- **`@IsNotEmpty` no rechaza `"   "`.** Un repuesto llamado con puros espacios
  pasaba la validación y salía en blanco en la factura. Se recorta antes de
  validar, con el mismo `@Transform` que ya usaba la patente; vale también para
  la descripción del trabajo, que se imprime en el presupuesto.
- **`whitelist: true` bloquea de yapa un camino que nadie había mirado**: el
  cliente podía mandar `id` o `carId` en el cuerpo. Quedó un test que lo fija.

Comprobado sacando la validación: 5 de los 8 casos fallan.

### B2 · 🔴 `car:update-job` tampoco valida

**[a testear]** · `electron/DataBase/Endpoints/car.jobs.endpoints.ts`

Mismo problema que B1, con el agravante de que **el DTO correcto existe y está
importado**: `UpdateJobDto` se usa sólo como tipo de TypeScript. Los decoradores
no corren nunca.

Además, aunque se validara, `parts` está declarado como `@IsOptional()` **sin**
`@ValidateNested()` ni `@Type()`, así que los ítems de adentro seguirían sin
comprobarse.

**Resuelto.** Editar era la puerta de atrás: todo lo que el alta rechaza —estado
inventado, precio negativo o decimal, repuesto con precio de texto o nombre en
blanco— entraba por acá. Ahora los dos endpoints comparten las mismas reglas, y
hay un test que recorre esa lista sobre `car:update-job` y comprueba además que
el trabajo **queda como estaba** cuando se rechaza.

Los campos siguen siendo opcionales, que es lo que permite cambiar el estado sin
remandar el resto; eso también quedó fijado con un caso.

### B3 · 🔴 `car:reassign-owner` crea clientes sin validar

**[a testear]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts`

En el modo `new`, el endpoint hace `qr.manager.create(Client, payload.newOwner)`
directamente. `car:create` sí valida el titular anidado (`CreateCarDto` lo declara
con `@ValidateNested()`); este camino no.

Escenario: reasignar el titular a uno nuevo permite crear un cliente con teléfono
en formato inválido, dirección vacía o correo mal formado —cosas que el alta
normal rechaza—. Quedan dos calidades de dato según por dónde se entró.

**Resuelto** validando con el mismo `CreateClientDto` que usa el alta, antes de
abrir la transacción. Apareció además que **el `mode` tampoco se comprobaba**:
con uno cualquiera se caía en el `else`, o sea la rama de "cliente nuevo", con un
`newOwner` que podía no existir.

De paso se arregló algo del andamiaje de los tests que se destapó acá: el plazo de
un `beforeEach` **no es el del test**, va aparte. Los tests de base de datos
levantan un `DataSource` y corren once migraciones en el hook, así que en frío se
pasaban de los 5 segundos por defecto y el archivo fallaba entero por un timeout
que no tenía nada que ver con lo que se estaba probando. Ahora los dos plazos
están en `vitest.config.ts` y la constante que cada archivo repetía se fue.

### B4 · 🟠 El vehículo no se puede editar: sólo el kilometraje

**[a testear]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts`

`car:update` recibe `(id, kilometers)` y **nada más**. Marca, modelo, año e
intervalos propios de service no se pueden corregir desde ningún lado.

Escenario: se carga un vehículo con el modelo mal escrito o el año equivocado. La
única salida es borrarlo —perdiendo todos sus trabajos, su historial de
kilometraje y su recordatorio— y volver a cargarlo.

`UpdateCarDto` ya está definido con `owner` y `kilometers`, sin usarse. Ni siquiera
cubre marca/modelo/año.

**Resuelto de punta a punta.** `UpdateCarDto` se reescribió con marca, modelo,
año y kilometraje —todos opcionales, se aplica sólo lo que viene— y el endpoint
pasó de recibir `(id, kilometers)` a recibir el objeto. Eso cambió la cadena
entera: preload, tipos, servicio, thunk, hooks y la pantalla. En el formulario,
marca, modelo y año dejaron de estar deshabilitados al editar.

**La patente sigue sin poder editarse, y es a propósito**: es la identidad del
vehículo —la usan las rutas de la aplicación, los recordatorios y el registro de
documentos ya emitidos—. Cambiarla es otra operación, no una corrección de tipeo.
`whitelist` la descarta si igual la mandan, y hay un test que lo fija.

Las reglas del kilometraje que ya existían se conservaron, que era el riesgo del
cambio: no baja, y **sólo deja un punto en el historial cuando cambia de verdad**
—el formulario lo manda siempre, aunque se haya editado otra cosa—. Las dos
tienen su caso.

El techo del año lo pone el endpoint y no un decorador, porque depende de cuándo
se ejecute y un decorador se evalúa una sola vez al cargar el módulo.

Verificado además contra la aplicación real: se carga un vehículo con el modelo
mal escrito, se corrige por el camino de verdad y queda `GOL / Fiat / 2015`.

### B5 · 🟠 Guardar una configuración inválida dice que salió bien

**[a testear]** · `electron/DataBase/serviceReminders.service.ts` →
`saveServiceSettings`

La función filtra los valores que no sean números positivos y **guarda sólo el
resto**, en silencio. El endpoint devuelve siempre
`"Configuración de service actualizada"`.

Escenario: se pone `0` en "avisar con N días de anticipación" y se guarda. No pasa
nada, el mensaje dice que sí, y el campo vuelve a mostrar el valor viejo sin
explicación.

Tampoco hay techo: `intervalKm = 999999999` se acepta y deja el recordatorio
programado para el año 3000.

**Resuelto, y ahora es todo o nada.** Si algo de lo que vino está fuera de rango
no se guarda nada, y el mensaje dice **qué campo** y **entre qué valores** tiene
que estar. Guardar la mitad de un formulario es peor que no guardarlo: el usuario
no tiene forma de saber qué quedó aplicado.

Cada campo tiene piso y techo con un motivo, no un número redondo: diez años de
intervalo ya es "no hacerle service", y avisar con más de un año de anticipación
es tener todo siempre en la lista. El techo importa tanto como el piso —sin él,
un intervalo enorme deja al vehículo fuera del circuito sin que nadie lo note—.

Lo que **no** vino se sigue sin tocar, que es lo que permite mandar sólo lo que
cambió; hay un caso que lo fija.

### B6 · 🟠 `document:issue` acepta totales negativos

**[a testear]** · `electron/DataBase/Endpoints/document.endpoints.ts`

`total: Math.round(Number(body.total) || 0)` no rechaza negativos. El total del
documento es el **snapshot** que queda en el historial: un negativo ahí es un dato
contable falso que no se puede corregir después (el registro es de sólo lectura).

**Resuelto**, y escribiendo el test apareció que el negativo era el caso menos
grave: **`Number(null)` es `0`**, así que un total ausente emitía un documento en
cero sin decir nada. Ahora se exige que sea un número y no se convierte nada; el
renderer manda el resultado de `computeTotals`, que siempre lo es, así que
cualquier otra cosa significa que algo se rompió antes y conviene enterarse.

El cero **sí** se acepta: un trabajo de garantía o de cortesía se factura en cero,
y hay un caso que lo fija para que nadie lo endurezca de más.

De paso quedó cubierto el correlativo, que es la razón de existir de la tabla:
series separadas por tipo, y un rechazo no quema un número.

### B7 · 🟡 La validación de negocio está repartida entre DTOs y comprobaciones a mano

**[a testear]** · varios

Además de los DTOs, hay reglas escritas a mano en los endpoints: el kilometraje en
`car:update`, la fecha y el km en `service:save`, el tipo en `document:issue`, el
rango de días en `service:snooze`. Cada una con su propio estilo y su propio
mensaje.

No es un bug, pero es la razón por la que las de B1–B3 se pudieron olvidar: no hay
un lugar donde se vea "todo lo que entra por IPC se valida así". Conviene un
criterio único y una prueba que lo verifique para todos los canales.

**Resuelto, y no era sólo documentación: encontró 19 canales rotos.**

La prueba (`contratoDeEntrada.test.ts`) **no enumera los canales a mano**: los
toma de los que quedan registrados al importar los módulos, así que un endpoint
nuevo entra solo. Eso es lo único que evita que la lista se desactualice como se
desactualizó la anterior. Lo que fija es una sola cosa: **un cuerpo inválido se
contesta, no se revienta** —si el handler lanza, `handleIpc` relanza y al
renderer le llega el mensaje técnico crudo—.

La primera corrida marcó 19 canales, con tres causas distintas:

- **`validateDto` reventaba antes de validar.** Con un cuerpo que no fuera un
  objeto, `plainToInstance` tira "Cannot read properties of undefined (reading
  'constructor')" antes de que ningún decorador pueda decir qué falta. Un solo
  arreglo cubrió los siete endpoints que validan DTO.
- **Los identificadores iban derecho al `where`.** Diez canales: `undefined`,
  `null` o un objeto producían "Undefined value encountered in property … of a
  where condition" o "Too few parameter values were provided". Ahora pasan por
  `esIdentificador`.
- **Los listados suponían un objeto.** `params.search.trim()` con una cadena
  falla. Ahora pasan por `comoParametros`.

Y una del `@Transform` de la patente, que corre **antes** de las validaciones:
asumía que el valor era texto, así que reventaba antes de que
`@IsNotEmpty({ message: "La patente es requerida" })` pudiera hablar.

El criterio quedó escrito en `CLAUDE.md`, que es donde se busca.

---

## Sprint C — Seguridad y endurecimiento

El modelo de amenaza de una aplicación de escritorio monousuario es acotado: no
hay atacante remoto ni datos de terceros. Pero **el renderer ejecuta HTML y
JavaScript**, y todo lo que le demos alcanza a cualquier cosa que llegue a
ejecutarse ahí.

### C1 · 🔴 El preload expone un `ipcRenderer` genérico que anula el puente tipado

**[a testear]** · `electron/preload.ts`

Además del objeto `api` —bien diseñado, canal por canal, con tipos—, el preload
hace:

```ts
contextBridge.exposeInMainWorld("ipcRenderer", {
  on,
  off,
  send,
  invoke,
});
```

Eso le da al renderer **`invoke` y `send` sobre cualquier canal, con cualquier
argumento**. Todo el trabajo de acotar la superficie con `api` queda sin efecto:
`window.ipcRenderer.invoke("backup:import")` o `("car:delete", ...)` funcionan
igual.

Lo revisé: **nadie lo usa**, salvo tres renglones en `src/main.tsx` que escuchan
`main-process-message` —código de ejemplo de la plantilla de electron-vite que
sólo hace un `console.log`—. O sea que la superficie está abierta **para sostener
código muerto**.

Se saca el bloque del preload, se sacan los tres renglones de `main.tsx`, se saca
el `send` de `main-process-message` en `electron/main.ts` y se limpia el tipo en
`global.d.ts`.

**Resuelto.** El tipo no estaba en `global.d.ts` sino en
`electron/electron-env.d.ts`, que es lo que hacía que los tres renglones de la
plantilla compilaran; también se fue de ahí.

Queda un test que **no mira el nombre sino la capacidad**: falla si el preload
expone cualquier objeto con un `invoke` o un `send` sin acotar el canal. Es la
clase de cosa que se agrega "para probar algo" y se queda, así que el nombre
`ipcRenderer` no es lo que hay que vigilar.

Verificado además en la aplicación real: `window.ipcRenderer` es `undefined`,
`window.api` conserva sus ocho áreas y el dashboard responde.

### C2 · 🟡 El renderer no tiene Content-Security-Policy

**[a testear]** · `index.html`

No hay ninguna CSP declarada. Con `contextIsolation: true` y `nodeIntegration:
false` el daño posible está acotado, pero una CSP es la diferencia entre "un
script inyectado no puede hacer nada" y "puede hablar con la red y con lo que el
preload exponga".

Mínimo razonable: `default-src 'self'`, `script-src 'self'`, `connect-src 'none'`,
`img-src 'self' data:`. Hay que verificar que Tailwind y HeroUI no necesiten
`'unsafe-inline'` para estilos.

**Resuelto**, y aplicarla destapó dos cosas que la aplicación hacía sin que
nadie lo supiera.

Va por cabecera desde el proceso principal y no con un `<meta>` en el HTML,
porque así puede ser **estricta en producción sin romper el desarrollo**: el
servidor de Vite inyecta scripts en línea y abre un websocket, y una política que
los permita en el paquete final no sirve de nada.

**`connect-src 'none'` en producción**: la aplicación no habla con la red, todo
pasa por IPC. Para poder afirmarlo hubo que arreglar lo que sí hablaba:

- **Las tipografías se bajaban de Google en cada arranque**, con un `@import`
  remoto en `index.css`. O sea que el arranque dependía de internet: en un taller
  sin conexión la interfaz caía a las fuentes por defecto y el logo perdía su
  identidad. Ahora viajan con la aplicación, sólo el subconjunto `latin` que
  cubre el castellano: 68 kB entre las dos, contra los doce archivos que servía
  Google para alfabetos que esta aplicación no usa.
- **El script que evita el parpadeo del tema estaba en línea en el HTML.** Se
  mudó a `public/tema-inicial.js`, que `'self'` cubre. La alternativa era un hash
  en la política, que hay que acordarse de actualizar cada vez que se toque ese
  código.

El único permiso amplio que queda es `style-src 'unsafe-inline'`, y no hay forma
de evitarlo: HeroUI y framer-motion escriben estilos en el atributo `style` de los
elementos que animan.

Verificado en la aplicación empaquetada recorriendo las nueve pantallas y
**emitiendo un documento de verdad** —el camino más pesado, con jsPDF y la fuente
de patentes embebida—: cero violaciones y cero errores en la consola del
renderer. Y en `npm run dev`, que arranca limpio.

Se coló además un arreglo de A1: en una base nueva, consultar la tabla
`migrations` fallaba y TypeORM lo registraba como error —tiene el registro de
consultas encendido en desarrollo—. Un `SqliteError: no such table: migrations` en
el arranque que no era ningún problema pero parecía uno. Ahora se pregunta si la
tabla existe en vez de atajar el error.

### C3 · 🟡 La ventana no restringe la navegación ni la apertura de ventanas

**[a testear]** · `electron/main.ts`

No hay `webContents.setWindowOpenHandler` ni un manejador de `will-navigate`.

- Un `target="_blank"` o un `window.open()` abre **una ventana de Electron**, no
  el navegador.
- Una navegación a una URL externa convierte la ventana de la aplicación en un
  navegador sin barra de direcciones ni forma de volver.

Lo correcto: denegar toda apertura de ventana y toda navegación fuera de la
aplicación, y derivar al navegador del sistema. El canal para eso ya existe
(`app:open-external`, que además valida que sea `https://`).

**Resuelto.** Va sobre `web-contents-created` y no sobre la ventana principal,
para que alcance a todo lo que exista —incluida la pantalla de carga— y a lo que
se agregue después.

Una apertura de ventana se deniega siempre; si era `https://` se deriva al
navegador del sistema, así un enlace que se agregue mañana no queda muerto. Una
navegación fuera de lo propio se cancela y queda registrada: saber que pasó
importa, porque significa que algo intentó salirse.

Verificado en la aplicación empaquetada: `window.open("https://example.com")`
devuelve `null` y abre el navegador, asignar `location.href` a un sitio externo
no mueve la ventana y deja el aviso en el log, y la navegación por hash del
enrutador sigue andando —que era el riesgo, porque un `will-navigate` mal puesto
rompe la aplicación entera—.

### C4 · 🟡 El CSV exportado es vulnerable a inyección de fórmulas

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts` → `toCsv`

`toCsv` escapa comillas y separadores —correcto para el formato— pero no neutraliza
los valores que **empiezan con `=`, `+`, `-` o `@`**. Excel y LibreOffice los
interpretan como fórmulas al abrir el archivo.

Escenario: un cliente cargado con el nombre `=HYPERLINK(...)` o una fórmula que
lea otras celdas. Al abrir el CSV exportado, se ejecuta. Es el vector clásico de
CSV injection, y acá los datos los escribe una persona en un formulario.

Se resuelve anteponiendo un apóstrofo a los valores que arranquen con esos
caracteres.

**Resuelto**, y `toCsv` se mudó a su propio módulo (`electron/DataBase/csv.ts`).
No necesita Electron ni la base y **hay que poder probarlo**: lo que hace no es
obvio y equivocarse produce un archivo que se ve perfecto.

Se agregaron el tabulador y el retorno de carro a la lista, porque algunas
versiones los saltean y evalúan lo que sigue. Y se escapa también un valor que
empiece con `-` aunque sea un número negativo: en este CSV no hay ninguno
—kilometraje, año y cantidad de trabajos son siempre positivos— y el arranque
clásico de una carga por DDE es justamente un `-`.

Los seis casos cubren las dos cosas que es fácil confundir: que el **formato**
esté bien (comillas dobladas, celdas entrecomilladas) y que la planilla no
**ejecute** lo de adentro. Son problemas distintos: un archivo bien formado
ejecuta la fórmula igual.

Y apareció una segunda copia: `src/Utils/utils.ts` exportaba **otro `toCsv`**,
idéntico al viejo, que **no usaba ninguna pantalla** —sólo su propio test—. Se
eliminó. Código muerto que duplica una función con una vulnerabilidad recién
arreglada es justo lo que alguien copia el mes que viene.

### C5 · 🟡 El menú por defecto de Electron sigue activo

**[a testear]** · `electron/main.ts`

Se llama a `setMenuBarVisibility(false)`, que **oculta** la barra pero no quita el
menú: los aceleradores siguen funcionando. `Ctrl+Shift+I` abre las herramientas de
desarrollo y `Ctrl+R` recarga la aplicación en medio de lo que se esté haciendo.

Para una aplicación de taller conviene `Menu.setApplicationMenu(null)` en
producción y dejar el menú sólo en desarrollo.

**Resuelto.** `Ctrl+R` recargando la aplicación con un formulario a medio llenar
no es una función, es una forma de perder trabajo por un dedo mal puesto.

Verificado en las dos ramas, que es lo que importa acá: **hay que empaquetar de
verdad para que `app.isPackaged` sea `true`**, así que se armó el paquete y se
corrió el ejecutable —`empaquetada: true | menú: quitado`— y después el mismo
código sin empaquetar —`empaquetada: false | menú: presente`—. Correr sólo la
versión sin empaquetar habría dejado la rama que importa sin probar.

### C6 · 🟡 `app:open-external` falla en silencio hacia el renderer

**[a testear]** · `electron/main.ts`

Si la URL no empieza con `https://`, se registra el error y se hace `return`. El
renderer recibe `undefined`, que es indistinguible del éxito: el usuario aprieta
"WhatsApp", no pasa nada y nadie le dice por qué.

Corresponde devolver el envelope `{ status: "failed", message }` como el resto de
los canales.

**Resuelto**, y conectarlo a las pantallas destapó algo peor. La bandeja de
recordatorios hacía:

```ts
window.api.global.openExternal(url);
runAction(reminder.id, () => window.api.service.markContacted(reminder.id));
```

O sea que **marcaba el recordatorio como "ya avisado" sin esperar a que el
enlace abriera**. Si WhatsApp no llegaba a abrirse, el vehículo quedaba
registrado como contactado sin que nadie hubiera contactado a nadie, y
desaparecía del filtro de pendientes: el titular no se entera nunca de que le
toca el service. Ahora el contacto se registra sólo si el enlace abrió.

Las dos pantallas ya cubrían el caso de la URL vacía —el botón se deshabilita,
o sale un aviso—, así que lo que quedaba mudo era que fallara la apertura en sí.

Comprobado en la aplicación real con cadena vacía, `http://`, `javascript:` y un
valor que no es texto: los cuatro devuelven el envelope con su motivo.

### C7 · ⚪ El instalador no se firma

**[pendiente — depende de comprar un certificado]** · `electron-builder.json5`

No hay **ninguna** configuración de firma: ni `certificateFile`, ni
`certificateSubjectName`, ni secretos en el flujo de publicación.

**Corrección de lo que decía antes esta tarea.** Yo había escrito que el
resultado dependía del almacén de certificados de la máquina que compilara. Se
comprobó sobre el ejecutable armado y no es así: `Get-AuthenticodeSignature`
devuelve `NotSigned`, siempre. Lo que confundía era el
`signing with signtool.exe` que aparece en el registro del build —
electron-builder lo escribe igual y saltea la firma cuando no encuentra
certificado—. O sea que sí es reproducible: reproduciblemente sin firmar.

Consecuencia: SmartScreen avisa "editor desconocido" en cada instalación y el
usuario tiene que entrar en "Más información → Ejecutar de todas formas".

**Esto no se puede cerrar desde el código.** Hace falta un certificado de firma
de código (OV o EV), que es una compra con verificación de identidad. Un
autofirmado no sirve: SmartScreen lo trata peor que a un binario sin firma.

Lo que sí quedó hecho es que el día que haya certificado **no haya que tocar
nada**: electron-builder toma `CSC_LINK` y `CSC_KEY_PASSWORD` del entorno, y eso
está anotado en la configuración junto con el porqué del estado actual.

---

## Sprint D — Integridad de datos e invariantes

Lo que la base permite que no debería, y lo que sólo se sostiene porque el código
se porta bien.

### D1 · 🔴 La invariante "un recordatorio vigente por vehículo" no existe en la base

**[a testear]** · `electron/DataBase/Entities/serviceReminder.entity.ts`

La regla está escrita en el comentario de la entidad y la cuidan los endpoints a
mano. **La base no la impide**: no hay índice único ni restricción.

Que eso no alcanza está probado: la migración `SimplifyServiceType` tuvo que
recorrer la base real **colapsando los múltiples recordatorios activos por
vehículo** que ya existían, quedándose con el más urgente y descartando el resto
con una nota. O sea que el código ya falló en sostenerla al menos una vez, y
**A3** describe un camino por el que puede volver a pasar.

SQLite soporta índices únicos parciales, que es exactamente la herramienta:

```sql
CREATE UNIQUE INDEX IDX_service_reminder_activo_por_auto
  ON service_reminder (carId)
  WHERE status IN ('pending', 'snoozed');
```

Con eso, el bug deja de poder ocurrir en vez de tener que acordarse de evitarlo.

**Resuelto.** La migración primero **colapsa** lo que hubiera quedado duplicado
—o el índice no se puede crear— con el mismo criterio que usó
`SimplifyServiceType`: sobrevive el más urgente y el resto se descarta con el
motivo escrito, no se borra. Son historial.

Lo que fija el test es lo que hace que el bug deje de poder ocurrir, que es
distinto de arreglarlo: **la base rechaza el segundo vigente aunque el código se
equivoque**. Y que siga dejando todos los `done` y `dismissed` que haga falta,
que es el historial del vehículo.

El riesgo del cambio no era el índice sino lo que pudiera romper, así que se
ejercitó el circuito completo contra una copia de la base real: cerrar un service
como trabajo entregado y completarlo a mano. En los dos casos queda exactamente
un vigente y el historial se acumula.

De paso, los dos tests que tenían el número de migraciones escrito a mano pasaron
a compararse contra las registradas: agregar una migración ya no obliga a venir a
corregirlos.

### D2 · 🔴 Los tipos de las entidades mienten sobre lo que puede ser nulo

**[a testear]** · `electron/DataBase/Entities/*.entity.ts`

Tres columnas están declaradas `nullable: true` en la base y **no nulas** en
TypeScript:

| Campo           | Base             | TypeScript            |
| --------------- | ---------------- | --------------------- |
| `Car.owner`     | `nullable: true` | `owner!: Client`      |
| `Car.kmHistory` | `nullable: true` | `kmHistory!: {...}[]` |
| `Job.parts`     | `nullable: true` | `parts!: {...}[]`     |

El compilador cree que siempre hay valor, así que **no obliga a nadie a
contemplar el caso nulo**. En el código conviven las dos cosas: hay lugares que se
defienden (`car.owner?.fullname ?? "Sin titular"`, `Array.isArray(car.kmHistory)`)
y lugares que no. Los que no se defienden hoy funcionan por suerte, no por
garantía; y el compilador —que es quien tendría que avisar— está mirando para otro
lado porque le mintieron.

Cambiar los tipos a `Client | null` y compañía va a hacer aparecer los sitios sin
proteger. Ese es el punto.

**Resuelto, y el resultado fue al revés de lo esperado.** Corregir las tres
columnas en las entidades del backend dio **cero errores**: ahí ya se usaba
encadenamiento opcional en todos lados.

Donde estaba la mentira que importaba era en los tipos del **renderer**, que son
otros (`src/Types/types.ts`). Ahí `owner` decía ser siempre un `Client`, y
corregirlo destapó tres accesos sin proteger:

- **`CarsTable`** pintaba `car.owner.fullname` directo. Un vehículo sin titular
  no rompía esa celda: **volteaba el listado entero de vehículos**.
- **`CarDetailPage`** hacía `car!.owner.id` al guardar. Ahora, si no hay titular,
  no intenta actualizarlo —asignarle uno es otra operación—.
- **`AddCarForm`** pasaba el vehículo entero al `reset` del formulario.

Con `parts` pasó algo revelador: el tipo decía "siempre un arreglo" y **todos los
usos ya escribían `?? []`**. Esa repetición era la señal de que el tipo no
describía la realidad. Corregirlo dejó un solo punto por arreglar, el envío del
formulario, que ahora manda lista vacía en vez de ausencia: al backend le llega
una sola forma.

Queda anotado como deuda aparte que "sin repuestos" tenga **dos
representaciones** —`null` y `[]`—: es lo que obliga al `?? []` en cada uso, y se
arregla con un `NOT NULL DEFAULT '[]'` y su migración.

### D3 · 🟠 `countDueReminders` usa `COUNT(columna)`, contra la regla del propio proyecto

**[a testear]** · `electron/DataBase/serviceReminders.service.ts`

```ts
.select("COUNT(reminder.id)", "count")
```

`CLAUDE.md` documenta la regla con la medición: el PK es un uuid y no el rowid de
SQLite, así que nombrar la columna obliga a leer la fila entera, y un conteo por
estado pasó **de 1,1 ms a 88 ms**. `dashboardStats.service.ts` tiene hasta una
constante `COUNT_ALL = "COUNT(*)"` con el razonamiento escrito arriba.

Es el único lugar del backend que se quedó afuera, y no es cualquiera: alimenta el
badge de la barra y la notificación de arranque.

**Resuelto**, y se comprobó que no quedaba ningún otro. Lo único que aparece
ahora es `COUNT(1)`, que lo genera TypeORM en `repository.count()` y no lee
ninguna columna.

El contador no tenía **ninguna** cobertura, siendo lo que alimenta el badge, así
que se le agregó: cuenta lo vencido por fecha y por kilometraje, y **no** cuenta
lo que falta mucho ni lo que ya está cerrado.

### D4 · ⚪ Un recordatorio descartado saca al vehículo del circuito para siempre

**[a testear]** · `electron/DataBase/serviceReminders.service.ts`

`ensureReminder` dice en su documentación que se usa "al registrar un auto **y
como red de seguridad**". Lo comprobé: **se llama en un solo lugar**, en
`car:create`. La red de seguridad no existe.

Escenario: se descarta el recordatorio de un vehículo (por ejemplo porque el
cliente dijo que no lo trae más). El auto **no vuelve a generar ninguno**: queda
fuera del circuito de service de forma permanente, salvo que alguien se acuerde de
crearle uno a mano desde su ficha.

Hay dos salidas razonables y hay que elegir una: llamar a `ensureReminder` de
verdad como red de seguridad (al abrir la ficha, o al cerrar cualquier trabajo), o
sacar la frase de la documentación y hacer explícito en la interfaz que descartar
es definitivo.

**Resuelto**, pero la premisa era **falsa** y conviene dejar escrito por qué,
porque el error estuvo en razonar sobre el código en vez de ejecutarlo.

Lo de `ensureReminder` sí es cierto: se llama en un solo lugar y la "red de
seguridad" que promete su documentación no existe. De ahí salté a "entonces
descartar es permanente", y no lo es. Ejercitando los endpoints de verdad:

```
vigentes al alta       : 1
tras descartar         : 0
¿se puede reactivar?   : success :: Recordatorio reactivado
tras reactivar         : 1
descartado de nuevo    : 0
cierra un trabajo service
¿reingresa al circuito?: 1
```

Hay **dos** caminos de vuelta, y ninguno pasa por `ensureReminder`:

- **Manual**: `service:reactivate`. La interfaz lo expone —el selector de la
  pantalla de service tiene "Historial completo", donde el descartado aparece, y
  ahí `ReminderActions` muestra el botón "Reactivar"—.
- **Automático**: cerrar cualquier trabajo marcado como service.
  `completeAndScheduleNext` crea uno nuevo cuando no hay ninguno vigente. O sea
  que el vehículo vuelve al circuito solo, en cuanto vuelve al taller.

Descartar no es una condena: es "no me lo recuerdes hasta que aparezca".

Nada de esto estaba probado, que es lo que permitió que la premisa pareciera
plausible. Ahora hay cuatro casos sobre los endpoints reales que fijan el ciclo
completo, incluida la diferencia que importa: reactivar devuelve **el mismo**
recordatorio y cerrar un service crea uno **nuevo**.

Lo único que se corrigió en el código es la documentación de `ensureReminder`,
que ahora dice dónde se la llama y cuáles son las dos vueltas de verdad.

### D5 · 🟠 El nombre del cliente es la clave única, así que no puede haber dos homónimos

**[a testear]** · `electron/DataBase/Entities/client.entity.ts`

`Client.fullname` es `unique`, y **es la clave por la que se busca al cliente** en
casi todos lados: `client:find-by-name`, la reasignación de titular por
`existingOwnerFullname`, la asociación automática en `car:create`.

Consecuencias:

- Dos clientes que se llamen igual son imposibles. En un taller de barrio eso pasa.
- El teléfono también es `unique`: una familia que comparte un número no puede
  tener dos fichas.
- Buscar por nombre en vez de por `id` es frágil: renombrar un cliente cambia la
  clave con la que lo referencian las pantallas.

Lo correcto de fondo es referenciar por `id` en toda la interfaz y quitar la
unicidad de `fullname` (dejando quizás un aviso de duplicado, no un impedimento).
Es un cambio grande: toca endpoints, hooks y pantallas.

**Resuelto**, en ese orden y en dos partes, porque la segunda no se puede hacer
sin la primera: mientras el nombre siga siendo la forma de encontrar al cliente,
permitir homónimos sólo consigue que el sistema tome a uno por el otro.

**Primero, referenciar por `id`.** `car:create` recibe un `ownerId` opcional y
deja de buscar al titular por nombre: quién es lo decide el formulario, que es
el único que sabe si el usuario eligió a alguien de la lista o escribió un
nombre nuevo. `car:reassign-owner` pasó a `existingOwnerId`,
`client:find-by-name` es `client:find-by-id`, y la ficha vive en `/clients/:id`,
así que renombrar a un cliente ya no invalida el enlace a su ficha.

En el camino apareció un detalle que sólo se ve leyendo: las opciones del
autocompletar llevaban `textValue={client.key}`, y al pasar la clave a ser el
`id` eso habría mostrado un uuid en el campo al elegir un titular.

La decisión de qué titular quedó elegido salió del componente a
`src/Utils/ownerSelection.ts`, que es donde el proyecto pone las reglas
testeables. Lo que sí se ejercitó en la aplicación real es la ficha del cliente
por `id`, entrando por la dirección y con un clic desde el listado.

**Corrección posterior, hecha en el Sprint E.** Acá decía que el autocompletar
no era testeable —no se lo pudo manejar por CDP— y que como el código anterior
se comportaba igual bajo el mismo arnés, era una limitación de la herramienta.
Las dos cosas estaban mal. `@testing-library/react` ya estaba en el proyecto, y
al escribir el test que faltaba apareció el motivo real de que el widget no
respondiera: **el campo no se podía tipear**, ni antes ni después. El código
anterior se comportaba igual porque tenía el mismo bug. Ver E9.

**Después, quitar la unicidad.** La migración `AllowHomonymClients` reconstruye
la tabla `client` sin los `UNIQUE` de `fullname` ni de `phone` —el teléfono
también, porque una familia que comparte un número tampoco podía tener dos
fichas— y repone como índices normales los que traía la restricción, de los que
dependen el orden del listado y la búsqueda del duplicado.

Lo delicado ahí es que SQLite no puede quitar un `UNIQUE` de la tabla sin
reconstruirla, y `car.ownerId` la referencia con `ON DELETE SET NULL`: al soltar
la tabla vieja esa acción se dispara y **todos los autos se quedan sin dueño**,
sin violar ninguna restricción. Se midió, y también que las dos formas de
evitarlo desde adentro de la migración no sirven: el `PRAGMA foreign_keys` se
ignora dentro de una transacción y `defer_foreign_keys` demora la comprobación
pero no las acciones.

Lo que salva a la migración es que el driver ya hace lo correcto —el
`QueryRunner` de better-sqlite3 apaga las claves foráneas en `beforeMigration`—.
Se llegó a agregar el `PRAGMA` a `applyPendingMigrations` antes de descubrirlo,
y se sacó por redundante. Queda un caso que fija el resultado, porque es una
garantía que damos por sentada y que no depende de nuestro código.

Se corrió contra una base real del usuario, una previa a todas las migraciones:
13 migraciones aplicadas, los mismos clientes y autos antes y después, cero
huérfanos, `foreign_key_check` vacío e `integrity_check` en `ok`.

**Y el duplicado ahora se avisa en vez de impedirse.** `findClientConflict` pasó
a ser `describeClientDuplicates`: los cuatro caminos que cargan clientes guardan
igual y suman el aviso a su mensaje de éxito, nombrando al otro cliente —sin
eso, el usuario no tiene cómo saber si acaba de cargar dos veces a la misma
persona—. Si coinciden el nombre **y** el teléfono, el aviso lo dice de una vez:
es la señal más fuerte de que es un duplicado de verdad, y avisar de uno solo la
escondería a medias.

### D6 · 🔴 El dinero se guarda en `integer` para el trabajo y en JSON libre para los repuestos

**[a testear]** · `electron/DataBase/Entities/job.entity.ts`

`Job.price` es `integer`, así que la mano de obra no admite centavos. Los
repuestos viven en `Job.parts` como `simple-json`, donde `price` es un número de
JavaScript cualquiera: **sí admite decimales**.

Escenario: se carga un repuesto a $1.234,56. Se guarda con decimales, y el total
del presupuesto los arrastra, pero la mano de obra del mismo trabajo no puede
tenerlos. El documento impreso mezcla las dos cosas.

Hay que decidir una representación y aplicarla a las dos: o todo en centavos
(`integer`, que es lo más sano para dinero), o todo con decimales explícitos. Hoy
es medio y medio por accidente.

**Resuelto**, y buscando el escenario descrito apareció otro bastante peor. Sube
de 🟡 a 🔴: se cobra mal.

La representación no había que elegirla, ya estaba elegida. `job.price`,
`document.total` y el número de documento son columnas `integer`, y `formatARS`
imprime con `maximumFractionDigits: 0`. Son **pesos enteros**. El precio del
repuesto es el único que se escapó, y no por decisión: vive dentro de un
`simple-json`, donde no hay tipo que lo impida. Así que ahora `JobPartDto` lo
valida con `@IsInt`, igual que el precio del trabajo, y una migración redondea
lo que hubiera quedado guardado con centavos —sin eso, editar un trabajo viejo
fallaría con un error sobre un dato que el usuario nunca escribió—.

Lo que **no** pasa es lo que decía el escenario: el documento impreso no mezcla
las dos cosas, porque todo se imprime con `formatARS` y los centavos
desaparecen. El daño era invisible, que es distinto de inexistente.

Lo grave está antes, en `parseNumber`, que es por donde entran los **tres**
campos de dinero del programa: el precio del trabajo, el de cada repuesto y la
edición del precio en la lista. Borraba todos los puntos y llamaba a `Number`,
así que las dos maneras de escribir un decimal terminaban mal y ninguna avisaba:

| lo que se escribe | lo que se guardaba |
| ----------------- | ------------------ |
| `1234,56`         | `0`                |
| `1234.56`         | `123456`           |

El segundo es el que importa: el precio queda **cien veces más caro** y el
usuario no tiene forma de notarlo salvo mirando el total. Y se realimentaba
solo, porque `formatThousands(1234.56)` devolvía `"1.234.56"`: abrir para editar
un importe con decimales y volver a guardarlo lo multiplicaba por cien sin
tocarlo.

Ahora la coma es siempre el separador decimal, y un punto sólo es separador de
miles si agrupa de a tres hasta el final; si no, es un punto decimal escrito a
la inglesa. El resultado se redondea, que es lo que corresponde si el importe se
guarda en pesos enteros: preferible un peso de más o de menos que cien veces de
más.

---

## Sprint E — Errores no atajados y observabilidad

Qué pasa cuando algo sale mal, y si queda rastro.

### E1 · 🔴 Un error de la interfaz no deja **ningún** rastro en los logs

**[a testear]** · `src/Pages/Components/ErrorBoundary.tsx`

Cuando una pantalla revienta, el `ErrorBoundary` la reemplaza por "Algo salió mal"
y hace `console.error`. Nada más.

El problema es que `console.error` del renderer **no va al archivo de log**: va a
la consola de las herramientas de desarrollo, que en producción nadie abre. Y el
detalle técnico se muestra sólo `if (import.meta.env.DEV)`.

Escenario completo: al usuario le revienta una pantalla, ve un cartel genérico,
llama por teléfono, y del otro lado se le pide que mande los logs —hay un botón
"abrir carpeta de logs" justamente para eso—. **En los logs no hay nada.** El único
error que importaba es el único que no se registró.

Hay que mandarlo al proceso principal por IPC y registrarlo con `logError`, como
todo lo demás.

**Resuelto.** Hay un canal `app:log-renderer-error` y un único camino de la
interfaz al archivo, `reportarError`. Es `send` y no `invoke` a propósito:
registrar no puede bloquear ni fallar hacia una pantalla que ya está rota, y por
lo mismo `reportarError` no lanza nunca —se lo llama siempre encima de un error
que ya ocurrió, y romper ahí lo taparía con otro peor y sin traza—.

Se aprovechó para cubrir lo que el `ErrorBoundary` **no** ve, que tenía el mismo
problema y ni siquiera un cartel: un error en un manejador de evento, en un
`setTimeout` o una promesa sin `catch`. React no los atrapa porque no ocurren
durante el renderizado. Van por `window.onerror` y `unhandledrejection`.

Lo que se guarda es nombre, mensaje, traza, ruta y traza de componentes, todo
acotado: el archivo de log rota, y una traza de React sin límite se lleva por
delante los errores anteriores, que son los que dan contexto. Se rearma un
`Error` de verdad en el proceso principal en vez de pasar el objeto plano,
porque `serializeError` sólo sabe sacarle `name`/`message`/`stack` a un `Error`
—con un objeto cualquiera escribiría `"[object Object]"` y se perdería la traza,
que es lo único por lo que este canal existe—.

Verificado contra la aplicación real, disparando los tres caminos: los tres
quedan en `main.log` con su scope, su ruta y su traza completa.

Y el cartel ahora dice que el detalle quedó registrado. Sin eso el usuario no
tiene motivo para ir a buscar los logs, que es el paso que cierra el circuito.

### E2 · 🟠 Si falla cargar la configuración de service, la pantalla ofrece guardar valores inventados

**[a testear]** · `src/Pages/ServiceAlertsPage.tsx`

```ts
} catch {
  /* si falla, quedan los valores por defecto */
}
```

El comentario describe lo que hace, pero no el efecto: el formulario de
configuración queda mostrando **los valores por defecto como si fueran los
guardados**. Si el usuario abre ese panel y aprieta guardar, **pisa su
configuración real con los defaults** sin haberse enterado de nada.

Un fallo al leer configuración no puede ser silencioso si esa misma pantalla
permite escribirla.

**Resuelto.** El punto es que "todavía no llegó" y "no se pudo leer" eran el
mismo estado, porque los dos se ven como los valores por defecto. Ahora se
distinguen: si la lectura falla, el panel no muestra los campos —mostrarlos es
ofrecer guardarlos— sino el motivo y un botón de reintentar, porque el fallo
puede ser momentáneo y quedarse encerrado hasta reiniciar sería peor.

El error además se avisa con un toast y queda en el log (E1), aclarando que la
pantalla está evaluando los vencimientos con los valores por defecto: eso
cambia qué recordatorios se ven como vencidos, y el usuario tiene que saberlo.

Los tres casos son de componente, con Testing Library. Vale anotarlo porque en
D5 di por no testeable un formulario por no haber podido manejarlo por CDP, y la
herramienta para eso ya estaba en el proyecto.

### E3 · 🟠 El PDF se descarga sin preguntar y sin confirmar que se guardó

**[a testear]** · `src/Hooks/useBudgetPdf.ts`

La emisión termina en `doc.save(...)`, que es la descarga de jsPDF: el archivo cae
en la carpeta de descargas del sistema sin diálogo, sin elegir dónde y **sin
devolver si funcionó**.

Dos cosas mal:

- Es incoherente con el resto de la aplicación. Exportar la base y exportar el CSV
  usan `dialog.showSaveDialog`, dejan elegir la carpeta y avisan al terminar.
  Emitir una factura —que es más importante— no.
- Como `doc.save()` no informa el resultado, **un fallo al escribir no dispara el
  descarte del documento**. Ver E4.

**Resuelto.** El PDF ya dibujado se manda al proceso principal, que pregunta
dónde con `dialog.showSaveDialog`, escribe a un temporal, renombra al final y
muestra el archivo en su carpeta —el mismo patrón que la exportación de la base
y la del CSV—. Y devuelve un `APIResponse`, así que las tres salidas se
distinguen: guardado, cancelado y fallido.

Esa distinción es la que hacía falta. Cancelar deja de ser indistinguible de un
error —no aparece ningún cartel rojo por algo que el usuario hizo a propósito— y
un fallo al escribir deja de ser indistinguible del éxito, que es de lo que
dependía E4.

### E4 · 🟠 El número de documento se puede quemar sin que salga ningún PDF

**[a testear]** · `src/Hooks/useBudgetPdf.ts`,
`electron/DataBase/Endpoints/document.endpoints.ts`

La secuencia es: pedir el número (se **commitea** en la base) → dibujar el PDF →
descargarlo. Si algo falla en el medio, hay un `document:discard` que lo borra,
pero sólo funciona si el documento es el último de su tipo, y **sólo se dispara si
la excepción llega al `catch`**.

Los caminos por los que se pierde el número igual:

- `doc.save()` no informa fallos (E3), así que un error de escritura no se ve.
- Si la aplicación se cierra entre el commit y la descarga, no corre ningún
  descarte.
- Si el descarte falla, se traga el error (`/* no se pudo descartar */`) y no
  queda rastro.

Resultado: un hueco en el correlativo, que es justo lo que toda esta maquinaria
existe para evitar. Lo correcto es al revés: **generar el PDF primero y tomar el
número al confirmar que se guardó**.

**Resuelto, pero sin invertir el orden**, y conviene dejar escrito por qué.

El número va impreso **adentro** del PDF y en el nombre del archivo, así que
"dibujar primero" obliga a adivinar cuál va a ser antes de reservarlo. Y ahí el
riesgo cambia de lado: si el registro no llega a guardarse, ese número se le
vuelve a dar al documento siguiente y quedan **dos documentos con el mismo
número en la calle**. En una factura eso es peor que un hueco. Un hueco es una
molestia de auditoría; un duplicado es un problema con un cliente.

Así que el número se sigue tomando primero, y lo que se arregló son los caminos
por los que no se devolvía:

- `doc.save()` no informaba fallos → ahora lo escribe el proceso principal y
  devuelve el resultado (E3), así que un error de escritura descarta el número.
- Cancelar el diálogo → descarta en el acto, que además es cuando el descarte
  funciona seguro: no se emitió nada después, así que sigue siendo el último de
  su tipo.
- El descarte se tragaba su propio error con un `catch {}` → ahora queda
  registrado (E1). Si el correlativo tiene un hueco, se puede averiguar por qué.

Queda un caso que ningún orden evita: que la aplicación se cierre entre el
commit del número y la escritura del archivo. Es una ventana de milisegundos, y
la alternativa la cambiaría por la posibilidad de un número repetido.

### E5 · 🟠 `data:export-csv` revienta hacia el renderer en vez de devolver el error

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts`

`fs.writeFileSync(filePath, csv, "utf8")` no está en un `try`. Un disco lleno, una
carpeta sin permisos o un pendrive desconectado lanzan, `handleIpc` relanza y el
renderer recibe una promesa rechazada con el mensaje crudo de Node.

Todos los demás flujos de respaldo devuelven `{ status: "failed", message }` con
un texto entendible. Éste no.

**Resuelto**: la escritura va en un `try` y devuelve el motivo nombrando la
carpeta, sin el texto de Node. De paso se escribe a un temporal y se renombra al
final, como el resto: exportar encima de un CSV anterior no puede dejarlo a
medio escribir.

### E6 · 🟡 Los archivos `_pre_import_*.db` se acumulan sin límite

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts`

Cada importación o restauración guarda la base anterior al lado, con nombre
`taller_pre_import_<marca>.db`, y **nunca se borra ninguna**. Las copias previas a
migraciones sí tienen retención (`pruneSnapshots`, últimas 3) y los respaldos
diarios también (por niveles). Éstas no.

No es grave, pero es la misma decisión tomada tres veces con tres resultados
distintos, y con el tiempo llena la carpeta de datos con copias enteras de la base.

**Resuelto**: se conservan las tres últimas, igual que `pruneSnapshots`. Se
podan al terminar bien el reemplazo y no antes, porque hasta ese momento la
copia recién apartada es la única red que hay.

### E7 · 🟡 `backup:export` borra el archivo de destino antes de saber si puede escribirlo

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts`

```ts
fs.rmSync(filePath, { force: true });
await AppDataSource.query("VACUUM INTO ?", [filePath]);
```

El borrado previo es necesario porque `VACUUM INTO` falla si el destino existe.
Pero si el `VACUUM` falla después, **el archivo que había ahí ya no está**.

Escenario: el usuario exporta encima de un respaldo anterior en un pendrive, el
pendrive se desconecta a mitad, y se queda sin el respaldo viejo **y** sin el
nuevo.

Lo correcto es el patrón que el propio proyecto ya usa en `createPreMigrationSnapshot`:
escribir a `<destino>.parcial` y renombrar al final.

**Resuelto**, con eso mismo: el archivo que había sólo desaparece cuando hay uno
nuevo y completo para reemplazarlo.

Comprobado en las dos direcciones. Con el arreglo, un fallo al escribir deja el
respaldo anterior intacto; con el código anterior el mismo caso **dice que la
exportación tuvo éxito** habiendo borrado el respaldo viejo, que es lo peor de
los dos mundos.

### E8 · 🟡 El reemplazo de base no limpia los archivos laterales de SQLite

**[a testear]** · `electron/DataBase/Endpoints/backup.endpoints.ts`,
`electron/DataBase/migrationSafety.ts` → `restoreSnapshot`

Las dos funciones hacen `fs.copyFileSync` sobre el `.db` sin borrar antes un
`-journal`, `-wal` o `-shm` que pudiera haber quedado del archivo anterior. Si
quedara uno, SQLite lo aplicaría sobre una base que no le corresponde.

Comprobé que hoy el riesgo es bajo: la base corre en `journal_mode = delete`
—verificado en ejecución, no supuesto—, así que no hay `-wal` permanente. Pero es
una suposición no escrita en ningún lado: alcanza con que alguien active WAL para
buscar rendimiento y esto pase de improbable a corrupción. Borrar los laterales
antes de copiar cuesta dos renglones.

**Resuelto** con `removeSidecarFiles`, en los tres lugares que dejan un `.db`
distinto en la ruta de la base: el reemplazo, la vuelta atrás del reemplazo y
`restoreSnapshot`. La suposición sobre `journal_mode` queda escrita ahí, que era
media tarea.

### E9 · 🔴 El campo del titular del alta de vehículos no se podía tipear

**[a testear]** · `src/Components/Forms/AddCarForm.tsx`

No estaba en el plan: apareció al escribir el test que en D5 se había dado por
imposible.

El `Autocomplete` del titular recibía `{...field}` de react-hook-form, que
incluye `value` y `onChange`. Pero un `Autocomplete` de HeroUI no se controla
con esos: usa `inputValue` y `onInputChange`. El `onChange` del spread bajaba al
input de adentro y **reemplazaba al de react-aria**, que es el que abre la lista
y avisa lo que se escribió. Resultado: react-aria nunca se enteraba del tipeo,
así que no buscaba ni abría el desplegable, y como el valor visible lo manda
react-aria, en el siguiente render el campo volvía a quedar vacío.

Está así desde el primer commit, y es la pantalla de dar de alta un vehículo,
que es el uso diario de la aplicación.

Medido cuatro veces, dos entornos por dos versiones del código:

| entorno         | sin el arreglo       | con el arreglo               |
| --------------- | -------------------- | ---------------------------- |
| aplicación real | el campo queda vacío | queda "Ana", con su lista    |
| jsdom           | vacío, 0 búsquedas   | "Ana", busca y abre la lista |

La salvedad honesta: se lo manejó con `execCommand("insertText")` y con
`userEvent`, no con una tecla física. No hay mecanismo por el que una tecla real
tome otro camino —termina en el mismo evento `input` y en el mismo `onChange` de
React—, pero conviene confirmarlo escribiendo en el campo una vez.

**Resuelto** pasando `inputValue`, `name` y `onBlur` en vez del spread, con
cuatro casos de componente que fallan sin el arreglo: que elegir de la lista
rellene los datos, que el campo muestre el nombre y no el uuid, que dos
homónimos se distingan, y que editar el nombre después de elegir vuelva a dejar
el titular en blanco.

---

## Sprint F — Consistencia del contrato y del código

Nada de esto rompe hoy. Todo esto es la razón por la que mañana algo se va a
romper: cuando la misma cosa se hace de tres formas distintas, la cuarta vez se
elige mal.

### F1 · 🟠 Los contadores y el dashboard nunca se enteran de que pasó el tiempo

**[a testear]** · `electron/DataBase/dashboardCache.ts`, `src/Components/Header.tsx`

Dos mecanismos que se invalidan **sólo ante escrituras**, calculando cosas que
dependen de la fecha:

- La caché del dashboard no tiene vencimiento. `computeDashboardStats` usa
  `new Date()` para el mes en curso y los últimos seis meses.
- Los contadores de la barra (services por vencer, trabajos activos) se refrescan
  al montar y con el aviso `data-changed`. Nada más.

Escenario: el taller deja la aplicación abierta, como es normal. El 31 de
diciembre a la noche pasa a ser 1° de enero: **el dashboard sigue mostrando
diciembre como mes en curso**, con su facturación y su "+3 este mes", hasta que
alguien cargue algo. Lo mismo con un recordatorio que vence a medianoche: el badge
no lo cuenta hasta la próxima escritura.

Se arregla con un vencimiento por tiempo en la caché y un refresco periódico (o al
volver el foco a la ventana).

**Resuelto**, con las dos mitades, porque una sola no alcanza: si la caché vence
pero nadie vuelve a preguntar, la pantalla sigue mostrando lo mismo.

En el proceso principal, lo cacheado sólo vale dentro del **mismo día
calendario**, y no por un plazo en minutos. Lo que invalida el cálculo no es que
haya pasado tiempo sino que haya cambiado la fecha: un plazo fijo vence de más
durante el día y puede cruzar la medianoche sin enterarse.

En la interfaz, `useRefrescoPorTiempo` refresca al volver el foco a la ventana
—que es cuando la persona vuelve a mirar, o sea cuando un número viejo se nota—
y al cambiar el día. Lo segundo se chequea cada minuto pero **sólo refresca si
la fecha cambió**: comparar dos textos por minuto no le cuesta nada a nadie, y
sondear la base cada minuto sí. Lo usan los contadores de la barra y el
dashboard.

### F2 · 🟠 Cinco endpoints devuelven algo distinto de lo que devuelven los demás

**[a testear]** · `electron/DataBase/Endpoints/*`

El contrato dominante es el envelope `APIResponse<T>` con `status`, `message` y
`result`. Pero:

- `car:get-all`, `client:get-all`, `service:list` devuelven `Paginated<T>` pelado.
- `car:active-jobs-count`, `service:count-due` devuelven un número pelado.
- `client:cities` devuelve un array pelado.
- `document:list` devuelve un array pelado.
- `service:settings-get` devuelve el objeto pelado.
- `client:create` devuelve el envelope pero **sin `result`**, mientras que
  `car:create` y `client:update` sí lo mandan.

El resultado práctico: `ensureSuccess` —el helper que existe justamente para no
tragarse un `status: "failed"`— no se puede usar en la mitad de las llamadas, y
cada pantalla inventa su propio manejo de error. Que es exactamente el problema
que `ensureSuccess` documenta como ya sufrido.

**Resuelto.** Son diez canales: los nueve de la lista más `global:search`, que
tenía una tercera forma propia —`{ status, cars, clients }`, con `status` pero
sin `result`—.

Y había un efecto que no estaba anotado: como esos canales no tenían un `catch`,
una lectura que fallaba de verdad llegaba al renderer como promesa rechazada con
el mensaje de TypeORM. O sea que el problema no era sólo de uniformidad.

El envoltorio va en `handleIpcQuery`, al lado de `handleIpc`, y no en cada
handler. Es la diferencia entre una convención que hay que acordarse de
respetar y algo estructural: un canal de lectura nuevo cumple el contrato por
usar esa función. En las lecturas el `message` de éxito va vacío a propósito —no
hay nada que avisar porque algo se leyó, y un texto ahí sólo invita a mostrarlo—.

`contratoDeEntrada.test.ts` gana el contrato de **salida**, recorriendo la misma
lista registrada: si un canal contesta algo que no es el envelope, el test lo
nombra. Comprobado devolviendo un canal a la forma vieja.

Ejercitado además contra la aplicación real con una base de verdad: los diez
canales contestan el envelope y las cinco pantallas siguen andando.

### F3 · 🟠 `client:create` no devuelve el cliente creado

**[a testear]** · `electron/DataBase/Endpoints/client.endpoints.ts`

Caso particular de F2, pero con efecto propio: quien crea un cliente no recibe su
`id`, así que para hacer cualquier cosa a continuación tiene que volver a
buscarlo **por nombre**, que es la clave frágil de **D5**.

**Resuelto**: `client:create` devuelve el cliente guardado. Con D5 ya hecho,
buscar por nombre después de crear no sólo es frágil sino directamente
ambiguo —puede haber dos con el mismo—.

### F4 · 🟡 La regla "teléfono ya registrado" está escrita dos veces y falta en un tercer lugar

**[a testear]** · `car.crud.endpoints.ts`, `client.endpoints.ts`

Ver **A5**. La misma comprobación, con el mismo mensaje, copiada en `car:create` y
en `car:reassign-owner`, y ausente en `client:create` y `client:update`. Es el
argumento a favor de que las reglas de unicidad vivan en un solo módulo de dominio
y no en cada endpoint.

**Resuelto al hacer A5**: escribir la tercera copia para arreglar A5 habría sido
absurdo, así que la regla se mudó a `clients.service.ts` y los cuatro caminos la
comparten.

### F5 · 🟡 Tres formas distintas de escapar una búsqueda

**[a testear]** · `electron/pagination.ts` y los endpoints de búsqueda

- Los listados usan `escapeLike` (correcto).
- `client:search` **reimplementa** el mismo `replace` a mano.
- `global:search` **no escapa nada** (ver **A7**).

Un helper, tres criterios.

**Resuelto al hacer A7**: los tres caminos usan `escapeLike`.

### F6 · 🟡 El proyecto detecta "modo desarrollo" con `NODE_ENV` en vez de `app.isPackaged`

**[a testear]** · `electron/main.ts`, `electron/DataBase/dataSource.ts`

`process.env.NODE_ENV === "development"` decide cosas serias: **dónde vive la base
de datos**, dónde van los respaldos, si se hace el respaldo diario y si se
comprueban actualizaciones.

`NODE_ENV` es una convención de las herramientas, no algo que Electron garantice.
Hoy funciona porque Vite la define, pero es una variable de entorno heredada: un
`NODE_ENV=production` en la terminal del desarrollador hace que `npm run dev`
**abra la base real del usuario y escriba respaldos en sus Documentos**.

`app.isPackaged` es la comprobación que no depende del entorno.

**Resuelto** en los seis lugares: dónde vive la base, dónde van los respaldos,
el respaldo diario, la notificación de arranque, el auto-updater y la
comprobación manual de actualizaciones.

El log de SQL quedó atado además a que no haya `MECANICA_DATA_DIR`: esa variable
la ponen los tests y los scripts, y ahí volcar cada consulta a la salida sólo
tapa lo que se está mirando.

### F7 · 🟡 `Car` obliga a pasar un objeto al constructor y las demás entidades no

**[a testear]** · `electron/DataBase/Entities/*.entity.ts`

`Car` declara `constructor(partial: Partial<Car>)` (obligatorio) mientras `Job`,
`ServiceReminder`, `Document` y `AppSetting` usan `partial?` (opcional). TypeORM
instancia entidades sin argumentos: funciona porque `Object.assign(this, undefined)`
no hace nada, o sea **por una casualidad del lenguaje**. Conviene unificar.

**Resuelto**: opcional en las seis. Eran dos y no una —`Car` y `Client`—, y el
motivo queda escrito en el código: el tipo decía lo contrario de lo que ocurre.

### F8 · ⚪ Queda código de la plantilla de electron-vite

**[a testear]** · `src/main.tsx`, `electron/main.ts`, `electron/preload.ts`

El canal `main-process-message` sólo existe para hacer un `console.log` de la
fecha al cargar. Arrastra consigo la exposición del `ipcRenderer` genérico
(**C1**). También quedan comentarios en inglés de la plantilla
(`// Test active push message to Renderer-process.`,
`// You can expose other APTs you need here.`, con la errata incluida) en un
proyecto cuya convención es comentar en castellano.

**Ya estaba resuelto al hacer C1**: sacar el puente genérico se llevó el canal y
sus comentarios. Se comprobó que no queda ninguno de los dos.

### F9 · ⚪ `FormWrapper` desactiva el chequeo de tipos de todo el archivo

**[a testear]** · `src/Components/Forms/FormWrapper.tsx`

`/* eslint-disable @typescript-eslint/no-explicit-any */` con
`form: UseFormReturn<any>`. Es un componente genérico, así que se resuelve con un
parámetro de tipo (`<T extends FieldValues>`) en vez de apagar la regla para el
archivo entero.

**Resuelto** con el parámetro de tipo. Lo que importa no es el `any` en sí sino
el `eslint-disable` de archivo entero: es lo que hace que el segundo `any` entre
sin que nadie lo note.

---

## Sprint G — Rendimiento

Con la base de hoy (3 vehículos) nada de esto se nota. Todos son casos que
aparecen al crecer, y algunos crecen rápido.

### G1 · ⚪ La ficha de un vehículo trae **todos** sus trabajos, siempre

**[medido, no se cambia]** · `electron/DataBase/Endpoints/car.crud.endpoints.ts` →
`car:get-by-license`

`relations: { owner: true, jobs: true }` sin límite. Cada trabajo viaja completo
por IPC: descripción, notas, notas al cliente y el JSON de repuestos.

La tabla de la ficha **pagina de a 5 en el frontend**, así que un auto con 200
trabajos manda 200 por IPC para mostrar 5. Un vehículo de flota con años de
historia hace que abrir su ficha sea la operación más pesada de la aplicación.

Corresponde paginar del lado del servidor, como ya se hace en los otros tres
listados.

**Medido, y no se cambia.** Baja de 🟠 a ⚪.

Un vehículo con historia inventada, con notas y repuestos realistas en cada
trabajo:

| trabajos | consulta | ficha completa | sólo el auto | sin notas | sin notas ni repuestos |
| -------- | -------- | -------------- | ------------ | --------- | ---------------------- |
| 200      | 7 ms     | 124 kB         | 10 kB        | 72 kB     | 46 kB                  |
| 1000     | —        | 583 kB         | 10 kB        | 362 kB    | 234 kB                 |

Siete milisegundos y 124 kB no son "la operación más pesada de la aplicación".
Y la consulta ya está indexada: `IDX_job_car` sobre `job(carId)` existe desde
`NormalizeJobs`, así que lo que se mide es hidratar y serializar, no recorrer.

Para que la ficha de **un** vehículo llegue a 200 trabajos hacen falta décadas
de un auto que vuelve todos los meses. Mil es directamente irreal.

Contra eso, lo que cuesta el arreglo: los trabajos de la ficha no alimentan sólo
la tabla de 5 filas. Alimentan también los tres contadores, la línea de tiempo
—que hoy muestra **todo** el historial— y el modal de emisión, que necesita los
trabajos elegibles para armar el documento. Paginar del lado del servidor
obliga a partir eso en tres consultas más y a tocar seis archivos de la pantalla
más compleja de la aplicación, incluida la emisión de facturas.

Queda anotado cómo se haría el día que haga falta: `car:get-by-license` sin
`jobs` y con los tres contadores resueltos en SQL; un `car:jobs` paginado con
filtro y orden para la tabla; una consulta liviana para la línea de tiempo
—`id`, descripción, estado y fecha, que es lo único que pinta— y otra de
trabajos elegibles para el documento, que en la práctica son unos pocos.

Y si algo va a doler antes que el IPC en esa pantalla, es la línea de tiempo:
pinta un nodo por trabajo **y** uno por actualización de kilometraje, sin tope.
Con 200 trabajos son 400 nodos en el DOM. Acotarla es un cambio de producto, no
de rendimiento, así que no se hace por cuenta propia.

### G2 · 🟡 Listar recordatorios escribe en la base

**[a testear]** · `electron/DataBase/serviceReminders.service.ts` →
`reactivateExpiredSnoozes`

Se llama al principio de `service:list`, de `service:by-car` y de
`countDueReminders` —y `countDueReminders` lo llaman el badge de la barra y la
notificación de arranque—. Son **dos `UPDATE`** por cada una de esas lecturas,
casi siempre sin filas que tocar.

Que una lectura escriba no es gratis: toma el bloqueo de escritura, invalida
páginas y ensucia el archivo. Y son dos sentencias que podrían ser una.

Mejor: correrlo una vez al arrancar y después en un intervalo, no en cada lectura.

**Resuelto así**, y las dos sentencias pasaron a ser una: los dos casos —plazo
vencido y postergado sin fecha— son la misma condición con un `OR`.

El barrido corre al arrancar, **antes** de contar y de abrir la ventana —el badge
y la notificación tienen que ver lo que venció mientras la aplicación estaba
cerrada—, y después cada hora. Una hora es holgado porque postergar se mide en
días: el desfase máximo es irrelevante frente a lo que se está representando.

Los tests cubren las dos mitades, y la segunda es la que importa: con un
postergado vencido a mano, listar, contar y abrir la ficha de un vehículo dejan
la base **byte por byte igual**. Antes cualquiera de las tres lo reactivaba de
paso.

### G3 · 🟡 `getServiceSettings` consulta la base varias veces por request

**[a testear]** · `electron/DataBase/serviceReminders.service.ts`

Cada llamada hace un `find` sobre `app_setting`. En `service:list` se llama una vez
directamente y otra vez por cada `evaluate()`; en `service:snooze` y compañía, otra
vez más. Es configuración que cambia una vez al año: se cachea en memoria y se
invalida al guardarla.

**Resuelto así**, invalidando en los dos lugares donde puede cambiar: al
guardarla y al **reemplazar la base entera**. El segundo no estaba en la tarea y
es el que muerde: importar un respaldo trae otra configuración en el archivo, y
sin invalidar la aplicación seguiría evaluando los vencimientos con la del
archivo anterior.

Lo cacheado se devuelve congelado. Lo comparten todos los que lo piden, así que
un descuido que lo modifique se llevaría puesta la configuración de todo el
proceso hasta el reinicio: es la clase de error que aparece meses después y no
se puede reproducir.

Que esté cacheada se prueba por su consecuencia observable: se cambia el valor
por SQL, por detrás, y la función sigue devolviendo el anterior.

### G4 · ⚪ `service:list` carga el historial de kilometraje completo de cada vehículo

**[medido, no se cambia]** · `electron/DataBase/Endpoints/service.endpoints.ts` → `toView`

`toView` calcula `estimateKmPerDay(reminder.car?.kmHistory)` para no mandar el
historial por IPC —bien pensado— pero el `innerJoinAndSelect("reminder.car")`
**sí lo trae de la base**, entero, para cada fila de la página. `kmHistory` crece
con cada actualización de kilometraje.

Se resuelve seleccionando las columnas que hacen falta en vez de la entidad
completa, como ya hace `client:get-all` con `addSelect(["cars.id", "cars.licensePlate"])`.

**Medido, y no se cambia.** Baja de 🟡 a ⚪.

El detalle que la tarea pasa por alto es que `kmHistory` **sí hace falta**:
`estimateKmPerDay` lo necesita para encontrar el primero y el último registro.
No es una columna que sobre, es una que se usa y no se manda.

Y la página son ocho filas, no la tabla entera. Con 300 vehículos de 200
registros de kilometraje cada uno, la misma consulta con y sin la columna:

| consulta      | por página |
| ------------- | ---------- |
| sin kmHistory | 0,22 ms    |
| con kmHistory | 0,40 ms    |

Dieciocho centésimas de milisegundo, contra perder la estimación de kilómetros
por día o inventar una forma de calcularla en SQL sobre un JSON.

(`service:list` completo da 2,62 ms con esos mismos 300 vehículos.)

### G5 · 🟡 `document:list` ordena por una columna sin índice

**[a testear]** · `electron/DataBase/Entities/document.entity.ts`

El único índice es el único compuesto `(type, number)`. El listado ordena por
`createdAt DESC, number DESC`, así que hace un recorrido completo más un ordenado
en memoria. Hoy son pocos documentos; crecen uno por presupuesto emitido y no se
borran nunca por diseño.

**Resuelto**: índice `(createdAt, number)`, con `number` adentro para que el
desempate también salga del índice. Medido con 20 000 documentos, el listado
pasa de **2,1 ms a 0,46 ms**.

Son milisegundos, sí. Lo que lo hace valer la pena es que la tabla sólo crece
—es lo que significa un correlativo— y que el arreglo es un `CREATE INDEX` sin
tocar una línea de código.

El test no se conforma con que el índice exista: mira el `EXPLAIN QUERY PLAN` y
comprueba que la consulta lo **usa** y que ya no hay ordenado en memoria. Un
índice que el planificador no elige no compra nada.

### G6 · ⚪ Consultas que traen relaciones que no se usan

**[a testear]** · `electron/DataBase/Endpoints/client.endpoints.ts`

- `client:toggle-active` carga `relations: { cars: true }` y no toca los autos.
- `client:update` hace un `findOne` extra **después** de guardar sólo para
  devolver el cliente con sus autos.
- `client:find-by-name` trae `cars.jobs` completos para mostrar **un número** por
  vehículo; alcanzaría con un conteo.

**Los dos primeros, resueltos.** `client:toggle-active` deja de cargar los autos
—toca un booleano y no los mira, y quien llama tampoco: usa el `status` y
recarga el listado—. `client:update` carga los autos en el `findOne` que ya
hacía y devuelve lo guardado: la misma consulta corrida de lugar, no una más.

**El tercero no**, porque la premisa no se sostiene. La ficha del cliente no
muestra "un número por vehículo": con esos trabajos calcula el resumen de
actividad —trabajos activos, facturado, fecha del último—, arma la línea de
tiempo cruzada de todos sus vehículos y alimenta el documento consolidado, que
necesita los elegibles para que el usuario elija. Es el mismo caso que **G1**, y
la misma conclusión.

### G7 · ⚪ El respaldo diario retrasa la apertura de la ventana

**[a testear]** · `electron/main.ts` → `createWindow`

El orden del arranque es: base → respaldo diario (`VACUUM INTO` de toda la base) →
conteo de recordatorios → recién ahí se crea la ventana. Con la base chica no se
nota; con una base grande, el usuario mira la pantalla de carga mientras se copia
un archivo que no necesita para empezar a trabajar.

El respaldo es best-effort por diseño: puede correr después de mostrar la ventana.

**Resuelto**, y con un detalle que no era obvio: no alcanzaba con dejar de
esperarlo antes de crear la ventana. SQLite serializa, así que las primeras
consultas del renderer se habrían puesto en la cola detrás del `VACUUM`. El
respaldo arranca en `ready-to-show`, o sea con la ventana ya a la vista.

---

## Sprint H — Huecos de producto

Cosas que la aplicación no hace y que un taller va a necesitar. No son bugs: son
decisiones que todavía no se tomaron.

### H1 · 🟠 Una factura emitida no se puede volver a imprimir

**[a testear]** · `electron/DataBase/Entities/document.entity.ts`

`Document` guarda tipo, número, patente, nombre del titular y total. **No guarda
los renglones**: ni los trabajos, ni los repuestos, ni las observaciones.

Consecuencia: el historial dice que se emitió `FAC-000007` por $89.000, pero **no
hay forma de volver a generar ese PDF**. Si el cliente lo pierde, o se cerró el
navegador antes de guardarlo, el documento no se puede reproducir. Y si mientras
tanto se editó o borró el trabajo, la información original ya no existe en ningún
lado.

Para un documento que es un comprobante, guardar el snapshot completo de lo que se
imprimió no es una mejora: es la razón de existir de la tabla.

**Resuelto.** El documento guarda la copia de lo que se imprimió y el historial
tiene un botón para volver a generarlo. Reimprimir **no emite nada**: no toma un
número nuevo ni toca la base, sólo vuelve a dibujar lo guardado y pregunta dónde
ponerlo.

Se guarda **sólo lo que sale en el papel**: los renglones con sus repuestos, los
totales, el vehículo y el titular. Nada de `kmHistory`, ni las notas internas del
taller, ni los trabajos que no entraron. Guardar de más ensucia para siempre una
tabla que no se borra nunca, y guardar cosas que el documento no muestra invita a
que alguien las lea creyendo que son parte del comprobante.

Dos decisiones que conviene dejar escritas:

- **Emitir sin la copia se rechaza.** Un documento sin ella es un número en el
  historial que no se puede reimprimir, o sea el agujero que esto vino a tapar.
- **Los documentos viejos no se reconstruyen.** La columna es `nullable` y se
  queda así: armarles una copia desde los trabajos de hoy daría un papel distinto
  del que firmó el cliente, que es peor que no tener ninguno. El historial los
  distingue y el botón explica por qué está deshabilitado.

La copia tiene tope de tamaño, por la misma razón: la tabla no se borra nunca y
una copia por documento se acumula para siempre.

El listado no arrastra las copias —veinte documentos serían veinte copias
completas para decidir si mostrar un botón—: trae un `hasSnapshot` y la copia se
pide sólo al reimprimir.

Verificado contra la aplicación real: emitir guarda la copia entera, releerla
devuelve el renglón, el total y el titular, y emitir sin copia se rechaza.

### H2 · 🟠 Un documento consolidado no aparece en el historial de ningún vehículo

**[a testear]** · `src/Hooks/useBudgetPdf.ts`,
`electron/DataBase/Endpoints/document.endpoints.ts`

En el consolidado de un cliente, `licensePlate` se guarda como `"AB123CD, XY456ZW"`.
`document:list` filtra por patente con **igualdad exacta**, así que ese documento
no sale en el historial de ninguno de los dos autos: sólo en el listado general.

**Resuelto** sin cambiar el esquema: el filtro pasó de igualdad a **pertenencia a
la lista**. Se rodean la columna y el término con el separador y se comparan, así
que `AB123CD` encuentra la lista que lo contiene.

La forma fácil de arreglarlo —un `LIKE '%patente%'`— trae el problema de al lado:
haría que buscar `AB123` devolviera los documentos de `AB123CD`. Hay un caso que
lo fija.

### H3 · 🟠 El correlativo se puede saltear sin que nadie se entere

**[pendiente]** · varios

Ver **E4**. Además del bug, falta lo de producto: **no hay forma de detectar un
hueco**. Ni una pantalla que lo muestre, ni un aviso. Para una numeración
correlativa que existe justamente para no tener huecos, corresponde al menos
poder verificarla.

### H4 · 🟠 No se puede corregir un trabajo mal cargado

**[pendiente]** · `electron/DataBase/Types/car.dto.ts` → `UpdateJobDto`

`UpdateJobDto` permite cambiar `status`, `price`, `parts`, `notes`, `clientNote` e
`isService`. **No permite cambiar `description` ni `isThirdParty`.**

Escenario: se carga "Cambio de correa de distribucion" con un error de tipeo y esa
descripción sale impresa en el presupuesto del cliente. No hay forma de
corregirla; hay que borrar el trabajo y cargarlo de nuevo.

Junto con **B4** (no se puede editar marca/modelo/año del vehículo), el patrón es
claro: la aplicación sabe crear y sabe borrar, pero **corregir un error de carga
casi siempre implica borrar y rehacer**.

### H5 · 🟠 No hay forma de deshacer un borrado

**[pendiente]** · todos los `delete`

Borrar un vehículo se lleva sus trabajos, su historial de kilometraje y su
recordatorio. Borrar un cliente se lleva además **todos sus vehículos**. Es
irreversible salvo restaurando un respaldo entero, lo que descarta todo lo hecho
desde entonces.

Los clientes ya tienen `isActive` para la baja lógica; los vehículos no tienen
equivalente. Un borrado lógico con papelera resolvería el caso real —"me equivoqué
de auto"— sin obligar a elegir entre perder un dato y perder un día.

### H6 · 🟡 No hay búsqueda ni filtro en el historial de documentos

**[pendiente]** · `src/Components/DocumentHistory.tsx`

`document:list` acepta `type`, `licensePlate` y `limit` (tope 100). No hay
búsqueda por nombre de cliente, ni rango de fechas, ni paginado. Con dos años de
presupuestos, el historial es una lista de 100 y nada más.

### H7 · 🟡 Los intervalos de service por vehículo no se pueden configurar

**[pendiente]** · `electron/DataBase/Entities/car.entity.ts`

`Car.serviceIntervalMonths` y `Car.serviceIntervalKm` existen en la entidad, los
usa `computeNextService`, y **ninguna pantalla los edita**. La funcionalidad está
implementada al 90% y es inalcanzable: hoy todos los vehículos usan los intervalos
generales.

Es justo el caso que el comentario de la entidad describe —"distinguir un auto de
uso intensivo de uno de fin de semana"— y no se puede hacer.

### H8 · ⚪ Los respaldos exportados a mano no aparecen en la lista de restauración

**[pendiente]** · `electron/DataBase/backups.ts` → `listBackups`

`listBackups` reconoce sólo el patrón `taller_<AAAA-MM-DD>.db`. El nombre que
propone la exportación manual es `taller_backup_<fecha>.db`, que **no matchea**:
si el usuario lo guarda en la carpeta de respaldos esperando verlo ahí, no
aparece. Además la fecha que muestra la pantalla sale del **nombre del archivo**,
no de su fecha real.

---

## Sprint I — Interfaz y accesibilidad

### I1 · 🟠 Ninguno de los 24 botones de sólo ícono tiene nombre accesible

**[pendiente]** · varios componentes

Hay **24 usos de `isIconOnly`** en la interfaz y **ninguno** declara `aria-label`
en el mismo elemento. Un botón cuyo único contenido es un `<svg>` no tiene texto:
para un lector de pantalla es "botón", sin más.

Afecta a las acciones más habituales —borrar, refrescar, editar, emitir— y también
a las pruebas: hoy no se puede escribir
`getByRole("button", { name: /eliminar/i })` para la mitad de la interfaz, que es
la forma correcta de testear.

Muchos tienen `Tooltip`, que ayuda con el mouse y no con el teclado.

### I2 · 🟠 El documento se declara en inglés

**[pendiente]** · `index.html`

`<html lang="en">` en una aplicación íntegramente en castellano. Los lectores de
pantalla la van a leer con pronunciación inglesa, y los correctores del navegador
usan el diccionario equivocado. Es un atributo.

### I3 · 🟡 El `ErrorBoundary` esconde el motivo justo cuando hace falta

**[pendiente]** · `src/Pages/Components/ErrorBoundary.tsx`

El detalle técnico se muestra sólo con `import.meta.env.DEV`. En producción el
usuario ve "Ocurrió un error inesperado" y nada más, y como tampoco queda en los
logs (**E1**), la información se pierde del todo.

No hace falta mostrarle un stack trace: alcanza con un identificador de error que
pueda dictar por teléfono y que esté en el log.

### I4 · 🟡 `removeAllListeners` del updater es un martillo

**[pendiente]** · `electron/preload.ts`

Los `onUpdate*` no devuelven función de baja; la limpieza es
`removeAllListeners()`, que borra **todos** los listeners de esos canales, sean de
quien sean. Hoy el único consumidor es el `Header`, así que funciona. El día que
otra pantalla escuche uno de esos canales, desmontar el Header la deja sorda sin
ningún error.

El patrón correcto ya está en el mismo archivo: `onDataChanged` devuelve su propia
función de baja.

### I5 · ⚪ `onUpdateNotAvailable` y `onDownloaded` le pasan el evento IPC al callback

**[pendiente]** · `electron/preload.ts`

Mientras `onUpdateAvailable`, `onProgress` y `onError` envuelven el callback para
pasar sólo los datos, estos dos registran el callback directo, así que reciben
`(event, ...args)`. Hoy no molesta porque no usan argumentos, pero es una
inconsistencia que filtra el objeto del evento al renderer.

### I6 · ⚪ Los repuestos no se pueden editar ni se detectan repetidos

**[pendiente]** · `src/Components/Parts/PartsEditor.tsx`

Sólo agregar y borrar: corregir el precio de un repuesto obliga a borrarlo y
volver a cargarlo. Tampoco avisa si se agrega dos veces el mismo nombre, ni hay
tope de precio.

---

## Sprint J — Tests

Hay 145 tests y pasan todos. El problema no es la cantidad, es **dónde están**.

| Capa                           | Archivos | Con test |
| ------------------------------ | -------- | -------- |
| Utilidades puras (`src/Utils`) | 8        | **7**    |
| Componentes (`src/Components`) | ~40      | 3        |
| Endpoints IPC (`electron`)     | 8        | **0**    |
| Store Redux (`src/Store`)      | 5        | **0**    |
| Hooks (`src/Hooks`)            | 10       | **0**    |
| Migraciones                    | 11       | **0**    |

Lo que está probado son los módulos puros, que son los que menos se rompen. **Los
ocho archivos de endpoints —donde vive toda la lógica de negocio y donde están 10
de los 14 bugs 🔴 de este plan— no tienen una sola prueba.**

Y no es que sean difíciles de probar: el proyecto ya tomó la decisión de diseño
que lo permite (los módulos de dominio reciben el `EntityManager` por parámetro) y
`dashboardStats.test.ts` demuestra que funciona.

### J1 · 🟡 Ninguna prueba sobre los endpoints IPC

**[pendiente]** · `electron/DataBase/Endpoints/*`

Prioridad por riesgo: `car:create` (transacción + titular + recordatorio),
`car:add-job` y `car:update-job` (transacción + cierre de service),
`service:save` (donde están A2, A3 y A4), `document:issue` (correlativo),
`client:delete` (borra en cascada los vehículos).

Se pueden ejercitar contra una base SQLite en memoria o contra una copia, como ya
hace `dashboardStats.test.ts`.

### J2 · 🟡 Ninguna prueba sobre las migraciones

**[pendiente]** · `electron/DataBase/Migrations/*`

Son 11 migraciones que **reescriben datos del usuario**, y ninguna tiene prueba.
`SimplifyServiceType` colapsa recordatorios y borra una columna;
`NormalizeJobDates` reescribe fechas con `strftime` —con la trampa documentada de
que devuelve `NULL` ante un texto que no entiende y puede vaciar una columna
`NOT NULL`—.

El patrón razonable: armar la base en el esquema anterior, insertar los casos
raros, correr la migración y verificar el resultado. Es lo que se hizo a mano
contra la base real; hay que dejarlo escrito.

### J3 · 🟡 Ninguna prueba sobre el store ni los thunks

**[pendiente]** · `src/Store/*`

El contrato "los thunks **resuelven** con `status: failed`" está documentado en
`CLAUDE.md` como algo que ya se pagó una vez —una pantalla mostró "guardado con
éxito" sin haber guardado—. Justamente ese contrato no tiene ninguna prueba que lo
sostenga.

### J4 · 🟡 Los hooks de consulta no tienen prueba

**[pendiente]** · `src/Hooks/*`

`useCarQueries` (273 renglones, con los `catch (error: any)` de **A10**),
`useBudgetPdf` (el flujo de emisión, con **E4**) y `useFormGuard` (con el bug
**A8**) son los tres que más lo justifican: cada uno tiene un bug de este plan que
una prueba habría atrapado.

### J5 · 🟡 No hay ninguna prueba de extremo a extremo

**[pendiente]**

Se evaluó y se descartó en su momento (ver la nota del 2026-08-16 en el plan v1) y
la decisión sigue siendo razonable. Pero conviene revisarla ahora que hay **28
tareas marcadas "a testear" que nadie ejercitó**: un puñado de recorridos
completos —cargar un auto, cargar un trabajo, emitir un presupuesto, cerrar un
service— cubriría más que cualquier prueba unitaria nueva.

### J6 · ⚪ No se mide la cobertura

**[pendiente]** · `vitest.config.ts`

No hay `coverage` configurado, así que la tabla de arriba la armé contando
archivos a mano. Con `@vitest/coverage-v8` y un umbral mínimo, la conversación
sobre qué falta probar deja de ser una opinión.

### J7 · ⚪ Los tests no cubren los caminos de error del backend

**[pendiente]**

Ni un test comprueba qué pasa cuando la base está bloqueada, cuando el disco está
lleno, cuando una transacción falla a mitad o cuando el IPC rechaza. Son
exactamente los caminos donde el manejo de errores importa, y donde el plan v1
puso mucho trabajo que hoy nadie verifica.

---

## Sprint K — Empaquetado, metadatos y mantenimiento

### K1 · 🟠 La carpeta de salida del instalador es una ruta absoluta de una máquina

**[pendiente]** · `electron-builder.json5`

```json5
directories: {
  output: "C:/Users/ASUS/Downloads/MecanicaDealbera-Release",
}
```

Una ruta absoluta con un nombre de usuario adentro, en un archivo versionado.
`npm run build` en cualquier otra máquina escribe en una ruta que no existe. El
flujo de publicación funciona **sólo porque la pisa** con
`--config.directories.output=release`.

Corresponde `output: "release"` (relativo, ignorado por git) y que quien quiera
otra carpeta la pase por parámetro.

### K2 · 🟡 `package.json` no declara autor ni licencia

**[pendiente]** · `package.json`

Faltan `author` y `license`. No es cosmético: electron-builder **avisa durante el
build** (`author is missed in the package.json`) y usa ese campo para el nombre
del publicador en las propiedades del ejecutable de Windows —que es lo que ve el
usuario cuando SmartScreen le pregunta si confía—.

### K3 · 🟡 Se empaqueta para macOS y Linux sin que nadie lo haya probado

**[pendiente]** · `electron-builder.json5`

Hay objetivos `mac` (dmg) y `linux` (AppImage) configurados. Pero el código asume
Windows en varios lados —`app.getPath("documents")` para los respaldos, el traslado
desde `Documentos`, `signtool`— y no hay ninguna prueba en esas plataformas.

Un artefacto que se puede construir y nunca se probó es peor que no tenerlo: da a
entender que está soportado. O se prueba, o se saca hasta que se decida.

### K4 · 🟡 El ícono de Windows es un PNG

**[pendiente]** · `electron-builder.json5`

`icon: "public/logo-grande.png"`. electron-builder lo convierte, pero un `.ico`
real con varias resoluciones (16, 32, 48, 256) se ve mejor en la barra de tareas y
en el explorador, que es donde el usuario lo mira todos los días.

### K5 · 🟡 No hay forma de saber qué cambió entre versiones

**[pendiente]**

No hay `CHANGELOG.md`, y los releases de GitHub se publican sin notas. La
aplicación **muestra `info.releaseNotes`** en el modal de actualización —el código
está escrito— y hoy recibe siempre vacío. El usuario ve "hay una versión nueva" sin
una palabra sobre qué trae.

### K6 · ⚪ `.gitignore` no cubre la carpeta de salida del build

**[pendiente]** · `.gitignore`

Ignora `dist`, `dist-electron` y `data`, pero no `release/` —que es adonde escribe
el flujo de publicación— ni `coverage/`. Hoy no molesta porque el build local
escribe en `Downloads` (**K1**); al arreglar K1, empieza a molestar.

### K7 · ⚪ No hay plantilla de reporte ni guía de contribución

**[pendiente]** · `.github/`

Para un proyecto de una persona es opinable. Pero como el propio `CLAUDE.md` dice,
"cada regla costó una sesión de depuración": un `CONTRIBUTING.md` corto que apunte
a `CLAUDE.md` y al plan evita que la próxima persona —o la próxima sesión— tenga
que redescubrirlas.

---

## Cómo se hizo esta revisión

Se leyeron completos los 45 archivos de `electron/` y los archivos de `src/` con
lógica: hooks, store, utilidades, formularios, las páginas grandes y los
componentes con reglas propias.

**Lo que se comprobó ejecutando, en vez de suponerlo:**

- Las claves foráneas **están activas** (`PRAGMA foreign_keys = 1`), así que el
  borrado en cascada de trabajos y recordatorios funciona de verdad. Era una
  sospecha razonable —SQLite las trae apagadas por defecto— y resultó infundada:
  la activa el driver de TypeORM.
- El `journal_mode` es `delete`, no WAL. Eso **baja** la gravedad de **E8** de
  "corrupción probable" a "suposición no escrita".
- `synchronous = 2` (FULL) y `busy_timeout = 5000`: la configuración de durabilidad
  es la correcta.
- La FK de `job` declara `ON DELETE CASCADE` en el esquema real, no sólo en la
  entidad.
- `class-validator` 0.15 aplica bien los mensajes propios, la validación anidada
  del titular y el `@Transform` de la patente.
- Que `window.ipcRenderer` **no lo usa nadie** salvo el código de ejemplo de la
  plantilla (**C1**), y que `ensureReminder` se llama **en un solo lugar**
  (**D4**): las dos cosas se verificaron buscando en todo el proyecto antes de
  anotarlas.

**Lo que NO se revisó**, y conviene decirlo:

- El dibujo de los PDF renglón por renglón (`budgetPdf.ts`, 499 líneas). Tiene tres
  archivos de test propios.
- El detalle visual de cada pantalla. Esta revisión es de código; **no reemplaza
  usar la aplicación**, que sigue siendo lo que le falta a las 28 tareas del plan
  v1 marcadas "a testear".
- Las 11 migraciones una por una. Se leyó qué hace cada una, no se auditó su SQL.

## Por dónde empezar

Si hubiera que elegir, el orden que más riesgo saca por unidad de trabajo:

1. **A1** — restaurar un respaldo viejo rompe la aplicación. Es el único bug de
   esta lista que se dispara justamente cuando algo ya salió mal.
2. **B1–B3** — aplicar los DTOs que ya existen. Es poco trabajo y cierra tres 🔴 de
   una vez.
3. **A2, A3, A4** — los tres de `service:save`, que se tocan entre sí.
4. **D1** — el índice único parcial: convierte A3 en algo que no puede volver a
   pasar.
5. **C1** — sacar el `ipcRenderer` genérico y el código muerto que lo sostiene.
6. **E1** — que un error del renderer llegue al log, antes de que haga falta.
7. **J1** — probar los endpoints. Sin esto, la próxima revisión encuentra lo mismo.
