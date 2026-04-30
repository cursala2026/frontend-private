import { Component, Input, Output, EventEmitter, signal, effect, inject } from '@angular/core';

import { CoursesService } from '../../../core/services/courses.service';

@Component({
  selector: 'app-student-courses-view-modal',
  standalone: true,
  imports: [],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" (click)="onClose()"></div>
        <div class="flex min-h-full items-center justify-center p-2">
          <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all w-full max-w-md border border-gray-200">
            <!-- Header Ultra Compacto -->
            <div class="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 class="text-sm font-bold text-gray-800 uppercase tracking-tight">Cursos Asignados</h3>
              <button (click)="onClose()" class="text-gray-400 hover:text-gray-600 transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Content: Tabla Ligera -->
            <div class="max-h-[60vh] overflow-y-auto p-0">
              @if (loading()) {
                <div class="flex flex-col items-center justify-center py-6">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                </div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-[11px]">
                    <thead class="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100 text-[9px]">
                      <tr>
                        <th class="px-4 py-2 w-10">Imagen</th>
                        <th class="px-2 py-2">Título del Curso</th>
                        <th class="px-2 py-2 text-right pr-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (course of enrolledCourses(); track (course._id || course.id)) {
                        <tr class="hover:bg-blue-50/30 transition-colors">
                          <td class="px-4 py-1.5">
                            <img [src]="getCourseImageUrl(course.imageUrl)" [alt]="course.name" class="w-6 h-6 rounded object-cover border border-gray-100 shadow-sm" />
                          </td>
                          <td class="px-2 py-1.5 font-medium text-gray-900 leading-tight">
                            {{ course.name || course.title || 'Inscrito' }}
                          </td>
                          <td class="px-2 py-1.5 text-right pr-4 whitespace-nowrap">
                            <span class="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-green-100 text-green-700">
                              ACTIVO
                            </span>
                          </td>
                        </tr>
                      }
                      @if (enrolledCourses().length === 0) {
                        <tr>
                          <td colspan="3" class="px-4 py-10 text-center text-gray-400 italic bg-gray-50/50">
                            No se encontraron cursos activos en este momento
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <!-- Footer Compacto -->
            <div class="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center">
               <span class="text-[9px] text-gray-500 truncate max-w-[200px]">Alumno: {{ studentName }}</span>
               <button (click)="onClose()" class="px-4 py-1.5 bg-gray-900 text-white text-[11px] font-bold rounded hover:bg-black transition-all shadow-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class StudentCoursesViewModalComponent {
  @Input() isOpen = signal<boolean>(false);
  @Input() studentId: string = '';
  @Input() studentName: string = '';
  @Input() studentData: any = null; // Data completa para detección inmediata
  @Output() close = new EventEmitter<void>();

  private coursesService = inject(CoursesService);
  enrolledCourses = signal<any[]>([]);
  loading = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.isOpen() && (this.studentId || this.studentData)) {
        this.loadEnrolledCourses();
      }
    });
  }

  loadEnrolledCourses(): void {
    this.loading.set(true);

    // 1. Intentar obtener de la data ya cargada en la fila (lo más fiable y rápido)
    if (this.studentData) {
      const data = this.studentData;
      const rawCourses = data.enrolledCourses || data.studentCourses || data.courses || data.enrollments || data.course;
      
      if (rawCourses) {
        let list = Array.isArray(rawCourses) ? rawCourses : [rawCourses];
        // Si la lista tiene objetos reales con nombre o id, los usamos
        if (list.length > 0 && typeof list[0] === 'object' && (list[0]._id || list[0].id || list[0].name)) {
          this.enrolledCourses.set(list);
          this.loading.set(false);
          return;
        }
      }
    }

    // 2. Fallback: Consultar todos los cursos (si falla lo anterior)
    this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
      next: (response: any) => {
        const allCourses = response?.data?.data || response?.data || response || [];
        const enrolled = allCourses.filter((course: any) => {
          const students = course.students || [];
          return students.some((s: any) => {
            const id = typeof s === 'string' ? s : (s.userId?._id || s.userId || s._id);
            return String(id) === String(this.studentId);
          });
        });
        this.enrolledCourses.set(enrolled);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error fallback courses view:', error);
        this.enrolledCourses.set([]);
        this.loading.set(false);
      }
    });
  }

  getCourseImageUrl(imageUrl?: string): string {
    if (!imageUrl) return 'https://ui-avatars.com/api/?name=Course&background=f1f5f9&color=64748b';
    if (imageUrl.startsWith('http')) return imageUrl;
    return `https://cursala.b-cdn.net/images/${imageUrl}`;
  }

  onClose(): void {
    this.close.emit();
  }
}

