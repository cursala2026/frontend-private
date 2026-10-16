import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { CurriculumPageComponent } from './curriculum-page.component';
import { CurriculumBuilderComponent } from '../curriculum-builder/curriculum-builder.component';
import { CoursesService } from '../../../../core/services/courses.service';
import { CourseCurriculumService } from '../../../../core/services/course-curriculum.service';
import { InfoService } from '../../../../core/services/info.service';

describe('CurriculumPageComponent', () => {
  let fixture: ComponentFixture<CurriculumPageComponent>;
  let component: CurriculumPageComponent;
  let info: InfoService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurriculumPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'course-1' } } } },
        { provide: CoursesService, useValue: { getCourseById: vi.fn(() => of({ modules: [] })) } },
        { provide: CourseCurriculumService, useValue: {} },
      ],
    }).compileComponents();

    info = TestBed.inject(InfoService);
    vi.spyOn(info, 'showError').mockImplementation(() => ({ id: 0, type: 'error', text: '' }));

    fixture = TestBed.createComponent(CurriculumPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('permite salir cuando no hay una operación en curso', () => {
    expect(component.canDeactivate()).toBe(true);
  });

  it('bloquea salir y avisa mientras el builder está bloqueado por una operación', () => {
    const builder = component.builder() as CurriculumBuilderComponent;
    builder.locked.set(true);
    expect(component.canDeactivate()).toBe(false);
    expect(info.showError).toHaveBeenCalledWith('Esperá a que termine la operación en curso antes de salir de la página');
  });
});
