import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormArray, FormControl, Validators, AbstractControl } from '@angular/forms';
import { inject } from '@angular/core';
import { QuestionnairesService } from '../../../../core/services/questionnaires.service';
import { InfoService } from '../../../../core/services/info.service';
import { HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-question-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './question-item.component.html'
})
export class QuestionItemComponent {
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

  private questionnairesService = inject(QuestionnairesService);
  private infoService = inject(InfoService);

  // Local upload state
  pendingFile?: { file: File; promptType: 'IMAGE' | 'VIDEO' };
  uploading = false;
  progress = 0;

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

    while (optionsArray.length) {
      optionsArray.removeAt(0);
    }

    if (type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_SELECT') {
      for (let i = 0; i < 4; i++) {
        optionsArray.push(this.createOptionGroup());
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

    const maxSize = 1073741824;
    if (file.size > maxSize) {
      this.infoService.showError('El archivo es demasiado grande. Tamaño máximo: 1GB');
      input.value = '';
      return;
    }

    const promptType: 'IMAGE' | 'VIDEO' = allowedImageTypes.includes(file.type) ? 'IMAGE' : 'VIDEO';

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    const current = this.question as FormGroup;
    current.patchValue({ promptType });
    // store local preview in a control so template can use it
    current.patchValue({ promptMediaUrl: previewUrl });

    if (this.isEditMode && (this.question as any).value._id && this.questionnaireId) {
      this.startUpload(file, promptType, (this.question as any).value._id, this.questionnaireId);
    } else {
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
      this.uploading = true;
      this.progress = 0;

      this.questionnairesService.uploadQuestionMedia(questionnaireId, questionId, file, promptType).subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.progress = event.total ? Math.round(100 * event.loaded / event.total) : 0;
          } else if (event.type === HttpEventType.Response) {
            const updatedQuestionnaire = event.body?.data;
            if (updatedQuestionnaire) {
              const updatedQuestion = updatedQuestionnaire.questions.find((q: any) => q._id === questionId);
              if (updatedQuestion) {
                  (this.question as FormGroup).patchValue({ promptMediaUrl: updatedQuestion.promptMediaUrl, promptMediaProvider: updatedQuestion.promptMediaProvider });
                }
            }
            this.uploading = false;
            this.progress = 0;
            this.infoService.showSuccess('Archivo multimedia subido exitosamente');
            resolve();
          }
        },
        error: (err) => {
          console.error('Error uploading media in child:', err);
          this.uploading = false;
          this.progress = 0;
          const url = (this.question as any).value.promptMediaUrl;
          if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
            (this.question as FormGroup).patchValue({ promptMediaUrl: '' });
          }
          this.infoService.showError(err?.error?.message || 'Error al subir el archivo multimedia');
          reject(err);
        }
      });
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
