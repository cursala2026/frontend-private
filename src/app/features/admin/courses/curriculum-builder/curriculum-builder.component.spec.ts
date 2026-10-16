import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { of, throwError } from 'rxjs';
import { CurriculumBuilderComponent } from './curriculum-builder.component';
import { CoursesService } from '../../../../core/services/courses.service';
import { CourseCurriculumService } from '../../../../core/services/course-curriculum.service';
import { InfoService } from '../../../../core/services/info.service';
import { IModule, ILesson } from '../../../../core/models/curriculum.model';

function lesson(id: string, title: string, order: number): ILesson {
  return { _id: id, title, order, attachments: [], isFreePreview: false };
}

function courseWithModules(): { modules: IModule[] } {
  return {
    modules: [
      {
        _id: 'm1',
        title: 'Módulo 1',
        order: 1,
        lessons: [lesson('l1', 'Lección A', 1), lesson('l2', 'Lección B', 2), lesson('l3', 'Lección C', 3)],
      },
      { _id: 'm2', title: 'Módulo 2', order: 2, lessons: [lesson('l4', 'Lección D', 1)] },
    ],
  };
}

function moduleDrop(previousIndex: number, currentIndex: number, data: IModule[]): CdkDragDrop<IModule[]> {
  return { previousIndex, currentIndex, container: { data }, previousContainer: { data } } as unknown as CdkDragDrop<IModule[]>;
}

function lessonDrop(previousIndex: number, currentIndex: number, data: ILesson[]): CdkDragDrop<ILesson[]> {
  return { previousIndex, currentIndex, container: { data }, previousContainer: { data } } as unknown as CdkDragDrop<ILesson[]>;
}

describe('CurriculumBuilderComponent', () => {
  let fixture: ComponentFixture<CurriculumBuilderComponent>;
  let component: CurriculumBuilderComponent;
  let curriculum: {
    reorder: ReturnType<typeof vi.fn>;
    deleteModule: ReturnType<typeof vi.fn>;
    deleteLesson: ReturnType<typeof vi.fn>;
    createModule: ReturnType<typeof vi.fn>;
    createLesson: ReturnType<typeof vi.fn>;
    updateModule: ReturnType<typeof vi.fn>;
  };
  let courses: { getCourseById: ReturnType<typeof vi.fn> };
  let info: InfoService;

  beforeEach(async () => {
    curriculum = {
      reorder: vi.fn(() => of({})),
      deleteModule: vi.fn(() => of(undefined)),
      deleteLesson: vi.fn(() => of(undefined)),
      createModule: vi.fn(),
      createLesson: vi.fn(),
      updateModule: vi.fn(),
    };
    courses = { getCourseById: vi.fn(() => of(courseWithModules())) };

    await TestBed.configureTestingModule({
      imports: [CurriculumBuilderComponent],
      providers: [
        { provide: CourseCurriculumService, useValue: curriculum },
        { provide: CoursesService, useValue: courses },
      ],
    }).compileComponents();

    info = TestBed.inject(InfoService);
    vi.spyOn(info, 'showSuccess').mockImplementation(() => ({ id: 0, type: 'success', text: '' }));
    vi.spyOn(info, 'showError').mockImplementation(() => ({ id: 0, type: 'error', text: '' }));

    fixture = TestBed.createComponent(CurriculumBuilderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('courseId', 'course-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('carga el curso por id y renderiza los módulos con sus lecciones', () => {
    expect(courses.getCourseById).toHaveBeenCalledWith('course-1');
    expect(text()).toContain('Módulo 1');
    expect(text()).toContain('Módulo 2');
    expect(text()).toContain('Lección A');
    expect(text()).toContain('Lección D');
  });

  it('ordena módulos y lecciones por el campo order al cargar', () => {
    courses.getCourseById.mockReturnValue(
      of({
        modules: [
          { _id: 'mB', title: 'Segundo', order: 2, lessons: [] },
          { _id: 'mA', title: 'Primero', order: 1, lessons: [lesson('x2', 'Dos', 2), lesson('x1', 'Uno', 1)] },
        ],
      })
    );
    component.load();
    expect(component.modules().map((m) => m._id)).toEqual(['mA', 'mB']);
    expect(component.modules()[0].lessons.map((l) => l._id)).toEqual(['x1', 'x2']);
  });

  it('muestra un error cuando no se puede cargar el curso', () => {
    courses.getCourseById.mockReturnValue(throwError(() => new Error('fail')));
    component.load();
    fixture.detectChanges();
    expect(component.loadError()).toBe('No se pudo cargar el contenido del curso.');
  });

  it('reordena módulos, persiste el nuevo orden y calcula el índice correcto', () => {
    component.onModuleDrop(moduleDrop(0, 1, component.modules()));

    expect(component.modules().map((m) => m._id)).toEqual(['m2', 'm1']);
    expect(curriculum.reorder).toHaveBeenCalledWith('course-1', 'MODULES', ['m2', 'm1']);
    expect(info.showSuccess).toHaveBeenCalledWith('Orden de módulos guardado');
  });

  it('revierte el orden de módulos si el backend falla', () => {
    curriculum.reorder.mockReturnValue(throwError(() => new Error('fail')));
    const before = component.modules().map((m) => m._id);

    component.onModuleDrop(moduleDrop(0, 1, component.modules()));

    expect(component.modules().map((m) => m._id)).toEqual(before);
    expect(info.showError).toHaveBeenCalledWith('No se pudo guardar el nuevo orden de los módulos');
  });

  it('no llama al backend cuando el módulo se suelta en el mismo lugar', () => {
    component.onModuleDrop(moduleDrop(1, 1, component.modules()));
    expect(curriculum.reorder).not.toHaveBeenCalled();
  });

  it('reordena lecciones dentro del módulo indicado con el tipo LESSONS', () => {
    component.onLessonDrop('m1', lessonDrop(0, 2, component.modules()[0].lessons));

    const lessons = component.modules()[0].lessons.map((l) => l._id);
    expect(lessons).toEqual(['l2', 'l3', 'l1']);
    expect(curriculum.reorder).toHaveBeenCalledWith('course-1', 'LESSONS', ['l2', 'l3', 'l1'], 'm1');
    expect(component.modules()[1].lessons.map((l) => l._id)).toEqual(['l4']);
  });

  it('revierte las lecciones si el backend falla', () => {
    curriculum.reorder.mockReturnValue(throwError(() => new Error('fail')));

    component.onLessonDrop('m1', lessonDrop(2, 0, component.modules()[0].lessons));

    expect(component.modules()[0].lessons.map((l) => l._id)).toEqual(['l1', 'l2', 'l3']);
    expect(info.showError).toHaveBeenCalledWith('No se pudo guardar el nuevo orden de las lecciones');
  });

  it('pide confirmación antes de eliminar un módulo', () => {
    component.askDeleteModule('m1', 'Módulo 1');
    expect(component.confirmOpen()).toBe(true);
    expect(curriculum.deleteModule).not.toHaveBeenCalled();
    expect(component.confirmConfig().title).toBe('Eliminar módulo');
  });

  it('elimina el módulo tras confirmar', () => {
    component.askDeleteModule('m1', 'Módulo 1');
    component.confirmDelete();
    expect(curriculum.deleteModule).toHaveBeenCalledWith('course-1', 'm1');
    expect(component.modules().map((m) => m._id)).toEqual(['m2']);
  });

  it('no elimina nada al cancelar la confirmación', () => {
    component.askDeleteLesson('m1', lesson('l1', 'Lección A', 1));
    component.cancelDelete();
    expect(curriculum.deleteLesson).not.toHaveBeenCalled();
    expect(component.modules()[0].lessons).toHaveLength(3);
  });

  it('elimina solo la lección indicada tras confirmar', () => {
    component.askDeleteLesson('m1', lesson('l2', 'Lección B', 2));
    component.confirmDelete();
    expect(curriculum.deleteLesson).toHaveBeenCalledWith('course-1', 'm1', 'l2');
    expect(component.modules()[0].lessons.map((l) => l._id)).toEqual(['l1', 'l3']);
  });

  it('muestra error y no elimina la lección si el backend falla', () => {
    curriculum.deleteLesson.mockReturnValue(throwError(() => new Error('fail')));
    component.askDeleteLesson('m1', lesson('l2', 'Lección B', 2));
    component.confirmDelete();
    expect(component.modules()[0].lessons).toHaveLength(3);
    expect(info.showError).toHaveBeenCalledWith('Error al eliminar la lección');
  });

  it('agrega un módulo con el siguiente orden disponible', () => {
    curriculum.createModule.mockReturnValue(of({ _id: 'm3', title: 'Nuevo módulo 3', order: 3, lessons: [] }));
    component.addModule();
    expect(curriculum.createModule).toHaveBeenCalledWith('course-1', { title: 'Nuevo módulo 3', order: 3 });
    expect(component.modules().map((m) => m._id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('crea una lección y abre el editor para esa lección', () => {
    const created = lesson('l9', 'Nueva lección 4', 4);
    curriculum.createLesson.mockReturnValue(of(created));
    component.addLesson('m1');
    expect(curriculum.createLesson).toHaveBeenCalledWith('course-1', 'm1', {
      title: 'Nueva lección 4',
      order: 4,
      isFreePreview: false,
    });
    expect(component.editing()?.lesson._id).toBe('l9');
  });

  it('no envía acciones mientras el editor de lección está bloqueado', () => {
    component.locked.set(true);
    component.addModule();
    component.askDeleteModule('m1', 'Módulo 1');
    expect(curriculum.createModule).not.toHaveBeenCalled();
    expect(component.confirmOpen()).toBe(false);
  });

  it('renombra un módulo y actualiza el título en la lista', () => {
    curriculum.updateModule.mockReturnValue(of({}));
    component.renameModule('m1', 'Fundamentos');
    expect(curriculum.updateModule).toHaveBeenCalledWith('course-1', 'm1', { title: 'Fundamentos' });
    expect(component.modules()[0].title).toBe('Fundamentos');
  });
});
