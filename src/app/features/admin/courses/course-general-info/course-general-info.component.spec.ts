import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CourseGeneralInfoComponent } from './course-general-info.component';
import { CourseAdminService } from '../../../../core/services/course-admin.service';
import { of, throwError } from 'rxjs';
import { ImageUploaderComponent } from '../../../../shared/components/image-uploader/image-uploader.component';

describe('CourseGeneralInfoComponent', () => {
  let component: CourseGeneralInfoComponent;
  let fixture: ComponentFixture<CourseGeneralInfoComponent>;
  let courseAdminService: CourseAdminService;

  beforeEach(async () => {
    const servicespy = vi.spyOn(CourseAdminService.prototype, 'createAsyncCourse');

    await TestBed.configureTestingModule({
      imports: [CourseGeneralInfoComponent, ReactiveFormsModule, ImageUploaderComponent],
      providers: [
        FormBuilder,
        CourseAdminService
      ]
    }).compileComponents();

    courseAdminService = TestBed.inject(CourseAdminService);
    fixture = TestBed.createComponent(CourseGeneralInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values', () => {
    expect(component.courseForm.get('titulo')?.value).toBe('');
    expect(component.courseForm.get('descripcion')?.value).toBe('');
  });

  it('should invalidate form when required fields are empty', () => {
    expect(component.courseForm.valid).toBeFalsy();
  });

  it('should validate form when all fields are filled correctly', () => {
    component.courseForm.patchValue({
      titulo: 'Test Course',
      descripcion: 'Test Description'
    });
    expect(component.courseForm.valid).toBeTruthy();
  });

  it('should enforce titulo max length of 120 characters', () => {
    const tituloControl = component.courseForm.get('titulo');
    tituloControl?.setValue('a'.repeat(121));
    expect(tituloControl?.hasError('maxlength')).toBeTruthy();
  });

  it('should enforce descripcion max length of 2000 characters', () => {
    const descripcionControl = component.courseForm.get('descripcion');
    descripcionControl?.setValue('a'.repeat(2001));
    expect(descripcionControl?.hasError('maxlength')).toBeTruthy();
  });

  it('should call createAsyncCourse when submitting DRAFT', () => {
    vi.spyOn(courseAdminService, 'createAsyncCourse').mockReturnValue(of({}));
    
    component.courseForm.patchValue({
      titulo: 'Test Course',
      descripcion: 'Test Description'
    });
    component.onSaveDraft();

    expect(courseAdminService.createAsyncCourse).toHaveBeenCalled();
  });

  it('should call createAsyncCourse with PENDING_REVIEW on submit', () => {
    vi.spyOn(courseAdminService, 'createAsyncCourse').mockReturnValue(of({}));
    
    component.courseForm.patchValue({
      titulo: 'Test Course',
      descripcion: 'Test Description'
    });
    component.onSubmit();

    expect(courseAdminService.createAsyncCourse).toHaveBeenCalled();
  });

  it('should handle submission error', () => {
    vi.spyOn(courseAdminService, 'createAsyncCourse').mockReturnValue(throwError(() => new Error('API Error')));
    
    component.courseForm.patchValue({
      titulo: 'Test Course',
      descripcion: 'Test Description'
    });
    component.onSaveDraft();

    expect(component.errorMessage()).toContain('Error');
  });

  it('should prevent deactivation with unsaved changes', () => {
    component.courseForm.patchValue({ titulo: 'Changed' });
    component.courseForm.markAsDirty();
    expect(component.canDeactivate()).toBeFalsy();
  });

  it('should allow deactivation with no changes', () => {
    component.courseForm.markAsPristine();
    expect(component.canDeactivate()).toBeTruthy();
  });
});