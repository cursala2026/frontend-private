import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';

import { ReactiveFormsModule, FormGroup, FormArray, FormControl, Validators, AbstractControl } from '@angular/forms';
import { inject } from '@angular/core';
import { InfoService } from '../../../../core/services/info.service';
import { QuestionMediaUploadManagerService } from '../../../../core/services/question-media-upload-manager.service';
import { QuestionnairesService } from '../../../../core/services/questionnaires.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-question-item',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './question-item.component.html'
})
export class QuestionItemComponent implements OnDestroy {
  @Input() question!: AbstractControl;
  @Input() index = 0;
  @Input() questionsLength = 1;
  @Input() mediaPreview: string | null = null;
  @Input() mediaUploading = false;
  @Input() uploadProgress = 0;

  @Output() remove = new EventEmitter<number>();
  @Output() removeMedia = new EventEmitter<number>();

  @Input() questionnaireId?: string;
  @Input() isEditMode = false;

  private infoService = inject(InfoService);
  private uploadManager = inject(QuestionMediaUploadManagerService);
  private questionnairesService = inject(QuestionnairesService);

  // Local upload state
  pendingFile?: { file: File; promptType: 'IMAGE' | 'VIDEO' };
  currentUploadId?: string;
  private uploadCompletedSub?: Subscription;


  ngOnDestroy(): void {
    this.uploadCompletedSub?.unsubscribe();
  }

  get options(): FormArray {
    return (this.question as FormGroup).get('options') as FormArray;
  }

  isType(type: string) {
    return (this.question as FormGroup).get('type')?.value === type;
  }

  addOption() {
    const options = this.options;
    // each option is a simple group with text and order
    options.push(this.createOptionGroup());
    // update parent group validity when options change
    (this.question as FormGroup).updateValueAndValidity();
  }

  removeOption(optionIndex: number) {
    const options = this.options;
    if (options.length > 2) {
      options.removeAt(optionIndex);
      // update parent group validity when options change
      (this.question as FormGroup).updateValueAndValidity();
    }
  }

  onQuestionTypeChange() {
  const type = (this.question as FormGroup).get('type')?.value;
  const optionsArray = this.options;

  if (type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_SELECT') {
    // Guardar los textos actuales antes de limpiar
    const existingTexts: string[] = optionsArray.controls.map(
      ctrl => ctrl.get('text')?.value || ''
    );

    // Limpiar opciones
    while (optionsArray.length) {
      optionsArray.removeAt(0);
    }

    // Recrear 4 opciones preservando el texto que ya había
    for (let i = 0; i < 4; i++) {
      const group = this.createOptionGroup();
      const savedText = existingTexts[i] ?? '';
      group.patchValue({ text: savedText });
      optionsArray.push(group);
    }
  } else {
    // Si cambia a TEXT, limpiar opciones (no se necesitan)
    while (optionsArray.length) {
      optionsArray.removeAt(0);
    }
  }

  (this.question as FormGroup).patchValue({ correctOptionId: '', correctOptionIds: [] });
  (this.question as FormGroup).updateValueAndValidity();
}

  onMediaSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];
    const allAllowed = [...allowedImageTypes, ...allowedVideoTypes];

    if (!allAllowed.includes(file.type)) {
      this.infoService.showError('Tipo de archivo no permitido. Usa: JPG, PNG, GIF, MP4, WEBM, OGG, AVI, MOV');
      input.value = '';
      return;
    }

    const maxSize = 524288000; // 500MB
    if (file.size > maxSize) {
      this.infoService.showError('El archivo es demasiado grande. Tamaño máximo: 500MB');
      input.value = '';
      return;
    }

    const promptType: 'IMAGE' | 'VIDEO' = allowedImageTypes.includes(file.type) ? 'IMAGE' : 'VIDEO';
    const current = this.question as FormGroup;
    current.patchValue({ promptType });

    const questionId = (this.question as any).value._id;
    // debug logs removed

    if (this.isEditMode && questionId && this.questionnaireId) {
      // En modo edición, iniciar subida inmediatamente en segundo plano
      // NO crear preview local, esperar a que la subida complete
      this.infoService.showInfo('Subiendo archivo en segundo plano...');
      this.startUpload(file, promptType, questionId, this.questionnaireId);
    } else {
      // En modo creación, crear preview local y guardar archivo pendiente
      // debug logs removed
      const previewUrl = URL.createObjectURL(file);
      current.patchValue({ promptMediaUrl: previewUrl });
      this.pendingFile = { file, promptType };
      this.infoService.showInfo('El archivo se subirá automáticamente una vez que el cuestionario sea creado');
    }
  }

  async startPendingUpload(questionId: string, questionnaireId: string): Promise<boolean> {
    if (!this.pendingFile) return true;
    try {
      await this.startUpload(this.pendingFile.file, this.pendingFile.promptType, questionId, questionnaireId);
      this.pendingFile = undefined;
      return true;
    } catch (e) {
      return false;
    }
  }

  private startUpload(file: File, promptType: 'IMAGE' | 'VIDEO', questionId: string, questionnaireId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const questionText = (this.question as any).value.questionText || 'Pregunta sin texto';
      // debug logs removed
      const result = this.uploadManager.startUpload(questionnaireId, questionId, file, promptType, questionText);

      if (result.started || result.uploadId) {
        this.currentUploadId = result.uploadId;

        // Suscribirse al evento de completado para actualizar la URL
        this.uploadCompletedSub = this.uploadManager.uploadCompleted$.subscribe(event => {
          if (event.uploadId === this.currentUploadId) {
            // Recargar el cuestionario para obtener la URL actualizada
            this.questionnairesService.getQuestionnaireById(questionnaireId).subscribe({
              next: (response: any) => {
                const questionnaire = response?.data || response;
                const updatedQuestion = questionnaire.questions?.find((q: any) => q._id === questionId);
                if (updatedQuestion && updatedQuestion.promptMediaUrl) {
                  // Actualizar el formulario con la URL real de Bunny
                  (this.question as FormGroup).patchValue({
                    promptMediaUrl: updatedQuestion.promptMediaUrl,
                    promptMediaProvider: updatedQuestion.promptMediaProvider
                  });
                }
              },
              error: (err) => {
                console.error('Error recargando cuestionario:', err);
              }
            });
            this.uploadCompletedSub?.unsubscribe();
          }
        });

        if (result.started) {
          this.infoService.showInfo('El archivo se está subiendo en segundo plano. Puedes continuar trabajando.');
        }
        resolve();
      } else {
        reject(new Error('No se pudo iniciar la subida'));
      }
    });
  }

  onRemoveMedia() {
    this.removeMedia.emit(this.index);
  }

  toggleCorrectOption(optionIndex: number) {
    const control = this.question.get('correctOptionIds');
    if (!control) return;
    const arr: string[] = control.value || [];
    const key = optionIndex.toString();
    const idx = arr.indexOf(key);
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(key);
    }
    control.setValue([...arr]);
  }

  // Helper to create a default option group
  private createOptionGroup(): FormGroup {
    return new FormGroup({
      _id: new FormControl(null),
      text: new FormControl('', [Validators.required, Validators.maxLength(500)]),
      order: new FormControl(0)
    });
  }

  // Force update option text into the FormControl (fixes sync for default-created controls)
  onOptionTextChange(value: string, index: number) {
    const options = this.options;
    if (!options || !options.at(index)) return;
    const ctrl = options.at(index).get('text');
    if (ctrl) {
      ctrl.setValue(value);
      ctrl.markAsTouched();
    }
  }
}
