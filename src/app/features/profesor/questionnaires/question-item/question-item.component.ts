import { Component, EventEmitter, Input, Output, OnDestroy, OnInit, OnChanges, SimpleChanges } from '@angular/core';

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
export class QuestionItemComponent implements OnInit, OnChanges, OnDestroy {
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
  @Input() hasSubmissions = false;

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

  ngOnInit(): void {
    // Apply disabled state initially in case inputs were set before init
    this.applyDisabledState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isEditMode'] || changes['hasSubmissions']) {
      this.applyDisabledState();
    }
  }

  private applyDisabledState(): void {
    try {
      const shouldDisable = !!(this.isEditMode && this.hasSubmissions);
      const group = this.question as FormGroup;
      if (!group) return;

      const toggle = (ctrl: AbstractControl | null | undefined) => {
        if (!ctrl) return;
        if (shouldDisable) {
          ctrl.disable({ emitEvent: false });
        } else {
          ctrl.enable({ emitEvent: false });
        }
      };

      // Top-level controls
      toggle(group.get('type'));
      toggle(group.get('points'));
      toggle(group.get('questionText'));
      toggle(group.get('required'));
      toggle(group.get('correctOptionId'));
      toggle(group.get('correctOptionIds'));
      toggle(group.get('promptType'));
      toggle(group.get('promptMediaUrl'));

      // Options array: toggle each option's text control
      const options = group.get('options') as FormArray | null;
      if (options) {
        for (let i = 0; i < options.length; i++) {
          const optGroup = options.at(i) as FormGroup;
          toggle(optGroup.get('text'));
        }
      }
    } catch (e) {
      // Silently ignore — defensivo para evitar romper la UI si el control cambia
      console.warn('applyDisabledState error', e);
    }
  }

  get options(): FormArray {
    return (this.question as FormGroup).get('options') as FormArray;
  }

  isType(type: string) {
    return (this.question as FormGroup).get('type')?.value === type;
  }

  addOption() {
    if (this.isEditMode && this.hasSubmissions) {
      this.infoService.showError('No es posible agregar opciones: el cuestionario ya tiene envíos.');
      return;
    }
    const options = this.options;
    // each option is a simple group with text and order
    options.push(this.createOptionGroup());
    // update parent group validity when options change
    (this.question as FormGroup).updateValueAndValidity();
  }

  /**
   * removeOption acepta un índice (número) o directamente un AbstractControl
   * del option group. Esto evita depender de índices frágiles derivados del
   * DOM reusado y garantiza que eliminemos el option correcto.
   */
  removeOption(optionOrIndex: number | AbstractControl) {
    if (this.isEditMode && this.hasSubmissions) {
      this.infoService.showError('No es posible eliminar opciones: el cuestionario ya tiene envíos.');
      return;
    }

    const options = this.options;
    let optionIndex: number;

    if (typeof optionOrIndex === 'number') {
      optionIndex = optionOrIndex;
    } else {
      optionIndex = options.controls.indexOf(optionOrIndex as AbstractControl);
    }

    if (optionIndex < 0) return; // no encontrado

    if (options.length > 2) {
      try {
        const before = options.controls.map((c: any) => ({ _id: c.get('_id')?.value, text: c.get('text')?.value }));
      } catch (e) {
        // ignore
      }

      options.removeAt(optionIndex);

      try {
        const after = options.controls.map((c: any) => ({ _id: c.get('_id')?.value, text: c.get('text')?.value }));
      } catch (e) {
        // ignore
      }

      // --- Actualizar correctOptionId (MULTIPLE_CHOICE) ---
      const correctIdCtrl = (this.question as FormGroup).get('correctOptionId');
      if (correctIdCtrl) {
        const currentCorrect = correctIdCtrl.value;
        if (currentCorrect !== null && currentCorrect !== '') {
          const currentIdx = parseInt(currentCorrect, 10);
          if (currentIdx === optionIndex) {
            // La opción eliminada era la correcta → limpiar selección
            correctIdCtrl.setValue('');
          } else if (currentIdx > optionIndex) {
            // El índice correcto estaba después de la opción eliminada → decrementar
            correctIdCtrl.setValue((currentIdx - 1).toString());
          }
        }
      }

      // --- Actualizar correctOptionIds (MULTIPLE_SELECT) ---
      const correctIdsCtrl = (this.question as FormGroup).get('correctOptionIds');
      if (correctIdsCtrl) {
        const arr: string[] = (correctIdsCtrl.value || []).slice();
        const updated = arr
          .filter(key => parseInt(key, 10) !== optionIndex) // eliminar el índice borrado
          .map(key => {
            const idx = parseInt(key, 10);
            // decrementar los índices que estaban después de la opción eliminada
            return idx > optionIndex ? (idx - 1).toString() : key;
          });
        correctIdsCtrl.setValue(updated);
      }

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
