# Mecánica Dealbera

> Sistema de gestión para talleres mecánicos. Lleva clientes, vehículos,
> trabajos, recordatorios de service y presupuestos en una aplicación de
> escritorio para Windows que **funciona sin internet** y guarda los datos en la
> propia PC del taller.

## Resumen en 30 segundos

|                           | En una línea                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qué es**                | Una aplicación de escritorio hecha a medida para un taller: fichas de clientes y autos, trabajos, avisos de service y PDF numerados.                        |
| **Qué problema resuelve** | Que el taller no pierda clientes por olvidar el próximo service, no pierda el historial de cada auto y no arme los presupuestos a mano.                     |
| **Qué le falta**          | Hoy está hecho a medida de un solo taller. Para venderlo hay que volverlo configurable, firmarlo, licenciarlo, documentarlo y validarlo con otros talleres. |

| Ficha          |                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Plataforma** | Windows x64. Instalador con actualización automática                                          |
| **Versión**    | 2.1.0                                                                                         |
| **Para quién** | Talleres mecánicos chicos de Argentina. Hoy está hecho a medida de uno: Mecánica Dealbera     |
| **Datos**      | Base SQLite local, respaldo diario, sin servidor ni cuenta                                    |
| **Tecnología** | Electron 44 · React 19 · TypeScript · HeroUI + Tailwind 4 · TypeORM + SQLite (better-sqlite3) |
| **Calidad**    | 423 pruebas automáticas; tipos, lint, formato, tests y build en cada push (CI)                |
| **Licencia**   | Propietaria (`UNLICENSED`). Autor: Guido Dealbera                                             |

**Contenido:** [1. Qué es](#1-qué-es) ·
[2. Qué problema soluciona](#2-qué-problema-soluciona) ·
[3. Qué falta para venderlo](#3-qué-falta-para-productizarlo-y-venderlo) ·
[4. Para desarrolladores](#4-para-desarrolladores)

---

## 1. Qué es

**En breve.** Mecánica Dealbera reemplaza la libreta, las planillas y la memoria
del mecánico por un único sistema. Se carga cada auto con su titular, se anotan
los trabajos que se le hacen y el sistema se ocupa de lo que suele olvidarse:
avisar cuándo toca el próximo service y emitir presupuestos y comprobantes
prolijos y numerados.

### 1.1 Qué permite hacer

| Módulo                          | Qué permite                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clientes**                    | Alta, edición, búsqueda y baja lógica (activo/inactivo). Ficha con todos sus vehículos e historial. Admite homónimos y teléfonos compartidos (una familia) y avisa del posible duplicado en vez de impedirlo.                                                                                  |
| **Vehículos**                   | Patente en formato viejo (`ABC123`) o Mercosur (`AB123CD`), mostrada con la tipografía de la chapa. Marca, modelo, año y kilometraje con historial y línea de tiempo. Se puede cambiar de titular y fijar intervalos de service propios (un auto de uso intensivo no es uno de fin de semana). |
| **Trabajos**                    | Descripción, mano de obra, repuestos (nombre y precio), marca de "trabajo de tercero" y de "es un service". Dos notas separadas: una **interna** (nunca se imprime) y una **observación para el cliente** (sí). Cuatro estados: sin comenzar → en progreso → completado → entregado.           |
| **Recordatorios de service**    | Al cerrar un service se programa el siguiente, por fecha, por kilómetros o ambos (por defecto 6 meses / 10.000 km, avisando 30 días / 1.000 km antes). Bandeja con filtros: postergar, marcar como avisado, dar por hecho, descartar. Abre WhatsApp con el titular.                            |
| **Presupuestos y comprobantes** | PDF con totales calculados (mano de obra, repuestos, terceros), numeración correlativa por tipo (`PRE-` / `FAC-`), validez de 15 días en presupuestos y un documento consolidado con todos los vehículos de un cliente. Se guarda copia de lo emitido para **reimprimirlo igual**.             |
| **Inicio**                      | Vehículos, clientes activos, trabajos en curso e ingresos del mes; gráficos de ingresos de los últimos 6 meses y de trabajos por estado; vehículos que requieren service; trabajos recientes.                                                                                                  |
| **Búsqueda y comodidad**        | Búsqueda global (`Ctrl+K`), atajos de teclado (`G` + letra para ir a una pantalla, `N` para un vehículo nuevo), tema claro y oscuro, interfaz en castellano.                                                                                                                                   |
| **Gestión de datos**            | Respaldo manual y automático, restauración, importación de una base, exportación a CSV (se abre en Excel), **papelera** con restauración, historial de documentos emitidos, control de huecos en la numeración y acceso a los registros de errores.                                            |

### 1.2 Un día normal en el taller

1. Entra un auto: se busca por patente (o se lo da de alta con su titular).
2. Se carga el trabajo con sus repuestos y se lo marca como service si lo es.
3. Se avanza el estado: en progreso → completado → entregado.
4. Se emite el presupuesto o el comprobante en PDF, con número correlativo.
5. Al cerrar el service, el sistema programa el siguiente. Cuando se acerca la
   fecha o el kilometraje aparece en **Recordatorios**, con una insignia en la
   barra y una notificación de Windows al abrir la aplicación.
6. Desde ahí se abre WhatsApp con el titular, se marca como avisado o se posterga.

### 1.3 Cómo está hecho

```
┌──────────────────────── Aplicación de escritorio (Electron) ────────────────────────┐
│  Interfaz  ·  React 19 + HeroUI    pantallas, gráficos, PDF (jsPDF)                 │
│       │  IPC: todo lo que entra se valida                                           │
│  Proceso principal  ·  Node        reglas de negocio, validación, respaldos         │
│       │  TypeORM                                                                    │
│  Base de datos  ·  SQLite local    un archivo en %APPDATA% + copias en Documentos   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

<details>
<summary><b>Por qué importa cada decisión</b></summary>

- **Local y sin servidor.** Sin cuota mensual, sin cuenta y sin dependencia de
  internet para trabajar. La red se usa para buscar actualizaciones y abrir el
  enlace de WhatsApp; además, la pantalla de carga pide una tipografía a Google,
  algo que el Sprint M prevé quitar.
- **Los datos están protegidos de sus propios cambios.** Antes de cada migración
  se saca una copia consistente (`VACUUM INTO`) y se verifica la integridad de la
  base; si no se puede copiar, la aplicación no arranca. Hay respaldo diario, y
  la papelera guarda lo borrado con todo lo que arrastra.
- **Las reglas se validan en el backend**, no sólo en el formulario. Un test
  recorre **todos** los canales IPC y comprueba que ninguno revienta ante un
  cuerpo inválido.
- **Los documentos emitidos no cambian.** Cada uno guarda una copia de lo que se
  imprimió; si después se edita o se borra el vehículo, el comprobante y la
  numeración quedan como salieron.
- **Actualización automática verificada.** El flujo de publicación arma el
  release en borrador y sólo lo publica si el `sha512` de `latest.yml` coincide
  con el instalador. Se aprendió publicando mal dos veces.
- **Electron endurecido.** Aislamiento de contexto, sin `nodeIntegration`,
  política de seguridad de contenido, sin navegación a sitios externos, una sola
  instancia abierta y aviso antes de cerrar con un formulario a medio llenar.
- **La lógica de negocio no depende de Electron.** Los servicios de
  recordatorios, estadísticas, respaldos y ubicación de datos reciben la
  conexión por parámetro. Es lo que permite probarlos contra una base real y, a
  futuro, moverlos a un servidor sin reescribirlos.

</details>

### 1.4 Estado actual (al 23/09/2026)

- **2.1.0 publicada.** Es el resultado de una revisión de 85 tareas: corrigió,
  entre otras cosas, un precio con punto o coma que se guardaba cien veces más
  caro o en cero.
- **Trabajo posterior sin publicar.** El Sprint L (alinear entidades con la base,
  endurecer una migración, castellano en los controles) está terminado en la
  rama `feat/news` y no llegó a ningún instalador.
- **Revisión de entrega pendiente.** El Sprint M reúne 45 tareas para dejarlo
  "listo para entregar al taller" y no se empezó. Cinco pueden dejar datos
  falsos (ver §3).
- **88 tareas marcadas "a testear".** Están hechas y con pruebas automáticas,
  pero falta usarlas en la aplicación real.

---

## 2. Qué problema soluciona

**En breve.** Un taller chico pierde plata y clientes por cosas que no son
mecánica: se olvida de avisar el service, no encuentra qué se le hizo a un auto
hace un año, arma los presupuestos a mano y depende de un cuaderno o de un
archivo que se puede perder.

### 2.1 Problema → solución

| El problema del taller                                                                           | Cómo lo resuelve                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| "¿Cuándo le toca el service a este auto?" Se olvida y el cliente fiel se va a otro lado.         | **Recordatorios automáticos** por fecha o kilómetros, con bandeja, notificación y WhatsApp al titular.      |
| "¿Qué le hicimos a esta camioneta?" Hay que revolver papeles o acordarse.                        | **Ficha del vehículo** con historial de trabajos, repuestos y kilometraje, y búsqueda global por patente.   |
| Los presupuestos se arman a mano: lentos, con errores de cuenta y sin numeración.                | **PDF con totales calculados**, numeración correlativa y copia reimprimible.                                |
| No se sabe cuánto se factura ni cuántos trabajos hay en curso.                                   | **Inicio** con indicadores y gráficos, al abrir la aplicación.                                              |
| La información vive en un cuaderno o una planilla que se rompe, se pisa o se pierde.             | **Base local con respaldo diario**, restaurable, con papelera para deshacer borrados y exportación a Excel. |
| Un cliente con varios autos, una familia con un solo teléfono, dos clientes con el mismo nombre. | Un modelo de datos que **lo admite** y avisa del posible duplicado en vez de bloquear.                      |
| Trabajos que se mandan a un tercero (tornería, chapa y pintura).                                 | Se **marcan aparte** y el documento los distingue en los subtotales.                                        |
| Depender de internet, de una cuenta o de una cuota mensual.                                      | **Funciona sin conexión**, con los datos en la PC del taller.                                               |

### 2.2 A quién le sirve hoy

Al dueño o encargado de un taller chico que trabaja desde **una PC con Windows**
y quiere ordenar clientes, autos, trabajos y avisos sin aprender un sistema
grande ni pagar una suscripción.

### 2.3 Qué no es (todavía)

- **No es facturación electrónica.** Los comprobantes no tienen CUIT, CAE ni
  punto de venta y no valen como factura ante ARCA.
- **No lleva stock, turnos ni cobros.** Registra precios, no pagos (seña, saldo,
  cuenta corriente).
- **No es multiusuario ni multi-PC.** No hay usuarios ni claves, y cada instalación
  tiene su propia base.

---

## 3. Qué falta para productizarlo y venderlo

**En breve.** Lo técnico (datos, respaldos, pruebas, actualizaciones) está por
encima de lo habitual para un sistema hecho a medida. Lo que separa a este
sistema de venderse es casi todo **lo que lo rodea**: que no diga "Dealbera" en
cada pantalla, que se instale sin alertas de Windows, que se pueda licenciar y
cobrar, que tenga manual y soporte, y que **otros talleres confirmen** que les
sirve lo mismo.

### 3.1 Primero, decidir el modelo

| Opción                               | A favor                                                                                                           | En contra                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **A. Licencia de escritorio**        | Aprovecha todo lo hecho. Sin servidores ni costo operativo. "Tus datos quedan en tu PC" es un argumento de venta. | Soporte instalación por instalación. Sin sincronización entre PCs. El respaldo depende del cliente. Hay que proteger la licencia. |
| **B. SaaS web para varios talleres** | Ingreso recurrente. Varias PC y usuarios son naturales. Respaldo y soporte centralizados.                         | Se reescribe la capa de datos y el IPC como API; hace falta autenticación, multi-taller, alojamiento y seguridad. Exige internet. |

**Recomendación:** empezar por **A** y no cerrar la puerta a **B**. Es el camino
más corto a una primera venta, y la lógica de negocio ya está desacoplada de
Electron (ver §1.3), así que migrarla a un servidor después es menos trabajo del
que parece.

### 3.2 Lo que falta

Esfuerzo aproximado para una sola persona: **S** días · **M** 1 a 3 semanas ·
**L** 1 a 2 meses · **XL** varios meses.

#### 🔴 Bloqueantes: sin esto no se puede vender

| #   | Qué falta                                    | Cómo está hoy                                                                                                                                                                                                                                                                                                                                                                                               | Esf.        |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **Marca y datos del taller configurables**   | El PDF imprime "MECÁNICA DEALBERA / Servicio técnico automotriz" fijo, sin dirección, teléfono, CUIT ni logo. La cabecera muestra un usuario fijo ("Horacio Dealbera · Mecánico") y la pantalla de carga lleva el escudo de un club. Hace falta una pantalla de **Ajustes** (se guardaría en `app_setting`, que ya viaja con el respaldo) y un nombre, ícono e identificador de aplicación parametrizables. | M           |
| 2   | **Claridad fiscal de los documentos**        | La "Factura de Trabajos" no es una factura válida. Mínimo: llamarla "Comprobante" con la leyenda "documento no válido como factura". Completo: integrar la facturación electrónica de ARCA, directa o con un proveedor.                                                                                                                                                                                     | S a XL      |
| 3   | **Cerrar la revisión de entrega (Sprint M)** | Cinco fallas dejan información falsa: con 12 o más trabajos el TOTAL cae fuera de la hoja; la reimpresión sale con la fecha del día; la facturación del mes "se muda" al editar un trabajo viejo; un repuesto tipeado y no agregado con "+" se pierde al guardar; restaurar promete que se puede deshacer pero la copia no aparece. Más 21 de comportamiento visible.                                       | M           |
| 4   | **Probarlo de verdad**                       | 88 tareas sin uso real y ninguna prueba de extremo a extremo sobre el instalador armado. Falta un **piloto** con el taller antes de ofrecerlo a otro.                                                                                                                                                                                                                                                       | M           |
| 5   | **Instalador firmado**                       | No está firmado: Windows SmartScreen avisa "editor desconocido" en cada instalación. Requiere un certificado de firma de código (OV o EV), una compra con verificación de identidad. El build ya lo toma del entorno sin tocar la configuración.                                                                                                                                                            | S + costo   |
| 6   | **Licencias y cobro**                        | Licencia `UNLICENSED` y nada de activación, prueba gratuita, vencimiento ni medio de pago. Hace falta una clave por taller (o una cuenta), un período de prueba, una forma de cobrar y otra de revocar.                                                                                                                                                                                                     | M a L       |
| 7   | **Distribución y actualizaciones propias**   | Las actualizaciones salen de los releases de un repositorio de GitHub. Para vender hay que elegir el canal (sitio de descarga, servidor o CDN propio) y decidir qué queda público.                                                                                                                                                                                                                          | S a M       |
| 8   | **Manual, primer uso e importación**         | No hay guía para el taller ni asistente de primer arranque. Tampoco forma de traer los clientes y autos que el taller ya tiene en una planilla: sólo existe la exportación a CSV.                                                                                                                                                                                                                           | M           |
| 9   | **Aspectos legales**                         | Licencia de uso (EULA), términos y política de privacidad. La aplicación guarda datos personales de terceros (nombre, teléfono, domicilio, correo): conviene revisar la Ley 25.326 de protección de datos personales con un abogado.                                                                                                                                                                        | S (trámite) |

#### 🟠 Necesarios para sostener a los clientes

| #   | Qué falta                   | Cómo está hoy                                                                                                                                                                                                                                 | Esf.  |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 10  | **Respaldo fuera de la PC** | Los respaldos están en Documentos, en la misma máquina: un disco roto se lleva todo junto. El diario sólo corre al abrir la aplicación y, si falla, nadie se entera. Falta copiar a USB, carpeta de red o nube, y avisar si no hubo respaldo. | M     |
| 11  | **Soporte y diagnóstico**   | No hay "Acerca de" ni versión visible. Los registros de errores son locales (hay un botón para abrir la carpeta). Falta "Copiar diagnóstico" y, opcional, un reporte de errores remoto.                                                       | S a M |
| 12  | **Varios usuarios y roles** | Quien abre la aplicación ve y hace todo, y nada registra quién hizo qué. Se pospuso en el plan original. Para un taller con empleados: PIN por usuario, roles (dueño, mecánico, caja) y registro de cambios.                                  | L     |
| 13  | **Datos menos rígidos**     | Lista de marcas cerrada (un Agrale no se puede cargar). Patentes sólo de auto argentino: no admite motos ni extranjeras. Textos con tratamiento mezclado (usted, tú y vos).                                                                   | S a M |
| 14  | **Compatibilidad**          | Sólo Windows x64: se retiraron macOS y Linux porque nadie los probó. Falta probar en Windows 10 y 11 limpios y en equipos modestos.                                                                                                           | S a M |
| 15  | **Más de una PC**           | Un taller con mostrador y oficina necesita ver los mismos datos desde dos máquinas. Hoy cada instalación tiene su base. Pide sincronización o un servidor local o en la nube, que ya se acerca al modelo B.                                   | XL    |

#### 🟡 Diferenciales: para competir, no para arrancar

| Función                                             | Hoy                                                           |
| --------------------------------------------------- | ------------------------------------------------------------- |
| **Cobros** (seña, saldo, cuenta corriente)          | Sólo se registra el precio, no los pagos.                     |
| **Orden de ingreso** del vehículo                   | No existe (estado del auto al llegar, observaciones, firma).  |
| **Turnos y agenda**                                 | No existe.                                                    |
| **Catálogo de trabajos, stock y proveedores**       | Cada trabajo y repuesto se escribe a mano.                    |
| **WhatsApp automático** con plantillas              | Abre un enlace con el mensaje armado y se envía a mano.       |
| **Reportes** (por mecánico, por tipo, rentabilidad) | Hay indicadores generales y un gráfico de ingresos.           |
| **Portal o app para el cliente**                    | No existe.                                                    |
| **Fotos del vehículo**                              | Se descartó antes; reevaluar según lo que pidan los clientes. |

### 3.3 Hoja de ruta sugerida

| Fase                     | Objetivo                                                | Qué incluye                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Validar y decidir** | Saber si hay mercado, antes de escribir más             | Mostrarlo a 2 o 3 talleres. Elegir modelo (§3.1) y precio. Resolver las cinco decisiones que siguen abiertas: datos del taller, nombre del documento, funciones nuevas, el escudo y criterios de negocio. |
| **1. Entregable**        | Que un taller lo use sin sustos                         | Cinco 🔴 del Sprint M primero y después el resto · #1 Ajustes · #2 comprobante no fiscal · #4 piloto.                                                                                                     |
| **2. Vendible**          | Que se pueda instalar, cobrar y soportar                | #5 firma · #6 licencias · #7 distribución · #8 manual e importación · #9 legal.                                                                                                                           |
| **3. Sostenible**        | Que los clientes no se pierdan datos ni se queden solos | #10 respaldo externo · #11 soporte · #12 usuarios y roles · #13 y #14 flexibilidad y compatibilidad.                                                                                                      |
| **4. Crecer**            | Lo que pidan los primeros clientes                      | Diferenciales, facturación ARCA (#2 completo) y más de una PC (#15).                                                                                                                                      |

> **La brecha más grande no es de código: es de validación.** Hoy el sistema
> responde a las necesidades de un taller. Antes de invertir en las fases 2 a 4
> conviene comprobar que otros talleres tienen el mismo problema y que pagarían
> por esta solución.

### 3.4 Lo que ya juega a favor

- **Una base técnica sólida:** migraciones con copia previa, respaldos
  consistentes, papelera, validación en todos los canales y 423 pruebas.
- **Un flujo de publicación a prueba de errores:** release en borrador,
  verificación del `sha512` y notas de versión que ve el usuario al actualizar.
- **Dominio de negocio desacoplado de Electron:** abarata una futura versión web.
- **Accesibilidad y castellano cuidados:** botones con nombre para lectores de
  pantalla, controles traducidos y modo claro y oscuro.
- **Argumento comercial propio:** funciona sin internet, sin cuota mensual y con
  los datos en la PC del cliente.

---

## 4. Para desarrolladores

```bash
npm install        # necesita el .npmrc del repo (ver CLAUDE.md)
npm run dev        # arranca la aplicación en modo desarrollo
npm run verify     # tipos → lint → formato → tests → build del renderer
npm run build      # arma el instalador (carpeta release/)
```

Para probar contra otra base sin tocar la real: `MECANICA_DATA_DIR=<carpeta>`.

```
electron/            proceso principal: base de datos, endpoints IPC, respaldos, actualizador
  DataBase/          entidades, migraciones, servicios y sus pruebas
src/                 interfaz: páginas, componentes, hooks, store y utilidades (PDF, recordatorios)
.github/workflows/   verify.yml (cada push) · release.yml (publica desde main)
```

Las ramas van `feat/*` → `develop` → `main`, y `main` **publica un release** con
cada push.

| Documento                                | Para qué sirve                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md)       | Cómo trabajar, verificar y publicar una versión                        |
| [CLAUDE.md](CLAUDE.md)                   | Convenciones y trampas: cada regla costó una sesión de depuración      |
| [CHANGELOG.md](CHANGELOG.md)             | Qué trae cada versión; la aplicación muestra estas notas al actualizar |
| [PLAN_MEJORAS_V2.md](PLAN_MEJORAS_V2.md) | La revisión completa: 136 tareas, con el Sprint M de entrega al final  |
| [PLAN_MEJORAS.md](PLAN_MEJORAS.md)       | El plan original de 33 mejoras y su continuación                       |
