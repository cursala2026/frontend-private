import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { InfoService } from '../../core/services/info.service';
import { UsersService } from '../../core/services/users.service';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

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
  private location = inject(Location);

  user = this.authService.currentUser;
  profileForm!: FormGroup;
  isSubmitting = signal(false);
  selectedProfileImage: File | null = null;
  profileImagePreview: string | null = null;
  selectedSignatureImage: File | null = null;
  signatureImagePreview: string | null = null;

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
      username: [currentUser.username, [Validators.required]],
      phone: [currentUser.phone || ''],
      dni: [currentUser.dni || ''],
      birthDate: [currentUser.birthDate ? new Date(currentUser.birthDate).toISOString().split('T')[0] : ''],
      professionalDescription: [currentUser.professionalDescription || '']
    });

    // Establecer preview de imagen actual
    if (currentUser.profilePhotoUrl) {
      this.profileImagePreview = this.buildImageUrl(currentUser.profilePhotoUrl);
    }

    // Establecer preview de firma actual
    if (currentUser.professionalSignatureUrl) {
      this.signatureImagePreview = this.buildImageUrl(currentUser.professionalSignatureUrl);
    }
  }

  get userProfileImageUrl(): string | null {
    const currentUser = this.user();
    if (!currentUser?.profilePhotoUrl) return null;
    return this.buildImageUrl(currentUser.profilePhotoUrl);
  }

  get userSignatureImageUrl(): string | null {
    const currentUser = this.user();
    if (!currentUser?.professionalSignatureUrl) return null;
    return this.buildImageUrl(currentUser.professionalSignatureUrl);
  }

  private buildImageUrl(photoUrl: string): string {
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }
    // Codificar el nombre del archivo para manejar caracteres especiales
    const encodedFileName = encodeURIComponent(photoUrl);
    return `https://cursala.b-cdn.net/profile-images/${encodedFileName}`;
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

      // Validar tamaño (25MB)
      const maxSize = 25 * 1024 * 1024;
      if (file.size > maxSize) {
        this.infoService.showError('La imagen no debe superar los 25MB');
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

  onSignatureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        this.infoService.showError('Solo se permiten imágenes PNG, JPG o JPEG');
        return;
      }

      // Validar tamaño (25MB)
      const maxSize = 25 * 1024 * 1024;
      if (file.size > maxSize) {
        this.infoService.showError('La imagen no debe superar los 25MB');
        return;
      }

      this.selectedSignatureImage = file;

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.signatureImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeSignature(): void {
    this.selectedSignatureImage = null;
    this.signatureImagePreview = this.userSignatureImageUrl;
  }

  onSubmit(): void {
    const currentUser = this.user();
    if (!currentUser) return;

    const formData = this.profileForm.value;
    const hasProfilePhoto = this.selectedProfileImage instanceof File;

    // Validar campos requeridos
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.username) {
      this.infoService.showError('Por favor completa los campos requeridos (Nombre, Apellido, Email, Nombre de usuario)');
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      this.infoService.showError('Por favor ingresa un email válido');
      return;
    }

    this.isSubmitting.set(true);
    
    // Usar FormData para enviar todos los datos (con o sin foto)
    // El endpoint updateUserData acepta tanto FormData como JSON
    const formDataToSend = new FormData();
    
    // Agregar campos del formulario
    formDataToSend.append('firstName', formData.firstName);
    formDataToSend.append('lastName', formData.lastName);
    formDataToSend.append('email', formData.email);
    formDataToSend.append('username', formData.username);
    
    // Enviar valores aunque sean cadenas vacías para permitir limpiar campos en el backend
    if (formData.phone !== undefined) {
      formDataToSend.append('phone', formData.phone ?? '');
    }
    if (formData.dni !== undefined) {
      formDataToSend.append('dni', formData.dni ?? '');
    }
    if (formData.birthDate !== undefined) {
      formDataToSend.append('birthDate', formData.birthDate ?? '');
    }
    if (formData.professionalDescription !== undefined) {
      formDataToSend.append('professionalDescription', formData.professionalDescription ?? '');
    }
    
    // Agregar la foto si existe
    if (hasProfilePhoto && this.selectedProfileImage) {
      formDataToSend.append('photo', this.selectedProfileImage);
    }
    
    // Agregar la firma si existe
    const hasSignaturePhoto = this.selectedSignatureImage instanceof File;
    if (hasSignaturePhoto && this.selectedSignatureImage) {
      formDataToSend.append('signatureFile', this.selectedSignatureImage);
    }
    
    // Usar siempre updateUserData que tiene requireAdminOrSelf
    this.usersService.updateUserData(currentUser._id, formDataToSend).subscribe({
      next: (response) => {
        this.infoService.showSuccess('Perfil actualizado exitosamente');
        this.isSubmitting.set(false);
        
        // Actualizar usuario en AuthService sin recargar
        if (response.data) {
          this.authService.updateCurrentUser(response.data);
          
          // Intentar volver a la página anterior si hay historial, sino ir al dashboard
          if (window.history.length > 1) {
            this.location.back();
          } else {
            this.redirectToDashboard(response.data);
          }
        }
        
        // Limpiar la imagen seleccionada después de guardar
        this.selectedProfileImage = null;
        this.selectedSignatureImage = null;
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        console.error('Error details:', error.error);
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

  /**
   * Verifica si hay cambios pendientes en el formulario o en la foto de perfil
   */
  hasPendingChanges(): boolean {
    const currentUser = this.user();
    if (!currentUser) return false;

    // Si hay una foto seleccionada, hay cambios pendientes
    if (this.selectedProfileImage) {
      return true;
    }

    // Si hay una firma seleccionada, hay cambios pendientes
    if (this.selectedSignatureImage) {
      return true;
    }

    // Verificar si el formulario tiene cambios
    const formValue = this.profileForm.value;
    
    // Comparar cada campo del formulario con los valores originales
    if (formValue.firstName !== currentUser.firstName) return true;
    if (formValue.lastName !== currentUser.lastName) return true;
    if (formValue.email !== currentUser.email) return true;
    if (formValue.username !== currentUser.username) return true;
    if (formValue.phone !== (currentUser.phone || '')) return true;
    if (formValue.dni !== (currentUser.dni || '')) return true;
    
    // Comparar fecha de nacimiento
    const formBirthDate = formValue.birthDate || '';
    const userBirthDate = currentUser.birthDate 
      ? new Date(currentUser.birthDate).toISOString().split('T')[0] 
      : '';
    if (formBirthDate !== userBirthDate) return true;
    
    // Comparar descripción profesional
    if (formValue.professionalDescription !== (currentUser.professionalDescription || '')) return true;

    return false;
  }

  onCancel(): void {
    // Intentar volver a la página anterior si hay historial
    if (window.history.length > 1) {
      this.location.back();
    } else {
      // Si no hay historial, redirigir al dashboard correspondiente al rol del usuario
      const currentUser = this.user();
      if (currentUser) {
        this.redirectToDashboard(currentUser);
      }
    }
  }

  /**
   * Redirige al dashboard correspondiente según el rol del usuario
   */
  private redirectToDashboard(user: any): void {
    if (user.roles.includes('ADMIN')) {
      this.router.navigate(['/admin']);
    } else if (user.roles.includes('PROFESOR')) {
      this.router.navigate(['/profesor']);
    } else if (user.roles.includes('ALUMNO')) {
      this.router.navigate(['/alumno']);
    } else {
      // Si no tiene ningún rol conocido, ir al dashboard general
      this.router.navigate(['/dashboard']);
    }
  }
}
