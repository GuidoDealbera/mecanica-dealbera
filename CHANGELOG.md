# Historial de cambios

Qué trae cada versión, en lo que le cambia al taller. Los detalles técnicos y el
porqué de cada decisión están en [PLAN_MEJORAS_V2.md](PLAN_MEJORAS_V2.md) y en
los mensajes de los commits.

Esto no es decorativo: la aplicación **muestra estas notas** en el cartel de
actualización. Hasta ahora los releases se publicaban sin ninguna, así que el
usuario veía "hay una versión nueva" y ni una palabra de qué traía.

## 2.1.0

Una revisión completa del sistema: 85 tareas repartidas en once tandas de
trabajo. Lo que sigue es lo que se nota usándolo.

### Cosas que estaban mal y ahora no

- **Un precio con punto o coma se guardaba mal.** Escribir `1234.56` guardaba
  `123456` —cien veces más caro— y `1234,56` guardaba `0`. Pasaba en los tres
  campos de dinero: el precio del trabajo, el de cada repuesto y la edición
  rápida desde la lista.
- **El campo del titular del alta de vehículos no se podía tipear.** Está así
  desde la primera versión.
- **Emitir un documento podía quemar un número sin que saliera ningún PDF**, y
  quedaba un hueco en la numeración que nadie podía detectar.
- **Un error de pantalla no dejaba ningún rastro.** Justo el error que había que
  mirar era el único que no quedaba en los registros.
- **Exportar un respaldo encima de otro borraba el viejo antes** de saber si
  podía escribir el nuevo. Si fallaba a mitad, no quedaba ninguno.
- **Al cruzar la medianoche**, el dashboard seguía mostrando el mes anterior y
  los recordatorios que vencían no aparecían hasta que alguien cargara algo.

### Cosas que antes no se podían hacer

- **Volver a imprimir una factura o un presupuesto** ya emitido. Ahora se guarda
  copia de lo que se imprimió.
- **Recuperar lo que se borró.** Los vehículos y clientes borrados van a una
  papelera con todo lo que arrastran.
- **Corregir un trabajo mal cargado**: la descripción —que es la que sale
  impresa— y si lo hizo un tercero.
- **Buscar en el historial de documentos** por titular o patente, filtrar por
  fecha y pasar de página.
- **Revisar que la numeración no tenga huecos**, desde Gestión de datos.
- **Poner intervalos de service propios de un vehículo**, para distinguir un auto
  de uso intensivo de uno de fin de semana.
- **Corregir un repuesto** sin borrarlo y volver a cargarlo.
- **Elegir dónde guardar** el PDF de un documento, como ya se hacía con los
  respaldos.

### Cosas que cambian sin que se vean

- Dos clientes pueden llamarse igual, y una familia puede compartir un teléfono.
- La aplicación ya no se abre dos veces, avisa antes de cerrarse con un
  formulario a medio llenar, y arranca sin depender de internet.
- Los respaldos que exportás a mano ahora aparecen en la lista para restaurar.
- Los botones de la interfaz tienen nombre para los lectores de pantalla, y la
  aplicación se declara en castellano.

## 2.0.0

Primera versión de esta etapa. No hay notas: el historial arranca acá.
