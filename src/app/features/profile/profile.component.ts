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
    const currentUser = this.user();
    if (!currentUser) return;

    const formData = this.profileForm.value;
    const hasProfilePhoto = this.selectedProfileImage instanceof File;

    // Validar campos requeridos
    if (!formData.firstName || !formData.lastName || !formData.email) {
      this.infoService.showError('Por favor completa los campos requeridos (Nombre, Apellido, Email)');
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
    
    if (formData.phone && formData.phone.trim()) {
      formDataToSend.append('phone', formData.phone);
    }
    if (formData.dni && formData.dni.trim()) {
      formDataToSend.append('dni', formData.dni);
    }
    if (formData.birthDate && formData.birthDate.trim()) {
      formDataToSend.append('birthDate', formData.birthDate);
    }
    if (formData.professionalDescription && formData.professionalDescription.trim()) {
      formDataToSend.append('professionalDescription', formData.professionalDescription);
    }
    
    // Agregar la foto si existe
    if (hasProfilePhoto && this.selectedProfileImage) {
      formDataToSend.append('photo', this.selectedProfileImage);
    }
    
    console.log('Actualizando perfil para usuario ID:', currentUser._id);
    
    // Usar siempre updateUserData que tiene requireAdminOrSelf
    this.usersService.updateUserData(currentUser._id, formDataToSend).subscribe({
      next: (response) => {
        this.infoService.showSuccess('Perfil actualizado exitosamente');
        this.isSubmitting.set(false);
        
        // Actualizar usuario en AuthService
        if (response.data) {
          localStorage.setItem('user', JSON.stringify(response.data));
          window.location.reload(); // Recargar para actualizar el signal
        }
        
        // Limpiar la imagen seleccionada después de guardar
        this.selectedProfileImage = null;
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

    // Verificar si el formulario tiene cambios
    const formValue = this.profileForm.value;
    
    // Comparar cada campo del formulario con los valores originales
    if (formValue.firstName !== currentUser.firstName) return true;
    if (formValue.lastName !== currentUser.lastName) return true;
    if (formValue.email !== currentUser.email) return true;
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
}
