import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NotificationsService } from '../../../../core/services/notifications.service';
import { CourseStartStateService } from '../../../../core/services/course-start.service';
import { InfoService } from '../../../../core/services/info.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-course-start',
  templateUrl: './course-start.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
export class CourseStartComponent implements OnInit {
  form: FormGroup;
  saving = signal(false);
  showPreview = signal(false);
  previewType: 'welcome' | 'reminder' | null = null;
  userCoursePairs: any[] = [];

  constructor(private fb: FormBuilder, private service: NotificationsService, private infoService: InfoService, private stateService: CourseStartStateService) {
    this.form = this.fb.group({
      enabled: [false],
      senderEmail: ['', [Validators.email, Validators.required]],
      timeWindow: this.fb.group({
        start: ['08:00', [Validators.required]],
        end: ['20:00', [Validators.required]],
      }, { validators: timeWindowValidator }),
    });
  }

  hours = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? '00' : '30';
    return (h < 10 ? '0' + h : h) + ':' + m;
  });

  ngOnInit() {
    this.previewType = null;
    const selectEl = document.querySelector('select') as HTMLSelectElement;
    if (selectEl) {
      selectEl.value = '';
    }

    const savedState = this.stateService.getCourseStartState();
    if (savedState) {
      this.form.patchValue(savedState);
    } else {
      this.service.getCourseStartConfig().subscribe(config => {
        this.form.patchValue(config);
        this.stateService.setCourseStartState(config);
      });
    }

    this.service.getCourseStart().subscribe({
      next: pairs => this.userCoursePairs = pairs,
      error: err => console.error('Error al obtener los usuarios inscriptos:', err)
    });

    this.form.valueChanges.pipe(debounceTime(500), distinctUntilChanged()).subscribe(value => {
      this.stateService.setCourseStartState(value);
      if (this.form.valid) {
        this.service.updateCourseStartConfig(value).subscribe();
      }
    });
  }

  ngOnDestroy() {
    if (this.form.valid) {
      this.stateService.setCourseStartState(this.form.value);
      this.service.updateCourseStartConfig(this.form.value).subscribe();
    }
  }

  openPreview(type: 'welcome' | 'reminder') {
    this.previewType = type;
    this.showPreview.set(true);
  }

  onTemplateChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'welcome' | 'reminder' | '';
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

  sendTest(): void {
    if (this.userCoursePairs.length === 0) {
      this.infoService.showError('No hay usuarios inscriptos para enviar prueba');
      return;
    }

    const payload = {
      ...this.form.value,
      template: this.previewType,
      users: this.userCoursePairs.map(u => ({ email: u.email, name: u.userName, course: u.courseName }))
    };
    this.service.sendTestCourseStartEmail(payload).subscribe();
    this.infoService.showSuccess('Enviando prueba con plantilla: ' + this.previewType);
  }
}

export function timeWindowValidator(group: FormGroup) {
  const start = group.get('start')?.value;
  const end = group.get('end')?.value;
  if (start && end && start >= end) {
    return { invalidRange: true };
  }
  return null;
}
