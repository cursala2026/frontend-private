import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgOptimizedImage],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  form: any;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private info: InfoService,
    private router: Router
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  hasError(field: string, type: string) {
    const f = this.form.get(field);
    return !!(f && f.hasError(type) && (f.dirty || f.touched));
  }

  submit() {
    if (this.form.invalid) {
      this.info.showError('Por favor ingresa un correo válido.');
      return;
    }

    this.isLoading = true;
    const email = this.form.value.email as string;

    this.auth.initiateResetPassword(email).subscribe({
      next: (data) => {
        this.isLoading = false;
        const expiresIn = data?.expiresIn;
        this.info.showSuccess('Correo de restablecimiento enviado. Revisa tu bandeja.');
        // Redirigir a la pantalla de reset para que peguen el token (si no llega por email)
        this.router.navigate(['/reset-password'], { queryParams: { email } });
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.status === 404) {
          this.info.showError('No se encontró una cuenta con ese correo.');
        } else if (err?.status === 429) {
          this.info.showError('Demasiadas solicitudes. Intenta más tarde.');
        } else {
          this.info.showError('Error al enviar correo de restablecimiento.');
        }
      }
    });
  }
}
