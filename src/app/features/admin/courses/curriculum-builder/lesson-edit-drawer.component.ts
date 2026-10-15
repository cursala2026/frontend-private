import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, finalize } from 'rxjs';
import { CourseCurriculumService } from '../../../../core/services/course-curriculum.service';
import { InfoService } from '../../../../core/services/info.service';
import { IAttachment, ILesson } from '../../../../core/models/curriculum.model';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  isBunnyEmbedUrl,
  isValidVideoUrl,
  validateAttachment,
} from '../../../../core/utils/curriculum.utils';

function videoUrlValidator(control: AbstractControl): ValidationErrors | null {
  return isValidVideoUrl(control.value) ? null : { invalidVideoUrl: true };
}

@Component({
  selector: 'app-lesson-edit-drawer',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-40 flex justify-end bg-black/40" (click)="onBackdropClick()">
      <aside
        class="flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Editar lección"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 class="text-lg font-semibold text-gray-800">Editar lección</h2>
          <button
            type="button"
            class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            [disabled]="busy()"
            (click)="close()"
          >Cerrar</button>
        </header>

        <div class="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <form [formGroup]="form" class="space-y-4" (ngSubmit)="save()" id="lesson-form">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700" for="lesson-title">Título de la lección</label>
              <input
                id="lesson-title"
                type="text"
                formControlName="title"
                maxlength="100"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700" for="lesson-description">Descripción breve</label>
              <textarea
                id="lesson-description"
                formControlName="description"
                maxlength="500"
                rows="3"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" formControlName="isFreePreview" class="h-4 w-4" />
              Vista previa gratuita
            </label>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700" for="lesson-video">URL del video (Bunny Stream / Storage)</label>
              <input
                id="lesson-video"
                type="url"
                formControlName="videoUrl"
                placeholder="https://iframe.mediadelivery.net/embed/..."
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              @if (form.controls.videoUrl.hasError('invalidVideoUrl')) {
                <p class="mt-1 text-sm text-red-600">La URL del video debe comenzar con https://.</p>
              }
              @if (embedUrl(); as src) {
                <div class="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <iframe [src]="src" class="h-full w-full" allow="autoplay; fullscreen" title="Vista previa del video"></iframe>
                </div>
              } @else if (form.controls.videoUrl.value) {
                <p class="mt-2 text-xs text-gray-500">Vista previa no disponible para esta URL.</p>
              }
            </div>
          </form>

          <section class="space-y-3">
            <h3 class="text-sm font-semibold text-gray-800">Material complementario</h3>

            @if (attachments().length === 0) {
              <p class="text-sm text-gray-500">Esta lección todavía no tiene adjuntos.</p>
            }

            <ul class="space-y-2">
              @for (attachment of attachments(); track $index) {
                <li class="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <a [href]="attachment.fileUrl" target="_blank" rel="noopener" class="truncate text-blue-700 hover:underline">
                    {{ attachment.title }}
                  </a>
                  <button
                    type="button"
                    class="ml-3 rounded px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    [disabled]="busy()"
                    (click)="removeAttachment($index)"
                  >Eliminar</button>
                </li>
              }
            </ul>

            <div class="space-y-2">
              <input
                #fileInput
                type="file"
                class="block w-full text-sm text-gray-700"
                [accept]="acceptAttribute"
                [disabled]="busy()"
                (change)="onFileSelected($event)"
                aria-label="Seleccionar adjunto"
              />
              <p class="text-xs text-gray-500">Formatos permitidos: PDF o ZIP. Máximo 50 MB.</p>
              @if (attachmentError(); as message) {
                <p class="text-sm text-red-600" role="alert">{{ message }}</p>
              }
              @if (uploading()) {
                <div class="space-y-1">
                  <div class="flex justify-between text-xs text-gray-600">
                    <span>Subiendo adjunto…</span>
                    <span>{{ uploadPercent() }}%</span>
                  </div>
                  <div
                    class="h-2 w-full overflow-hidden rounded bg-gray-200"
                    role="progressbar"
                    [attr.aria-valuenow]="uploadPercent()"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div class="h-2 bg-blue-600 transition-all" [style.width.%]="uploadPercent()"></div>
                  </div>
                </div>
              }
            </div>
          </section>
        </div>

        <footer class="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          @if (uploading()) {
            <span class="text-xs text-gray-500">Guardado bloqueado hasta terminar la subida</span>
          }
          <button
            type="submit"
            form="lesson-form"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            [disabled]="busy() || form.invalid"
          >{{ saving() ? 'Guardando…' : 'Guardar lección' }}</button>
        </footer>
      </aside>
    </div>
  `,
})
export class LessonEditDrawerComponent implements OnInit {
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);
  private curriculum = inject(CourseCurriculumService);
  private info = inject(InfoService);

  courseId = input.required<string>();
  moduleId = input.required<string>();
  lesson = input.required<ILesson>();

  lessonChange = output<ILesson>();
  closed = output<void>();
  busyChange = output<boolean>();

  readonly acceptAttribute = ALLOWED_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',');

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    isFreePreview: [false],
    videoUrl: ['', [videoUrlValidator]],
  });

  private videoUrl = toSignal(this.form.controls.videoUrl.valueChanges, { initialValue: '' });
  embedUrl = computed<SafeResourceUrl | null>(() => {
    const url = (this.videoUrl() ?? '').trim();
    return isBunnyEmbedUrl(url) ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  attachments = signal<IAttachment[]>([]);
  attachmentError = signal<string | null>(null);
  saving = signal(false);
  uploading = signal(false);
  uploadPercent = signal(0);
  removing = signal(false);
  busy = computed(() => this.saving() || this.uploading() || this.removing());

  private uploadSub?: Subscription;

  ngOnInit(): void {
    const current = this.lesson();
    this.form.patchValue({
      title: current.title,
      description: current.description ?? '',
      isFreePreview: current.isFreePreview,
      videoUrl: current.videoUrl ?? '',
    });
    this.attachments.set([...(current.attachments ?? [])]);
  }

  onBackdropClick(): void {
    this.close();
  }

  close(): void {
    if (this.busy()) return;
    this.closed.emit();
  }

  save(): void {
    if (this.busy() || this.form.invalid) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.busyChange.emit(true);

    this.curriculum
      .updateLesson(this.courseId(), this.moduleId(), this.lesson()._id, {
        title: value.title.trim(),
        description: value.description.trim(),
        isFreePreview: value.isFreePreview,
        videoUrl: value.videoUrl.trim(),
      })
      .pipe(finalize(() => this.finishSaving()))
      .subscribe({
        next: (updated) => {
          this.info.showSuccess('Lección guardada');
          this.lessonChange.emit({ ...updated, attachments: this.attachments() });
        },
        error: () => this.info.showError('Error al guardar la lección'),
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const error = validateAttachment({ name: file.name, size: file.size, type: file.type });
    this.attachmentError.set(error);
    if (error) {
      this.info.showError(error);
      return;
    }
    this.startUpload(file);
  }

  removeAttachment(index: number): void {
    if (this.busy()) return;
    const next = this.attachments().filter((_, i) => i !== index);
    this.removing.set(true);
    this.busyChange.emit(true);

    this.curriculum
      .updateLesson(this.courseId(), this.moduleId(), this.lesson()._id, { attachments: next })
      .pipe(
        finalize(() => {
          this.removing.set(false);
          this.busyChange.emit(this.busy());
        })
      )
      .subscribe({
        next: () => {
          this.attachments.set(next);
          this.info.showSuccess('Adjunto eliminado');
          this.lessonChange.emit({ ...this.lesson(), attachments: next });
        },
        error: () => this.info.showError('Error al eliminar el adjunto'),
      });
  }

  private startUpload(file: File): void {
    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.busyChange.emit(true);

    this.uploadSub = this.curriculum.uploadAttachment(this.courseId(), this.lesson()._id, file).subscribe({
      next: (event) => {
        if (event.type === 'progress') {
          this.uploadPercent.set(event.percent);
          return;
        }
        this.attachments.update((list) => [...list, event.attachment]);
        this.uploadPercent.set(100);
        this.info.showSuccess('Adjunto subido');
        this.lessonChange.emit({ ...this.lesson(), attachments: this.attachments() });
      },
      error: () => {
        this.info.showError('Error al subir el adjunto');
        this.finishUpload();
      },
      complete: () => this.finishUpload(),
    });
  }

  private finishUpload(): void {
    this.uploading.set(false);
    this.uploadPercent.set(0);
    this.busyChange.emit(this.busy());
  }

  private finishSaving(): void {
    this.saving.set(false);
    this.busyChange.emit(this.busy());
  }
}
