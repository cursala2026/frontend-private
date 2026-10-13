import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CourseGeneralInfoComponent } from './course-general-info.component';
import { CourseAdminService } from '../../../../core/services/course-admin.service';
import { CoursesService } from '../../../../core/services/courses.service';
import { of, throwError } from 'rxjs';
import { ImageUploaderComponent } from '../../../../shared/components/image-uploader/image-uploader.component';

describe('CourseGeneralInfoComponent', () => {
  let component: CourseGeneralInfoComponent;
  let fixture: ComponentFixture<CourseGeneralInfoComponent>;
  let courseAdminService: CourseAdminService;

  beforeEach(async () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('should block PENDING_REVIEW submit when the course has no modules with lessons', () => {
    vi.spyOn(courseAdminService, 'createAsyncCourse').mockReturnValue(of({}));

    component.courseForm.patchValue({
      titulo: 'Test Course',
      descripcion: 'Test Description'
    });
    component.onSubmit();

    expect(courseAdminService.createAsyncCourse).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('modulo');
  });

  it('should call createAsyncCourse with PENDING_REVIEW on submit when the course has content', () => {
    vi.spyOn(courseAdminService, 'createAsyncCourse').mockReturnValue(of({}));

    component.courseForm.patchValue({
      titulo: 'Test Course',
      descripcion: 'Test Description'
    });
    component.hasContent.set(true);
    component.onSubmit();

    expect(courseAdminService.createAsyncCourse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING_REVIEW' })
    );
  });

  it('should use updateAsyncCourse instead of createAsyncCourse when editing an existing course', () => {
    const coursesService = TestBed.inject(CoursesService);
    vi.spyOn(coursesService, 'getCourseById').mockReturnValue(of({
      _id: 'abc123',
      name: 'Existing Course',
      description: 'Existing Description',
      status: 'DRAFT',
      modules: [{ title: 'M1', lessons: [{ title: 'L1' }] }]
    }));
    const createSpy = vi.spyOn(courseAdminService, 'createAsyncCourse');
    const updateSpy = vi.spyOn(courseAdminService, 'updateAsyncCourse').mockReturnValue(of({}));

    component['courseId'] = 'abc123';
    component['loadCourse']('abc123');
    component.onSaveDraft();

    expect(coursesService.getCourseById).toHaveBeenCalled();
    expect(component.courseForm.get('titulo')?.value).toBe('Existing Course');
    expect(component.hasContent()).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith('abc123', expect.objectContaining({ status: 'DRAFT' }));
    expect(createSpy).not.toHaveBeenCalled();
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