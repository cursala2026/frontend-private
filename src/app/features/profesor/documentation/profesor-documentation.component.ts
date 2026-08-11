import { Component, computed, inject, signal } from '@angular/core';
import { DocumentationService } from '../../../core/services/documentation.service';
import { IDocument, DocumentCategory } from '../../../core/models/documentation.model';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user-role.enum';

//filtro de categorias esta sumando 'TODOS' ademas de las otras 4 categorias reales 
type CategoryFilter = 'TODOS' | DocumentCategory;

@Component({
  selector: 'app-profesor-documentation', // asi se llama la etiqueta del componente
  standalone: true,                        // componente independiente (sin NgModule)
  imports: [],
  templateUrl: './profesor-documentation.component.html', 
})
export class ProfesorDocumentationComponent {
  // aca inyectamos el service para pedirle los documentos
  private documentationService = inject(DocumentationService);
  private authService = inject(AuthService);
  // valida que el rol activo sea estrictamente profesor
  readonly esProfesor = computed(() => this.authService.hasRole(UserRole.PROFESOR));

  // documentos ya filtrados por rol + el contrato firmado (vienen del service)
  readonly documents = this.documentationService.filteredDocuments;
  readonly signedContract = this.documentationService.signedContract;

  // botones de categoria que se muestran arriba de la grilla
  readonly categories: CategoryFilter[] = ['TODOS', 'PLANTILLAS', 'LOGOS', 'IMAGENES', 'OTROS'];

  // categoria activa. Es una signal: al cambiarla, la vista se recalcula solas
  readonly selectedCategory = signal<CategoryFilter>('TODOS');


  //  lista final y computed = se recalcula solo, filtra en memoria 
  readonly visibleDocuments = computed<IDocument[]>(() => {
    const cat = this.selectedCategory();
    const docs = this.documents();
    return cat === 'TODOS' ? docs : docs.filter(d => d.category === cat);
  });

  // cambia la categoria activa
  selectCategory(cat: CategoryFilter): void {
    this.selectedCategory.set(cat);
  }

  // pasa bytes
  formatSize(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }

  fileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
  }

  // color del badge 
  iconClasses(filename: string): string {
    const ext = this.fileExtension(filename).toLowerCase();
    switch (ext) {
      case 'pdf': return 'bg-red-100 text-red-600';
      case 'doc': case 'docx': return 'bg-blue-100 text-blue-600';
      case 'xls': case 'xlsx': return 'bg-green-100 text-green-600';
      case 'ppt': case 'pptx': return 'bg-orange-100 text-orange-600';
      case 'png': case 'jpg': case 'jpeg': case 'gif': return 'bg-purple-100 text-purple-600';
      case 'zip': case 'rar': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }


  async downloadFile(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  }
}