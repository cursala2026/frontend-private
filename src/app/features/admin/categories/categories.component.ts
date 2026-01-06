import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig, ModalField } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalDataTableComponent],
  templateUrl: './categories.component.html'
})
export class AdminCategoriesComponent {
  categories = signal<any[]>([]);
  loading = signal<boolean>(false);
  searchTerm = signal<string>('');
  filteredCategories = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.categories();
    return this.categories().filter(c => {
      const name = String(c.name || '').toLowerCase();
      const desc = String(c.description || '').toLowerCase();
      return name.includes(term) || desc.includes(term);
    });
  });

  // Modal state
  isModalOpen = signal<boolean>(false);
  modalConfig!: ModalConfig;
  selectedCategory: any = null;

  private categoriesService = inject(CategoriesService);
  private infoService = inject(InfoService);

  tableConfig = {
    columns: [
      { key: '_id', label: 'ID', type: 'text', width: '15%' },
      { key: 'name', label: 'Nombre', type: 'text', sortable: true },
      { key: 'description', label: 'Descripción', type: 'text' }
    ],
    searchable: true,
    selectable: false,
    actions: [
      {
        label: 'Editar',
        handler: (row: any) => this.editCategory(row),
        class: 'btn-primary'
      },
      {
        label: 'Eliminar',
        handler: (row: any) => this.deleteCategory(row),
        class: 'btn-danger',
        requireConfirm: true,
        confirmTitle: (r: any) => `Eliminar categoría ${r.name}`,
        confirmMessage: (r: any) => `¿Seguro quieres eliminar la categoría "${r.name}"?`,
        confirmButtonText: 'Eliminar'
      }
    ]
  } as any;

  constructor() {
    this.loadCategories();
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term || '');
  }

  loadCategories(): void {
    this.loading.set(true);
    this.categoriesService.getCategories().subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.categories.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading categories', err);
        this.infoService.showError('Error al cargar categorías');
        this.categories.set([]);
        this.loading.set(false);
      }
    });
  }

  openCreate(): void {
    this.selectedCategory = null;
    this.modalConfig = this.buildModalConfig(null, true);
    this.isModalOpen.set(true);
  }

  editCategory(cat: any): void {
    this.selectedCategory = cat;
    this.modalConfig = this.buildModalConfig(cat, false);
    this.isModalOpen.set(true);
  }

  buildModalConfig(cat: any, isCreate: boolean): ModalConfig {
    const fields: ModalField[] = [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea', rows: 4 }
    ];

    return {
      title: isCreate ? 'Crear Categoría' : 'Editar Categoría',
      mode: isCreate ? 'create' : 'edit',
      fields,
      size: 'md'
    } as ModalConfig;
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.selectedCategory = null;
  }

  onModalSave(formData: any): void {
    const isCreate = !this.selectedCategory;

    if (isCreate) {
      this.categoriesService.createCategory(formData).subscribe({
        next: () => {
          this.infoService.showSuccess('Categoría creada');
          this.loadCategories();
          this.onModalClose();
        },
        error: (err) => {
          console.error('Error creating category', err);
          this.infoService.showError(err.error?.message || 'Error al crear categoría');
        }
      });
    } else {
      const id = this.selectedCategory._id || this.selectedCategory.id;
      this.categoriesService.updateCategory(id, formData).subscribe({
        next: () => {
          this.infoService.showSuccess('Categoría actualizada');
          this.loadCategories();
          this.onModalClose();
        },
        error: (err) => {
          console.error('Error updating category', err);
          this.infoService.showError(err.error?.message || 'Error al actualizar categoría');
        }
      });
    }
  }

  deleteCategory(row: any): void {
    const id = row._id || row.id;
    this.categoriesService.deleteCategory(id).subscribe({
      next: () => {
        this.infoService.showSuccess('Categoría eliminada');
        this.loadCategories();
      },
      error: (err) => {
        console.error('Error deleting category', err);
        this.infoService.showError(err.error?.message || 'Error al eliminar categoría');
      }
    });
  }
}
