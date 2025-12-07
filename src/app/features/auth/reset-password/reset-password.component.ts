import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent {
  form: any;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private info: InfoService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      token: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    });

    // Prefill token/email from query params if present
    const token = this.route.snapshot.queryParams['token'];
    if (token) {
      this.form.patchValue({ token });
    }
  }

  hasError(field: string, type: string) {
    const f = this.form.get(field);
    return !!(f && f.hasError(type) && (f.dirty || f.touched));
  }

  submit() {
    if (this.form.invalid) {
      this.info.showError('Por favor completa los campos correctamente.');
      return;
    }

    const token = this.form.value.token as string;
    const newPassword = this.form.value.newPassword as string;
    const confirm = this.form.value.confirmPassword as string;

    if (newPassword !== confirm) {
      this.info.showError('Las contraseñas no coinciden.');
      return;
    }

    this.isLoading = true;

    this.auth.completeResetPassword(token, newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.info.showSuccess('Contraseña restablecida. Ahora puedes iniciar sesión.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        if (err?.status === 400) {
          this.info.showError('Token inválido o expirado.');
        } else {
          this.info.showError('Error al restablecer la contraseña.');
        }
      }
    });
  }
}
