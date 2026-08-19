import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentationService } from '../../../core/services/documentation.service';
import { IDocument, DocumentCategory } from '../../../core/models/documentation.model';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user-role.enum';

type CategoryFilter = 'TODOS' | DocumentCategory;

@Component({
  selector: 'app-profesor-documentation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profesor-documentation.component.html',
})
export class ProfesorDocumentationComponent implements OnInit {
  private documentationService = inject(DocumentationService);
  private authService = inject(AuthService);

  readonly esProfesor = computed(() => this.authService.hasRole(UserRole.PROFESOR));
  readonly documents = this.documentationService.filteredDocuments;
  readonly signedContract = this.documentationService.signedContract;

  readonly categories: CategoryFilter[] = ['TODOS', 'PLANTILLAS', 'LOGOS', 'IMAGENES', 'OTROS'];
  readonly selectedCategory = signal<CategoryFilter>('TODOS');

  readonly searchTerm = signal<string>('');
  readonly extensions = ['TODAS', '.pdf', '.png', '.docx', '.xlsx', '.pptx', '.zip'];
  readonly selectedExtension = signal<string>('TODAS');

  ngOnInit(): void {
    this.documentationService.getDocuments().subscribe();
  }

  readonly visibleDocuments = computed<IDocument[]>(() => {
    const cat = this.selectedCategory();
    const docs = this.documents() || [];
    return cat === 'TODOS' ? docs : docs.filter((d) => d.category === cat);
  });

  readonly finalFilteredDocuments = computed<IDocument[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const ext = this.selectedExtension().toLowerCase();

    return this.visibleDocuments().filter((doc) => {
      const name = (doc.filename || doc.fileName || doc.originalFileName || doc.name || doc.title || '').toLowerCase();
      const matchesName = name.includes(term);
      const matchesExt = ext === 'todas' || name.endsWith(ext);
      return matchesName && matchesExt;
    });
  });

  selectCategory(cat: CategoryFilter): void {
    this.selectedCategory.set(cat);
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  selectExtension(ext: string): void {
    this.selectedExtension.set(ext);
  }

  formatSize(bytes?: number): string {
    if (!bytes && bytes !== 0) return '0 B';
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }

  fileExtension(filename?: string): string {
    if (!filename) return 'FILE';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
  }

  iconClasses(filename?: string): string {
    const ext = this.fileExtension(filename).toLowerCase();
    switch (ext) {
      case 'pdf': return 'bg-red-100 text-red-600';
      case 'doc':
      case 'docx': return 'bg-blue-100 text-blue-600';
      case 'xls':
      case 'xlsx': return 'bg-green-100 text-green-600';
      case 'ppt':
      case 'pptx': return 'bg-orange-100 text-orange-600';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif': return 'bg-purple-100 text-purple-600';
      case 'zip':
      case 'rar': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  async downloadFile(url?: string, filename?: string): Promise<void> {
    const targetUrl = url || '';
    const targetName = filename || 'documento';
    if (!targetUrl) return;

    try {
      const response = await fetch(targetUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = targetName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(targetUrl, '_blank');
    }
  }
}