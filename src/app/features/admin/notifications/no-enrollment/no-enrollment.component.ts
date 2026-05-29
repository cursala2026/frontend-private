import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationsService } from '../notifications.service';

@Component({
  selector: 'app-no-enrollment',
  templateUrl: './no-enrollment.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule ]
})
export class NoEnrollmentComponent implements OnInit {
  form: FormGroup;
  usersWithoutEnrollment: any[] = [];
  saving = signal(false);

  constructor(private fb: FormBuilder, private service: NotificationsService) {
    this.form = this.fb.group({
      enabled: [false],
      sender: ['info@cursala.com.ar', Validators.required],
      template: ['', [Validators.required, Validators.minLength(10)]],
      timeWindow: ['']
    });
  }

  ngOnInit() {
    this.service.getConfig('no-enrollment').subscribe(config => {
      this.form.patchValue(config);
    });

    this.service.getNoEnrollmentUsers().subscribe(users => {
      this.usersWithoutEnrollment = users;
    });
  }

  save() {
    if (!this.form.valid) return;
    this.saving.set(true);
    this.service.updateConfig('no-enrollment', this.form.value).subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false)
    });
  }

  sendTest() {
    this.service.sendTestEmail(this.form.value).subscribe();
  }
}
