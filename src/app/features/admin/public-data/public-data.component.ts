import { Component, inject, OnInit, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PublicDataService, PublicData } from '../../../core/services/public-data.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-public-data',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './public-data.component.html'
})
export class PublicDataComponent implements OnInit {
  private publicDataService = inject(PublicDataService);
  private info = inject(InfoService);
  private fb = inject(FormBuilder);

  publicData = signal<PublicData | null>(null);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  activeTab = signal<'privacy' | 'terms'>('privacy');
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      privacyPolicy: ['', [Validators.required, Validators.minLength(10)]],
      termsOfService: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    this.loadPublicData();
  }

  setActiveTab(tab: 'privacy' | 'terms') {
    this.activeTab.set(tab);
  }

  loadPublicData() {
    this.loading.set(true);
    this.publicDataService.getAllPublicData().subscribe({
      next: (response) => {
        const data = response?.data?.[0];
        if (data) {
          this.publicData.set(data);
          this.form.patchValue({
            privacyPolicy: data.privacyPolicy,
            termsOfService: data.termsOfService
          });
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading public data:', error);
        this.info.showError('Error al cargar los datos públicos');
        this.loading.set(false);
      }
    });
  }

  onSubmit() {
    if (!this.form.valid || !this.publicData()) {
      this.info.showError('Por favor completa todos los campos correctamente');
      return;
    }

    this.saving.set(true);
    const updateData = {
      privacyPolicy: this.form.get('privacyPolicy')?.value,
      termsOfService: this.form.get('termsOfService')?.value
    };

    this.publicDataService.updatePublicData(this.publicData()!._id, updateData).subscribe({
      next: (response) => {
        this.info.showSuccess('Datos públicos actualizados correctamente');
        this.publicData.set(response.data);
        this.saving.set(false);
      },
      error: (error) => {
        console.error('Error updating public data:', error);
        this.info.showError('Error al actualizar los datos públicos');
        this.saving.set(false);
      }
    });
  }

  resetForm() {
    if (this.publicData()) {
      this.form.patchValue({
        privacyPolicy: this.publicData()!.privacyPolicy,
        termsOfService: this.publicData()!.termsOfService
      });
    }
  }
}
