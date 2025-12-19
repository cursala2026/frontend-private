import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { InfoService } from '../../core/services/info.service';
import { UsersService } from '../../core/services/users.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private usersService = inject(UsersService);
  private infoService = inject(InfoService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  user = this.authService.currentUser;
  profileForm!: FormGroup;
  isSubmitting = signal(false);
  selectedProfileImage: File | null = null;
  profileImagePreview: string | null = null;

  constructor() {
    const currentUser = this.user();
    if (!currentUser) {
      this.router.navigate(['/admin']);
      return;
    }

    this.profileForm = this.fb.group({
      firstName: [currentUser.firstName, [Validators.required]],
      lastName: [currentUser.lastName, [Validators.required]],
      email: [currentUser.email, [Validators.required, Validators.email]],
      phone: [currentUser.phone || ''],
      dni: [currentUser.dni || ''],
      birthDate: [currentUser.birthDate ? new Date(currentUser.birthDate).toISOString().split('T')[0] : ''],
      professionalDescription: [currentUser.professionalDescription || '']
    });

    // Establecer preview de imagen actual
    if (currentUser.profilePhotoUrl) {
      this.profileImagePreview = this.buildImageUrl(currentUser.profilePhotoUrl);
    }
  }

  get userProfileImageUrl(): string | null {
    const currentUser = this.user();
    if (!currentUser?.profilePhotoUrl) return null;
    return this.buildImageUrl(currentUser.profilePhotoUrl);
  }

  private buildImageUrl(photoUrl: string): string {
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }
    return `https://cursala.b-cdn.net/profile-images/${photoUrl}`;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        this.infoService.showError('Solo se permiten imágenes PNG, JPG o JPEG');
        return;
      }

      // Validar tamaño (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.infoService.showError('La imagen no debe superar los 5MB');
        return;
      }

      this.selectedProfileImage = file;

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profileImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedProfileImage = null;
    this.profileImagePreview = this.userProfileImageUrl;
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.infoService.showError('Por favor completa todos los campos requeridos');
      return;
    }

    const currentUser = this.user();
    if (!currentUser) return;

    this.isSubmitting.set(true);

    const formData = this.profileForm.value;
    
    // Construir updateData solo con campos que tienen valores
    const updateData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email
    };

    // Agregar campos opcionales solo si tienen valor
    if (formData.phone && formData.phone.trim()) {
      updateData.phone = formData.phone;
    }
    if (formData.dni && formData.dni.trim()) {
      updateData.dni = formData.dni;
    }
    if (formData.birthDate && formData.birthDate.trim()) {
      updateData.birthDate = formData.birthDate;
    }
    if (formData.professionalDescription && formData.professionalDescription.trim()) {
      updateData.professionalDescription = formData.professionalDescription;
    }

    // Por ahora solo actualizamos datos sin imagen
    // TODO: Implementar upload de imagen a través del endpoint /user/updateUserData
    if (this.selectedProfileImage) {
      this.infoService.showInfo('La actualización de imagen de perfil se implementará próximamente');
    }

    this.usersService.updateUser(currentUser._id, updateData).subscribe({
      next: (response) => {
        this.infoService.showSuccess('Perfil actualizado exitosamente');
        this.isSubmitting.set(false);
        
        // Actualizar usuario en AuthService
        if (response.data) {
          localStorage.setItem('user', JSON.stringify(response.data));
          window.location.reload(); // Recargar para actualizar el signal
        }
      },
      error: (error) => {
        this.infoService.showError(error.error?.message || 'Error al actualizar el perfil');
        this.isSubmitting.set(false);
      }
    });
  }

  getUserInitials(): string {
    const currentUser = this.user();
    if (!currentUser) return '';
    return `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`;
  }
}
