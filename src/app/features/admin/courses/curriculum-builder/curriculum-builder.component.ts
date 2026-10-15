import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, OnInit, signal } from '@angular/core';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoursesService } from '../../../../core/services/courses.service';
import { CourseCurriculumService } from '../../../../core/services/course-curriculum.service';
import { InfoService } from '../../../../core/services/info.service';
import { ConfirmModalComponent, ConfirmModalConfig } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { IModule, ILesson } from '../../../../core/models/curriculum.model';
import { moveItem } from '../../../../core/utils/curriculum.utils';
import { ModuleAccordionComponent } from './module-accordion.component';
import { LessonEditDrawerComponent } from './lesson-edit-drawer.component';

type PendingDelete =
  | { kind: 'module'; moduleId: string; title: string }
  | { kind: 'lesson'; moduleId: string; lessonId: string; title: string };

interface EditingLesson {
  moduleId: string;
  lesson: ILesson;
}

@Component({
  selector: 'app-curriculum-builder',
  standalone: true,
  imports: [CdkDrag, CdkDropList, ModuleAccordionComponent, LessonEditDrawerComponent, ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-800">Contenido del curso</h2>
          <p class="text-sm text-gray-500">Arrastrá módulos y lecciones para cambiar el orden.</p>
        </div>
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          [disabled]="locked() || loading()"
          (click)="addModule()"
        >Agregar Módulo</button>
      </div>

      @if (loading()) {
        <p class="text-sm text-gray-500">Cargando contenido…</p>
      } @else if (loadError()) {
        <p class="text-sm text-red-600" role="alert">{{ loadError() }}</p>
      } @else {
        <div
          cdkDropList
          [cdkDropListData]="modules()"
          [cdkDropListDisabled]="locked()"
          (cdkDropListDropped)="onModuleDrop($event)"
          class="space-y-3"
        >
          @for (module of modules(); track module._id) {
            <app-module-accordion
              cdkDrag
              [cdkDragDisabled]="locked()"
              [module]="module"
              [disabled]="locked()"
              (titleSave)="renameModule(module._id, $event)"
              (addLesson)="addLesson(module._id)"
              (editLesson)="openLesson(module._id, $event)"
              (deleteLesson)="askDeleteLesson(module._id, $event)"
              (deleteModule)="askDeleteModule(module._id, module.title)"
              (lessonDrop)="onLessonDrop(module._id, $event)"
            />
          } @empty {
            <p class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              Todavía no hay módulos. Usá "Agregar Módulo" para empezar.
            </p>
          }
        </div>
      }
    </section>

    @if (editing(); as ctx) {
      <app-lesson-edit-drawer
        [courseId]="courseId()"
        [moduleId]="ctx.moduleId"
        [lesson]="ctx.lesson"
        (lessonChange)="onLessonChanged(ctx.moduleId, $event)"
        (closed)="editing.set(null)"
        (busyChange)="locked.set($event)"
      />
    }

    <app-confirm-modal
      [isOpen]="confirmOpen"
      [config]="confirmConfig()"
      (confirm)="confirmDelete()"
      (cancel)="cancelDelete()"
    ></app-confirm-modal>
  `,
})
export class CurriculumBuilderComponent implements OnInit {
  private courses = inject(CoursesService);
  private curriculum = inject(CourseCurriculumService);
  private info = inject(InfoService);
  private destroyRef = inject(DestroyRef);

  courseId = input.required<string>();

  modules = signal<IModule[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  locked = signal(false);
  editing = signal<EditingLesson | null>(null);
  confirmOpen = signal(false);
  pendingDelete = signal<PendingDelete | null>(null);

  confirmConfig = computed<ConfirmModalConfig>(() => {
    const pending = this.pendingDelete();
    const isModule = pending?.kind === 'module';
    return {
      title: isModule ? 'Eliminar módulo' : 'Eliminar lección',
      message: pending
        ? `¿Seguro que querés eliminar "${pending.title}"? ${
            isModule ? 'Se eliminan también todas sus lecciones.' : 'Esta acción no se puede deshacer.'
          }`
        : '',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      icon: 'danger',
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.courses
      .getCourseById(this.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const course = res?.data ?? res;
          this.modules.set(this.sortByOrder(course?.modules ?? []));
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudo cargar el contenido del curso.');
          this.loading.set(false);
        },
      });
  }

  addModule(): void {
    if (this.locked()) return;
    const order = this.modules().length + 1;
    this.curriculum
      .createModule(this.courseId(), { title: `Nuevo módulo ${order}`, order })
      .subscribe({
        next: (created) => {
          this.modules.update((list) => [...list, { ...created, lessons: created.lessons ?? [] }]);
          this.info.showSuccess('Módulo creado');
        },
        error: () => this.info.showError('Error al crear el módulo'),
      });
  }

  renameModule(moduleId: string, title: string): void {
    this.curriculum.updateModule(this.courseId(), moduleId, { title }).subscribe({
      next: () => {
        this.modules.update((list) => list.map((m) => (m._id === moduleId ? { ...m, title } : m)));
        this.info.showSuccess('Título del módulo actualizado');
      },
      error: () => this.info.showError('Error al actualizar el título del módulo'),
    });
  }

  askDeleteModule(moduleId: string, title: string): void {
    if (this.locked()) return;
    this.pendingDelete.set({ kind: 'module', moduleId, title });
    this.confirmOpen.set(true);
  }

  askDeleteLesson(moduleId: string, lesson: ILesson): void {
    if (this.locked()) return;
    this.pendingDelete.set({ kind: 'lesson', moduleId, lessonId: lesson._id, title: lesson.title });
    this.confirmOpen.set(true);
  }

  confirmDelete(): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!pending) return;

    if (pending.kind === 'module') {
      this.curriculum.deleteModule(this.courseId(), pending.moduleId).subscribe({
        next: () => {
          this.modules.update((list) => list.filter((m) => m._id !== pending.moduleId));
          this.info.showSuccess('Módulo eliminado');
        },
        error: () => this.info.showError('Error al eliminar el módulo'),
      });
      return;
    }

    this.curriculum.deleteLesson(this.courseId(), pending.moduleId, pending.lessonId).subscribe({
      next: () => {
        this.modules.update((list) =>
          list.map((m) =>
            m._id === pending.moduleId
              ? { ...m, lessons: m.lessons.filter((l) => l._id !== pending.lessonId) }
              : m
          )
        );
        this.info.showSuccess('Lección eliminada');
      },
      error: () => this.info.showError('Error al eliminar la lección'),
    });
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  addLesson(moduleId: string): void {
    if (this.locked()) return;
    const module = this.modules().find((m) => m._id === moduleId);
    if (!module) return;
    const order = module.lessons.length + 1;
    this.curriculum
      .createLesson(this.courseId(), moduleId, { title: `Nueva lección ${order}`, order, isFreePreview: false })
      .subscribe({
        next: (created) => {
          const lesson: ILesson = { ...created, attachments: created.attachments ?? [] };
          this.modules.update((list) =>
            list.map((m) => (m._id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m))
          );
          this.info.showSuccess('Lección creada');
          this.editing.set({ moduleId, lesson });
        },
        error: () => this.info.showError('Error al crear la lección'),
      });
  }

  openLesson(moduleId: string, lesson: ILesson): void {
    if (this.locked()) return;
    this.editing.set({ moduleId, lesson });
  }

  onLessonChanged(moduleId: string, lesson: ILesson): void {
    this.modules.update((list) =>
      list.map((m) =>
        m._id === moduleId
          ? { ...m, lessons: m.lessons.map((l) => (l._id === lesson._id ? { ...l, ...lesson } : l)) }
          : m
      )
    );
  }

  onModuleDrop(event: CdkDragDrop<IModule[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const previous = this.modules();
    const next = moveItem(previous, event.previousIndex, event.currentIndex).map((m, i) => ({ ...m, order: i + 1 }));
    this.modules.set(next);

    this.curriculum
      .reorder(
        this.courseId(),
        'MODULES',
        next.map((m) => m._id)
      )
      .subscribe({
        next: () => this.info.showSuccess('Orden de módulos guardado'),
        error: () => {
          this.modules.set(previous);
          this.info.showError('No se pudo guardar el nuevo orden de los módulos');
        },
      });
  }

  onLessonDrop(moduleId: string, event: CdkDragDrop<ILesson[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const previous = this.modules();
    const module = previous.find((m) => m._id === moduleId);
    if (!module) return;
    const reordered = moveItem(module.lessons, event.previousIndex, event.currentIndex).map((l, i) => ({
      ...l,
      order: i + 1,
    }));
    this.modules.set(
      previous.map((m) => (m._id === moduleId ? { ...m, lessons: reordered } : m))
    );

    this.curriculum
      .reorder(
        this.courseId(),
        'LESSONS',
        reordered.map((l) => l._id),
        moduleId
      )
      .subscribe({
        next: () => this.info.showSuccess('Orden de lecciones guardado'),
        error: () => {
          this.modules.set(previous);
          this.info.showError('No se pudo guardar el nuevo orden de las lecciones');
        },
      });
  }

  private sortByOrder(modules: IModule[]): IModule[] {
    return [...modules]
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        ...m,
        lessons: [...(m.lessons ?? [])].sort((a, b) => a.order - b.order).map((l) => ({
          ...l,
          attachments: l.attachments ?? [],
        })),
      }));
  }
}
