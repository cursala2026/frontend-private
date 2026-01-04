import { Component, Input, Output, EventEmitter, signal, computed, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface TableColumn<T = any> {
  header: string;
  field?: keyof T;
  width?: string;
  render?: (row: T) => string | number;
  cellClass?: string | ((row: T) => string);
}

export interface TableAction<T = any> {
  label?: string;
  icon?: string;
  tooltip?: string;
  onClick: (row: T) => void;
  isLoading?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  class?: string;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableComponent<T = any> {
  private sanitizer = inject(DomSanitizer);

  private _data: T[] = [];
  private dataSignal = signal<T[]>([]);

  @Input() 
  set data(value: T[]) {
    this._data = value;
    this.dataSignal.set(value);
  }
  get data(): T[] {
    return this._data;
  }

  @Input() columns: TableColumn<T>[] = [];
  @Input() actions: TableAction<T>[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No hay datos disponibles';
  @Input() trackByField?: keyof T;
  @Input() pageSize = 10;
  @Input() searchable = true;
  @Input() searchPlaceholder = 'Buscar...';
  
  @Output() rowClick = new EventEmitter<T>();

  currentPage = signal(1);
  searchTerm = signal('');
  Math = Math; // Expose Math to template

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  filteredData = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const currentData = this.dataSignal();
    if (!term) return currentData;

    return currentData.filter(row => {
      return this.columns.some(column => {
        const value = this.getCellValue(row, column);
        return value?.toString().toLowerCase().includes(term);
      });
    });
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredData().length / this.pageSize);
  });

  paginatedData = computed(() => {
    const filtered = this.filteredData();
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return filtered.slice(start, end);
  });

  showPagination = computed(() => {
    return this.filteredData().length > this.pageSize;
  });

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1); // Reset to first page on search
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  getCellValue(row: T, column: TableColumn<T>): string | number {
    if (column.render) {
      return column.render(row);
    }
    if (column.field) {
      return row[column.field] as any;
    }
    return '';
  }

  getCellClass(row: T, column: TableColumn<T>): string {
    if (typeof column.cellClass === 'function') {
      return column.cellClass(row);
    }
    return column.cellClass || '';
  }

  trackByFn = (index: number, item: T): any => {
    if (this.trackByField && item[this.trackByField]) {
      return item[this.trackByField];
    }
    return index;
  };

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    // Mostrar máximo 5 números de página
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);
    
    // Ajustar si estamos cerca del inicio o final
    if (current <= 3) {
      end = Math.min(5, total);
    }
    if (current >= total - 2) {
      start = Math.max(1, total - 4);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  executeAction(action: TableAction<T>, row: T, event: Event): void {
    event.stopPropagation();
    const isDisabled = action.disabled ? action.disabled(row) : false;
    if (!isDisabled) {
      action.onClick(row);
    }
  }

  isActionLoading(action: TableAction<T>, row: T): boolean {
    return action.isLoading ? action.isLoading(row) : false;
  }

  isActionDisabled(action: TableAction<T>, row: T): boolean {
    return action.disabled ? action.disabled(row) : false;
  }
}
