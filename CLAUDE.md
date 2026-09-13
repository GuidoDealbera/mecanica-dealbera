# Convenciones del proyecto

Reglas que se aprendieron rompiendo cosas. Están acá porque ninguna es evidente
leyendo el código: cada una costó una sesión de depuración.

El plan de trabajo vivo está en [PLAN_MEJORAS.md](PLAN_MEJORAS.md), y la
revisión completa del proyecto —84 tareas, con los bugs primero— en
[PLAN_MEJORAS_V2.md](PLAN_MEJORAS_V2.md).

## Cómo se verifica

```bash
npm run verify     # tipos → lint → formato → tests → build del renderer
```

Corta en el primero que falla. Es lo mismo que ejecuta GitHub Actions en cada
push (`.github/workflows/verify.yml`). El instalador lo arma `release.yml` sólo
en `main`.

### Las ramas: `feat/*` → `develop` → `main`

`main` **es la rama de publicación**, no la de integración: `release.yml` se
dispara con cada push y arma y publica el instalador. Un merge por sprint son
cinco releases, y para el usuario instalado eso es una actualización cada vez
que alguien termina de trabajar.

Por eso el trabajo se integra en `develop`, que sale de `main`, y `main` recibe
un solo merge cuando hay algo para publicar de verdad —con la versión de
`package.json` subida, que es lo que decide si el usuario ve la actualización—.

`verify.yml` corre en todas las ramas menos `main`, así que integrar en
`develop` sigue estando verificado.

Para probar contra datos de verdad sin tocar la base del usuario:

```bash
MECANICA_DATA_DIR=<carpeta>  # dónde viven la base y los respaldos
MECANICA_LEGACY_DB=<archivo> # simula la base vieja, para probar el traslado
```

---

## Arquitectura

### El dominio compartido recibe el `EntityManager` por parámetro

`serviceReminders.service.ts`, `dashboardStats.service.ts`,
`migrationSafety.ts`, `backups.ts` y `dataLocation.ts` **no importan Electron**
ni `AppDataSource`: reciben el manager o las rutas que necesitan.

Dos razones, las dos prácticas: se pueden ejercitar contra una copia de la base
con un script, y se les puede pasar el manager de una transacción en curso —que
es lo que hace que cerrar un service y guardar el trabajo sean **un solo
hecho**—.

### Los thunks **resuelven** con `status: "failed"`

Sólo rechazan si falla la llamada IPC. Un rechazo de negocio llega como una
resolución exitosa, así que **una pantalla que sólo mira si la promesa resolvió
va a mostrar "guardado con éxito" sin haber guardado nada**. Ya pasó.

Para eso está `ensureSuccess` (`src/Utils/apiResponse.ts`): convierte la
respuesta en un `throw` con el mensaje del backend. Usarlo en la capa de
presentación y mostrar el motivo real, no un error genérico.

### Las reglas de negocio se validan en el backend

La interfaz puede anticiparlas para evitar un ida y vuelta, pero la validación
que cuenta es la del endpoint. Vale para las acciones de los recordatorios, la
elegibilidad de trabajos en un documento y los datos del próximo service.

### Todo lo que entra por IPC se valida igual

Un canal recibe lo que le manden, no lo que el formulario debería mandar. El
criterio, y no hay excepciones:

- **Un objeto** se valida con su DTO (`validateDto`). Si no existe el DTO, se
  escribe: la mitad de los que había estaban escritos y sin usar, y por eso se
  pudieron olvidar tres endpoints enteros.
- **Un identificador** (patente, id, nombre) pasa por `esIdentificador`. Sin eso
  va derecho a un `where` de TypeORM y revienta con "Undefined value encountered
  in property ... of a where condition", que es lo que ve el usuario.
- **Los parámetros de un listado** pasan por `comoParametros`. Con una cadena en
  vez de un objeto, `params.search.trim()` falla.

Lo que fija esto es
[`contratoDeEntrada.test.ts`](electron/DataBase/Endpoints/contratoDeEntrada.test.ts):
recorre **todos** los canales registrados —no una lista escrita a mano, así que
un endpoint nuevo entra solo— y comprueba que ninguno lance ante un cuerpo
inválido. La primera vez que se corrió encontró 19.

**Un cuerpo inválido se contesta, no se revienta.** Si el handler lanza,
`handleIpc` relanza y al renderer le llega el mensaje técnico crudo.

---

## Base de datos

### Paginar: `offset/limit` o `skip/take`, según los joins

La regla completa, con la evidencia medida, está arriba de `resolvePage()` en
[`electron/pagination.ts`](electron/pagination.ts). En corto:

- **Todos los joins `*-a-uno`** → `.offset().limit()`. Una consulta menos.
- **Algún join `a-muchos`** → `.skip().take()`. Con `offset/limit`, pedir 8
  clientes devuelve 4 y al último le faltan vehículos.

Y **el orden tiene que terminar en una columna única**. Si no, el desempate lo
decide el plan de ejecución y cambia solo al agregar un índice.

### `COUNT(*)`, no `COUNT(columna)`

El PK es un uuid, no el rowid de SQLite: nombrar la columna obliga a leer la
fila entera. Con un índice presente, el conteo por estado pasaba de 1,1 ms a
88 ms. Son equivalentes porque el PK nunca es NULL.

### El driver es `better-sqlite3`, y por qué importa la versión

Se pasó de `sqlite3` a `better-sqlite3` porque TypeORM 1.x eliminó el primero.
Las tres operaciones de las que depende el resguardo de datos se verificaron una
por una: `VACUUM INTO ?` con parámetro, `VACUUM INTO` literal y
`PRAGMA integrity_check`. Las tres andan igual.

### Copiar una base: `VACUUM INTO`, nunca `copyFileSync`

Copiar el archivo puede capturarlo a mitad de una escritura o sin el journal que
necesita. `VACUUM INTO` hace que el motor escriba una base nueva y consistente.
Se usa en la copia previa a migraciones, en el respaldo diario, en la
exportación manual y en el traslado de la base.

Y siempre: escribir a un temporal y renombrar al final. Un corte no puede dejar
un archivo con nombre de copia buena y contenido incompleto.

### Migrar toca datos: la red va antes

Las migraciones **no** corren al conectar. Las lanza `initializeDB`: copia
previa, migración, `integrity_check`. Si no se puede sacar la copia, la
aplicación no arranca.

Al escribir una migración que reescribe datos, filtrar por el resultado de la
conversión: `strftime` devuelve NULL ante un texto que no entiende, y sin ese
filtro se vacía una columna `NOT NULL`.

### Dónde viven los datos

- Base viva: `userData` (`%APPDATA%/mecanica-dealbera`). Fuera de la vista y del
  alcance de OneDrive, que puede bloquear el archivo mientras SQLite escribe.
- Respaldos: `Documentos/backups`. Ahí sí tienen que estar: son lo que el
  usuario busca para copiar a un pendrive.

---

## Interfaz

### HeroUI invierte las escalas numéricas entre temas

`text-success-300` se ve lavado en un tema y pesado en el otro. Usar **tokens
base con transparencia**: `text-success`, `bg-warning/10`, `border-primary/40`.

La fuente de verdad de la paleta es `hero.ts`.

### Un contenedor que scrollea no maquetea

Si el elemento con `overflow-y-auto` es además `flex flex-col`, sus hijos con
`overflow-hidden` tienen mínimo automático 0 y **se comprimen** en vez de
desbordar: las Cards quedan en una tira ilegible. El scroller va afuera y la
maquetación en un wrapper interno.

Por lo mismo, `min-h-0` en los hijos flex que tengan que poder achicarse.

Y ojo con el borde superior: un hijo pegado al borde de un contenedor que
recorta **pierde su sombra**. Por eso el cuerpo de `PageShell` lleva `pt-1`.

### `PageShell` es el contenedor estándar

Cabecera fija, cuerpo que scrollea, pie opcional. Las pantallas nuevas van con
`PageShell`, no con un `div` a mano.

### Corregir estado: durante el render, no en un efecto

`react-hooks/set-state-in-effect` está en **error**. Un `setState` síncrono
dentro de un efecto pinta una vez con el estado viejo y recién después lo
corrige.

Dos reemplazos ya escritos, y conviene usarlos antes que un efecto nuevo:

- **`clampPage`** (`src/Utils/pagination.ts`) para la página fuera de rango. El
  efecto que reemplazó retrocedía de a una página por vuelta: filtrar desde la
  página 6 a tres resultados encadenaba cinco consultas.
- **`useResetOn`** (`src/Hooks/useResetOn.ts`) para preparar campos al abrir un
  modal. Actualiza el estado durante el render, que es lo que documenta React:
  descarta el render en curso y vuelve a empezar sin llegar a pintar.

**Sólo vale para el estado del propio componente.** Avisarle a algo de afuera
—el `reset` de react-hook-form, el DOM, una suscripción— sigue yendo en un
efecto.

Traer datos también va en un efecto, y ahí la regla marca un falso positivo: lo
dispara el `setLoading(true)` sincrónico del arranque, que hace falta para no
mostrar el listado viejo mientras llega el nuevo. Esos ocho casos están
silenciados en el lugar con el motivo escrito. Si aparece otro, se silencia
igual: no bajar la regla.

### Limpiar las suscripciones IPC

`window.api.onDataChanged` y los listeners del auto-updater devuelven (o
necesitan) su baja. Sin eso se acumula un listener por montaje, y en desarrollo
`StrictMode` monta dos veces. Ya se pagó una vez con los avisos duplicados del
updater.

---

## Publicar

### Un release a medio subir rompe el auto-update en silencio

El flujo puede fallar **después** de subir el instalador y publicar el release.
Queda un release que en GitHub se ve perfecto y del que **ninguna aplicación
instalada se entera**, porque el updater lo primero que busca es `latest.yml`.
Pasó con la 2.0.0 y volvió a pasar con la 2.1.0.

Lo que hay que revisar, y en este orden:

1. Que el release tenga **tres** assets: `.exe`, `.exe.blockmap` y `latest.yml`.
2. Que el `size` de `latest.yml` coincida con el del `.exe` publicado.
3. Que el **sha512** coincida. Es el único que falla en silencio, y es
   perfectamente posible que no coincida si cada archivo quedó de un build
   distinto.

Eso ya no se revisa a mano: lo hace `release.yml`, y de ahí salen tres reglas
que **no hay que deshacer**, porque cada una tapa una forma distinta de romperlo.

- **El release se arma en borrador y se publica al final**, cuando los tres
  archivos están arriba y el sha512 dio bien. Un borrador no lo ve el updater,
  así que un subido a medias no engaña a nadie: queda invisible y el próximo
  intento lo reutiliza. Por eso `releaseType` es `"draft"`.
- **El release se crea antes de llamar a electron-builder.** Las subidas del
  instalador y del blockmap van **en paralelo** y cada una crea el release si no
  existe: en la 2.1.0 las dos salieron juntas, una ganó y la otra murió con un
  `422 Validation Failed` **después** de haber subido un archivo. Creándolo
  antes, electron-builder sólo sube.
- **El guard pregunta si el release está completo, no si existe.** Preguntar si
  existía fue peor que no preguntar: con el release roto ya creado, el flujo se
  negaba a repararlo porque "ya estaba publicado", y no había forma de
  reintentar sin borrarlo a mano. Un release sin `latest.yml` no está publicado
  para nadie.

El nombre no es problema: el `.exe` local lleva acento y espacios
(`Mecánica Dealbera-Windows-X-Setup.exe`) y `latest.yml` apunta al nombre
"seguro" (`mecanica-dealbera-setup-X.exe`), que es con el que electron-builder
sube. Coinciden.

---

## Trampas del entorno

### `ELECTRON_RUN_AS_NODE`

El host de extensiones de VS Code define esta variable. Cualquier binario de
Electron lanzado desde ahí corre como **Node puro**, y entonces el especificador
`electron` resuelve al paquete de npm —que exporta la ruta del binario, no la
API—: fallan todos los imports nombrados.

El error apunta al formato del módulo y manda a investigar Vite, el `type` del
`package.json` y la versión de Electron, que no tienen nada que ver. **Antes de
lanzar Electron desde un script, limpiar esa variable.**

### Finales de línea: LF siempre

El repositorio guarda LF, pero en Windows `core.autocrlf=true` convierte a CRLF
al hacer checkout. Da igual mientras se programa y rompe el CI: el runner
también es Windows, y `prettier --check` —que espera LF— rechaza **todos** los
archivos. Pasó: 162 archivos marcados, con tipos y lint pasando.

Lo resuelve `.gitattributes` con `* text=auto eol=lf`. No cambiarlo, y no
"arreglarlo" poniendo `endOfLine: "auto"` en Prettier: eso aceptaría CRLF en vez
de impedirlo.

### `npm install` falla sin `.npmrc`

`typeorm` declara `better-sqlite3@^8 … ^12` como peer y el proyecto usa la 13.
El `.npmrc` con `legacy-peer-deps=true` está para eso.

**No "arreglarlo" bajando a la 12.** La 12 descarga un binario atado al ABI de
Node, así que dentro de Electron falla con `NODE_MODULE_VERSION 137` y habría
que recompilarla en cada instalación para poder correr `npm run dev`. La 13 trae
binarios **N-API** dentro del paquete, estables entre Node y Electron. Se probó:
con la 12 la aplicación no abre la base.

---

## Estilo

- **Comentarios en español**, explicando _por qué_ y no _qué_. Si un comentario
  se limita a repetir el código, sobra; si documenta una decisión o una trampa,
  vale oro.
- **Mensajes de commit en español**, contando el problema antes que la solución.
  Sin `Co-Authored-By` y sin mencionar que se verificó con tests.
- Los módulos puros de `src/Utils/` son los únicos con tests hoy. Cualquier
  regla de negocio nueva conviene que viva ahí.
