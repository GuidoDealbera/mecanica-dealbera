export type TableColumnDef<T> = {
  /** Clave del dato en la entidad, o "actions" para columnas de acciones. */
  key: keyof T | "actions";
  label: string;
  width?: number;
  center?: boolean;
  sortable?: boolean;
};
