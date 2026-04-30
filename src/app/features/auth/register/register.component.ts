import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterModule, NgOptimizedImage],
  templateUrl: './register.component.html',
  
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private info = inject(InfoService);

  registerForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  courseId = signal<string | null>(null);

  constructor() {
    this.courseId.set(this.route.snapshot.queryParamMap.get('courseId'));
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatch });
  }


  private passwordsMatch(group: FormGroup) {
    const p = group.get('password')?.value;
    const c = group.get('confirmPassword')?.value;
    return p === c ? null : { passwordsMismatch: true };
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    if (this.registerForm.invalid) {
      this.errorMessage.set('Por favor, completa correctamente todos los campos.');
      return;
    }
    // Sanitizar y validar teléfono (solo números, mínimo 10 dígitos)
    const rawPhone: string = this.registerForm.get('phone')?.value || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      const msg = 'El teléfono debe tener al menos 10 dígitos.';
      this.errorMessage.set(msg);
      this.info.showError(msg);
      return;
    }

    this.isLoading.set(true);
    const { firstName, lastName, email, password } = this.registerForm.value;
    const payload = {
      firstName,
      lastName,
      email,
      phone: cleanPhone,
      password
    };

    this.authService.register(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        // Al registrarse con éxito, iniciar sesión automáticamente
        this.info.showSuccess('Registro exitoso. Iniciando sesión...');
        this.authService.login(email, password).subscribe({
          next: () => {
            // redirigir según rol si login exitoso o al curso si hay courseId
            const id = this.courseId();
            if (id) {
              this.router.navigate(['/alumno/course-detail', id]);
            } else {
              this.router.navigate(['/dashboard']);
            }
          },
          error: () => {
            // Si falló el login automático, redirigir al login para que inicie sesión manualmente
            this.info.showInfo('Registro exitoso. Por favor inicia sesión.');
            const queryParams: any = { registered: '1' };
            if (this.courseId()) {
              queryParams.courseId = this.courseId();
            }
            this.router.navigate(['/login'], { queryParams });
          }
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        // Backend may return 400 (user already exists) or 409 depending on config.
        const backendMessage = err?.error?.message || err?.error?.meta?.error?.message || err?.error?.error?.message || err?.error?.meta?.error?.message_eng;
        let msg = '';
        if (err?.status === 409 || err?.status === 400) {
          msg = backendMessage || 'El usuario o email ya existe.';
        } else {
          msg = backendMessage || 'Error al registrarse. Intenta nuevamente.';
        }
        this.errorMessage.set(msg);
        this.info.showError(msg);
      }
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched));
  }
}
