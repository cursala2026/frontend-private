import { Component, OnInit, signal, Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationsService } from '../../../../core/services/notifications.service';
import { NoEnrollmentStateService } from '../../../../core/services/no-enrollment.service';
import { InfoService } from '../../../../core/services/info.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-no-enrollment',
  templateUrl: './no-enrollment.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
@Injectable({ providedIn: 'root' })
export class NoEnrollmentComponent implements OnInit {
  form: FormGroup;
  showPreview = signal(false);
  previewType: 'recommend' | null = null;
  usersWithoutEnrollment: any[] = [];
  recommendedCourses: any[] = [];
  saving = signal(false);

  constructor(private fb: FormBuilder, private service: NotificationsService, private infoService: InfoService, private stateService: NoEnrollmentStateService) {
    this.form = this.fb.group({
      enabled: ['', [Validators.required]],
      senderEmail: ['', Validators.required],
      ctaUrl: ['https://cursala.com.ar/cursos', Validators.required],
      interestLink: ['https://app.cursala.com.ar/alumno/profile', Validators.required],
      unsubscribeLink: ['https://app.cursala.com.ar/alumno/profile', Validators.required]
    });
  }

  ngOnInit() {
    this.previewType = null;
    const selectEl = document.querySelector('select') as HTMLSelectElement;
    if (selectEl) {
      selectEl.value = '';
    }

    const savedState = this.stateService.getNoEnrollmentState();
    if (savedState) {
      this.form.patchValue(savedState);
    } else {
      this.service.getNoEnrollmentConfig().subscribe(config => {
        this.form.patchValue(config);
        this.stateService.setNoEnrollmentState(config);
      });
    }

    this.form.valueChanges.pipe(debounceTime(500), distinctUntilChanged()).subscribe(value => {
      this.stateService.setNoEnrollmentState(value);
      if (this.form.valid) {
        this.service.updateNoEnrollmentConfig(value).subscribe();
      }
    });
    
    this.service.getNoEnrollmentUsers().subscribe({
      next: users => this.usersWithoutEnrollment = users,
      error: err => console.error('Error al obtener los usuarios sin inscripción:', err)
    });

    this.service.getRecommendCourses().subscribe({
      next: course => this.recommendedCourses = course,
      error: err => console.error('Error al obtener los cursos recomendados:', err)
    });
  }

  ngOnDestroy() {
    if (this.form.valid) {
      this.stateService.setNoEnrollmentState(this.form.value);
      this.service.updateNoEnrollmentConfig(this.form.value).subscribe();
    }
  }

  openPreview(type: 'recommend') {
    this.previewType = type;
    this.showPreview.set(true);
  }

  onTemplateChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'recommend' | '';
    this.previewType = value || null;
  }

  closePreview() {
    this.showPreview.set(false);
  }

  openUrl(url: string) {
    if (url) {
      window.open(url, '_blank');
    } else {
      this.infoService.showError('URL no encontrada');
    }
  }

  sendTest() {
    if (this.usersWithoutEnrollment.length === 0) {
      this.infoService.showError('No hay usuarios sin inscripción para enviar prueba');
      return;
    }

    const payload = { 
      ...this.form.value, 
      template: this.previewType, 
      users: this.usersWithoutEnrollment.map(u => ({ email: u.email, name: u.name }))
    };
    this.service.sendTestNoEnrollmentEmail(payload).subscribe();
    this.infoService.showSuccess('Enviando prueba con plantilla: ' + this.previewType);
  }
}
