export interface SelectOption {
  value: string;
  label: string;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'badge' | 'image' | 'actions' | 'switch' | 'select';
  formatter?: (value: any, row: any) => string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  imageShape?: 'circle' | 'rectangle'; // Forma de la imagen: círculo o rectángulo
  selectOptions?: SelectOption[]; // Opciones para select
  onChange?: (row: any, newValue: any) => void; // Callback para cambios en switch o select
  onClick?: (row: any) => void; // Acción al hacer click en la celda
  switchColor?: 'green' | 'blue' | 'purple' | 'indigo' | 'yellow' | 'red'; // Color del switch cuando está activo
}

export interface TableConfig {
  columns: TableColumn[];
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  pageSize?: number;
  searchable?: boolean;
  selectable?: boolean;
  actions?: TableAction[];
}

export interface TableAction {
  label: string;
  icon?: string;
  iconSvg?: string; // SVG path for Material Design icons
  handler: (row: any) => void;
  condition?: (row: any) => boolean;
  class?: string;
  requireConfirm?: boolean; // Si requiere confirmación antes de ejecutar
  confirmTitle?: string | ((row: any) => string); // Título del modal de confirmación
  confirmMessage?: string | ((row: any) => string); // Mensaje del modal de confirmación
  confirmButtonText?: string; // Texto del botón de confirmación
}

export interface PaginationData {
  page: number;
  page_size: number;
  total: number;
  totalPages: number;
}

export interface TableEvent {
  type: 'sort' | 'filter' | 'page' | 'search' | 'select' | 'action';
  data?: any;
}
