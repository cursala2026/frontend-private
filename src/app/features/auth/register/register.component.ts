import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgOptimizedImage],
  templateUrl: './register.component.html',
  
})
export class RegisterComponent {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private info: InfoService
  ) {
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
    this.errorMessage = null;
    if (this.registerForm.invalid) {
      this.errorMessage = 'Por favor, completa correctamente todos los campos.';
      return;
    }
    // Sanitizar y validar teléfono (solo números, mínimo 10 dígitos)
    const rawPhone: string = this.registerForm.get('phone')?.value || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      this.errorMessage = 'El teléfono debe tener al menos 10 dígitos.';
      this.info.showError(this.errorMessage);
      return;
    }

    this.isLoading = true;
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
        this.isLoading = false;
        // Al registrarse con éxito, iniciar sesión automáticamente
        this.info.showSuccess('Registro exitoso. Iniciando sesión...');
        this.authService.login(email, password).subscribe({
          next: () => {
            // redirigir según rol si login exitoso
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            // Si falló el login automático, redirigir al login para que inicie sesión manualmente
            this.info.showInfo('Registro exitoso. Por favor inicia sesión.');
            this.router.navigate(['/login'], { queryParams: { registered: '1' } });
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        // Backend may return 400 (user already exists) or 409 depending on config.
        const backendMessage = err?.error?.message || err?.error?.meta?.error?.message || err?.error?.error?.message || err?.error?.meta?.error?.message_eng;
        if (err?.status === 409 || err?.status === 400) {
          const msg = backendMessage || 'El usuario o email ya existe.';
          this.errorMessage = msg;
          this.info.showError(msg);
        } else {
          const msg = backendMessage || 'Error al registrarse. Intenta nuevamente.';
          this.errorMessage = msg;
          this.info.showError(msg);
        }
      }
    });
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched));
  }
}
