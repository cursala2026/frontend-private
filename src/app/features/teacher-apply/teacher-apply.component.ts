import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TeacherService } from '../../core/services/teacher-apply.service';
import { InfoService } from '../../core/services/info.service';

@Component({
  selector: 'app-teacher-apply',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './teacher-apply.component.html',
})
export class TeacherApplyComponent {
  private fb = inject(FormBuilder);
  private teacherService = inject(TeacherService);
  private info = inject(InfoService);

  // limite de caracteres de la bio
  readonly BIO_MAX = 500;

  // estado asincronico con signals
  readonly isLoading = signal(false);      // subiendo algun archivo
  readonly isSubmitting = signal(false);   // enviando la postulacion

  // contador reactivo de la bio
  readonly charCount = signal(0);

  // urls de los archivos ya subidos (resguardadas en signals)
  readonly photoUrl = signal<string | null>(null);
  readonly cvUrl = signal<string | null>(null);
  readonly signatureUrl = signal<string | null>(null);

  // estado de la postulacion (PENDING_APPROVAL cuando se envia ok)
  readonly applicationStatus = signal<string | null>(null);

  // formulario reactivo
  form = this.fb.group({
    title: ['', [Validators.required]],
    yearsOfExperience: [null as number | null, [Validators.required, Validators.min(0)]],
    bio: ['', [Validators.required, Validators.maxLength(this.BIO_MAX)]],
    agreementAccepted: [false, [Validators.requiredTrue]],
  });

  constructor() {
    // escuchamos los cambios de la bio para actualizar el contador
    this.form.get('bio')?.valueChanges.subscribe((value) => {
      this.charCount.set(value?.length || 0);
    });
  }

  // el boton queda bloqueado si el form es invalido o falta alguna url
  isSubmitDisabled(): boolean {
    return (
      this.form.invalid ||
      !this.photoUrl() ||
      !this.cvUrl() ||
      !this.signatureUrl() ||
      this.isSubmitting()
    );
  }

  // subida generica de un archivo, guarda la url en el signal correspondiente
  private uploadFile(
    file: File,
    type: 'photo' | 'cv' | 'signature',
    target: ReturnType<typeof signal<string | null>>
  ): void {
    this.isLoading.set(true);
    this.teacherService.uploadDocument(file, type).subscribe({
      next: (url) => {
        target.set(url);
        this.isLoading.set(false);
      },
      error: () => {
        target.set(null);
        this.isLoading.set(false);
        this.info.showError(`no se pudo subir el archivo (${type})`);
      },
    });
  }

  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file, 'photo', this.photoUrl);
  }

  onCvChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.info.showError('el cv debe ser un pdf');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.uploadFile(file, 'cv', this.cvUrl);
  }

  onSignatureChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file, 'signature', this.signatureUrl);
  }

  onSubmit(): void {
    // validamos form + presencia de las 3 urls
    if (this.form.invalid || !this.photoUrl() || !this.cvUrl() || !this.signatureUrl()) {
      this.info.showError('completa el formulario y suri foto, cv y firma');
      return;
    }

    this.isSubmitting.set(true);
    this.teacherService
      .applyAsTeacher({
        title: this.form.value.title ?? '',
        yearsOfExperience: this.form.value.yearsOfExperience ?? 0,
        bio: this.form.value.bio ?? '',
        photoUrl: this.photoUrl()!,
        cvUrl: this.cvUrl()!,
        signatureUrl: this.signatureUrl()!,
        agreementAccepted: true,
      })
      .subscribe({
        next: () => {
          // actualizamos el estado de sesion a PENDING_APPROVAL
          this.applicationStatus.set('PENDING_APPROVAL');
          this.info.showSuccess('Postulacion enviada. Tu perfil esta en evaluacion.');
          this.isSubmitting.set(false);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.info.showError('error al enviar la postulacion');
        },
      });
  }
}