import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NotificationsService, CourseStart } from '../notifications.service';

@Component({
  selector: 'app-course-start',
  templateUrl: './course-start.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
export class CourseStartComponent implements OnInit {
  form: FormGroup;
  saving = signal(false);
  upcomingCourses: CourseStart[] = [];

  constructor(private fb: FormBuilder, private service: NotificationsService) {
    this.form = this.fb.group({
      enabled: [false],
      sender: ['info@cursala.com.ar', Validators.required],
      template: ['', [Validators.required, Validators.minLength(10)]],
      timeWindow: ['', [Validators.required]]
    });

    this.service.getCourseStart().subscribe({
      next: (courses) => {
        this.upcomingCourses = courses;
      },
      error: (err) => {
        console.error('Error al cargar cursos próximos: ', err);
      }
    });
  }

  ngOnInit() {
    this.service.getConfig('course-start').subscribe(config => {
      this.form.patchValue(config);
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    setTimeout(() => {
      console.log('Datos guardados:', this.form.value);
      this.saving.set(false);
    }, 1500);
  }

  sendTest(): void {
    console.log('Enviando prueba con plantilla:', this.form.value.template);
    alert('Correo de prueba enviado');
  }
}
