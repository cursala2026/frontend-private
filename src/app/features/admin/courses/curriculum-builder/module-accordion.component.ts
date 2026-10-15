import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { IModule, ILesson } from '../../../../core/models/curriculum.model';

@Component({
  selector: 'app-module-accordion',
  standalone: true,
  imports: [CdkDrag, CdkDragHandle, CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="flex items-center gap-3 px-4 py-3">
        <span
          cdkDragHandle
          class="cursor-grab select-none text-gray-400 hover:text-gray-600"
          aria-label="Arrastrar módulo"
          title="Arrastrar módulo"
        >&#9776;</span>

        <button
          type="button"
          class="flex-1 text-left font-semibold text-gray-800"
          [attr.aria-expanded]="expanded()"
          (click)="toggle()"
        >
          {{ module().title }}
          <span class="ml-2 text-sm font-normal text-gray-500">({{ lessonCount() }} lecciones)</span>
        </button>

        <div class="flex items-center gap-2 text-sm">
          <button
            type="button"
            class="rounded px-2 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            [disabled]="disabled()"
            (click)="startTitleEdit()"
          >Editar Título</button>
          <button
            type="button"
            class="rounded px-2 py-1 text-green-700 hover:bg-green-50 disabled:opacity-50"
            [disabled]="disabled()"
            (click)="addLesson.emit()"
          >Agregar Lección</button>
          <button
            type="button"
            class="rounded px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
            [disabled]="disabled()"
            (click)="deleteModule.emit()"
          >Eliminar</button>
        </div>
      </div>

      @if (editingTitle()) {
        <div class="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          <input
            type="text"
            maxlength="100"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            [value]="titleDraft()"
            (input)="titleDraft.set($any($event.target).value)"
            (keydown.enter)="saveTitle()"
            (keydown.escape)="cancelTitleEdit()"
            aria-label="Título del módulo"
          />
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            [disabled]="!canSaveTitle() || disabled()"
            (click)="saveTitle()"
          >Guardar</button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            (click)="cancelTitleEdit()"
          >Cancelar</button>
        </div>
      }

      @if (expanded()) {
        <div
          cdkDropList
          [cdkDropListData]="module().lessons"
          [cdkDropListDisabled]="disabled()"
          (cdkDropListDropped)="lessonDrop.emit($event)"
          class="min-h-[2rem] border-t border-gray-100 px-4 py-2"
        >
          @for (lesson of module().lessons; track lesson._id) {
            <div
              cdkDrag
              [cdkDragDisabled]="disabled()"
              class="mb-2 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span
                cdkDragHandle
                class="cursor-grab select-none text-gray-400 hover:text-gray-600"
                aria-label="Arrastrar lección"
                title="Arrastrar lección"
              >&#9776;</span>
              <div class="flex-1">
                <div class="font-medium text-gray-800">{{ lesson.title }}</div>
                <div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  @if (lesson.isFreePreview) {
                    <span class="rounded bg-green-100 px-2 py-0.5 text-green-800">Vista previa gratuita</span>
                  }
                  @if (lesson.videoUrl) {
                    <span class="rounded bg-blue-100 px-2 py-0.5 text-blue-800">Video cargado</span>
                  }
                  <span>{{ lesson.attachments.length }} adjunto(s)</span>
                </div>
              </div>
              <button
                type="button"
                class="rounded px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                [disabled]="disabled()"
                (click)="editLesson.emit(lesson)"
              >Editar</button>
              <button
                type="button"
                class="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                [disabled]="disabled()"
                (click)="deleteLesson.emit(lesson)"
              >Eliminar</button>
            </div>
          } @empty {
            <p class="py-3 text-sm text-gray-500">Este módulo todavía no tiene lecciones.</p>
          }
        </div>
      }
    </div>
  `,
})
export class ModuleAccordionComponent {
  module = input.required<IModule>();
  disabled = input(false);

  titleSave = output<string>();
  addLesson = output<void>();
  editLesson = output<ILesson>();
  deleteLesson = output<ILesson>();
  deleteModule = output<void>();
  lessonDrop = output<CdkDragDrop<ILesson[]>>();

  expanded = signal(true);
  editingTitle = signal(false);
  titleDraft = signal('');

  lessonCount = computed(() => this.module().lessons.length);
  canSaveTitle = computed(() => {
    const value = this.titleDraft().trim();
    return value.length > 0 && value.length <= 100;
  });

  toggle(): void {
    this.expanded.update((value) => !value);
  }

  startTitleEdit(): void {
    this.titleDraft.set(this.module().title);
    this.editingTitle.set(true);
  }

  cancelTitleEdit(): void {
    this.editingTitle.set(false);
  }

  saveTitle(): void {
    if (!this.canSaveTitle()) return;
    const title = this.titleDraft().trim();
    this.editingTitle.set(false);
    if (title !== this.module().title) {
      this.titleSave.emit(title);
    }
  }
}
