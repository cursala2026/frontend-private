import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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

  // formulario reactivo (se inicializa en initForm())
  form: FormGroup = this.initForm();

  constructor() {
    // escuchamos los cambios de la bio para actualizar el contador
    this.form.get('bio')?.valueChanges.subscribe((value) => {
      this.charCount.set(value?.length || 0);
    });
  }

  // inicializa todos los controles del formulario
  private initForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required]],
      yearsOfExperience: [null as number | null, [Validators.required, Validators.min(0)]],
      bio: ['', [Validators.required, Validators.maxLength(this.BIO_MAX)]],
      agreementAccepted: [false, [Validators.requiredTrue]],
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

  // archivos elegidos (se suben juntos cuando estan los 3)
  private photoFile: File | null = null;
  private cvFile: File | null = null;
  private signatureFile: File | null = null;

  onPhotoChange(event: Event): void {
    this.photoFile = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.tryUploadAll();
  }

  onCvChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && file.type !== 'application/pdf') {
      this.info.showError('el cv debe ser un pdf');
      input.value = '';
      this.cvFile = null;
      return;
    }
    this.cvFile = file;
    this.tryUploadAll();
  }

  onSignatureChange(event: Event): void {
    this.signatureFile = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.tryUploadAll();
  }

  // cuando estan los 3 archivos, se suben juntos al backend en un solo request
  private tryUploadAll(): void {
    if (!this.photoFile || !this.cvFile || !this.signatureFile) return;

    this.isLoading.set(true);
    this.teacherService
      .uploadDocuments({
        photo: this.photoFile,
        cv: this.cvFile,
        signature: this.signatureFile,
      })
      .subscribe({
        next: (urls) => {
          this.photoUrl.set(urls.photo ?? null);
          this.cvUrl.set(urls.cv ?? null);
          this.signatureUrl.set(urls.signature ?? null);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.info.showError('no se pudieron subir los archivos');
        },
      });
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