import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { LessonEditDrawerComponent } from './lesson-edit-drawer.component';
import { CourseCurriculumService } from '../../../../core/services/course-curriculum.service';
import { InfoService } from '../../../../core/services/info.service';
import { ILesson } from '../../../../core/models/curriculum.model';

const baseLesson: ILesson = {
  _id: 'l1',
  title: 'Bienvenida',
  order: 1,
  description: 'Descripción',
  videoUrl: '',
  attachments: [{ title: 'guia.pdf', fileUrl: 'https://cdn/guia.pdf', fileType: 'application/pdf' }],
  isFreePreview: false,
};

function pdf(size = 1024): File {
  return new File([new Uint8Array(size)], 'guia.pdf', { type: 'application/pdf' });
}

function exe(): File {
  return new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
}

describe('LessonEditDrawerComponent', () => {
  let fixture: ComponentFixture<LessonEditDrawerComponent>;
  let component: LessonEditDrawerComponent;
  let curriculum: {
    updateLesson: ReturnType<typeof vi.fn>;
    uploadAttachment: ReturnType<typeof vi.fn>;
  };
  let info: InfoService;

  beforeEach(async () => {
    curriculum = {
      updateLesson: vi.fn(() => of({ ...baseLesson, title: 'Bienvenida editada' })),
      uploadAttachment: vi.fn(() => of({ type: 'done', attachment: { title: 'nuevo.pdf', fileUrl: 'u', fileType: 'application/pdf' } })),
    };

    await TestBed.configureTestingModule({
      imports: [LessonEditDrawerComponent],
      providers: [{ provide: CourseCurriculumService, useValue: curriculum }],
    }).compileComponents();

    info = TestBed.inject(InfoService);
    vi.spyOn(info, 'showSuccess').mockImplementation(() => ({ id: 0, type: 'success', text: '' }));
    vi.spyOn(info, 'showError').mockImplementation(() => ({ id: 0, type: 'error', text: '' }));

    fixture = TestBed.createComponent(LessonEditDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('courseId', 'course-1');
    fixture.componentRef.setInput('moduleId', 'm1');
    fixture.componentRef.setInput('lesson', baseLesson);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function inputFileChange(file: File | null): void {
    const input = root().querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  function saveButton(): HTMLButtonElement {
    return root().querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  it('precarga el título, la descripción, el preview y los adjuntos de la lección', () => {
    expect(component.form.getRawValue().title).toBe('Bienvenida');
    expect(component.form.getRawValue().description).toBe('Descripción');
    expect(root().textContent).toContain('guia.pdf');
  });

  it('renderiza el listado de adjuntos existentes', () => {
    const items = root().querySelectorAll('li');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('guia.pdf');
  });

  it('rechaza un adjunto con formato no permitido sin llamar al backend', () => {
    inputFileChange(exe());
    fixture.detectChanges();
    expect(curriculum.uploadAttachment).not.toHaveBeenCalled();
    expect(component.attachmentError()).toBe('Formato no permitido. Solo se aceptan archivos PDF o ZIP.');
    expect(info.showError).toHaveBeenCalled();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('PDF o ZIP');
  });

  it('rechaza un adjunto mayor a 50 MB sin llamar al backend', () => {
    const big = new File([new Uint8Array(1)], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 + 1 });
    inputFileChange(big);
    expect(curriculum.uploadAttachment).not.toHaveBeenCalled();
    expect(component.attachmentError()).toBe('El archivo supera el máximo permitido de 50 MB.');
  });

  it('sube un PDF válido, muestra el progreso y agrega el adjunto', () => {
    const progress = new Subject<{ type: 'progress' | 'done'; percent?: number; attachment?: unknown }>();
    curriculum.uploadAttachment.mockReturnValue(progress.asObservable());

    inputFileChange(pdf());
    fixture.detectChanges();

    expect(curriculum.uploadAttachment).toHaveBeenCalledWith('course-1', 'l1', expect.any(File));
    expect(component.uploading()).toBe(true);

    progress.next({ type: 'progress', percent: 40 });
    fixture.detectChanges();
    expect(component.uploadPercent()).toBe(40);
    expect(root().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');

    progress.next({ type: 'done', attachment: { title: 'nuevo.pdf', fileUrl: 'u', fileType: 'application/pdf' } });
    progress.complete();
    fixture.detectChanges();

    expect(component.uploading()).toBe(false);
    expect(component.attachments().map((a) => a.title)).toEqual(['guia.pdf', 'nuevo.pdf']);
  });

  it('bloquea guardar y cerrar mientras se sube un adjunto', () => {
    curriculum.uploadAttachment.mockReturnValue(new Subject().asObservable());
    inputFileChange(pdf());
    fixture.detectChanges();

    expect(component.busy()).toBe(true);
    expect(saveButton().disabled).toBe(true);
    expect(root().querySelector('input[type="file"]')?.hasAttribute('disabled')).toBe(true);

    component.close();
    expect(component.busy()).toBe(true);
  });

  it('libera el bloqueo y muestra error si la subida falla', () => {
    curriculum.uploadAttachment.mockReturnValue(throwError(() => new Error('502')));
    inputFileChange(pdf());
    expect(component.uploading()).toBe(false);
    expect(component.busy()).toBe(false);
    expect(info.showError).toHaveBeenCalledWith('Error al subir el adjunto');
  });

  it('elimina un adjunto existente enviando la lista sin ese ítem', () => {
    component.removeAttachment(0);
    expect(curriculum.updateLesson).toHaveBeenCalledWith('course-1', 'm1', 'l1', { attachments: [] });
    expect(component.attachments()).toEqual([]);
  });

  it('guarda los datos de la lección sin enviar los adjuntos', () => {
    const emitted = vi.spyOn(component.lessonChange, 'emit');
    component.form.patchValue({ title: '  Bienvenida editada  ', isFreePreview: true });
    component.save();

    expect(curriculum.updateLesson).toHaveBeenCalledWith('course-1', 'm1', 'l1', {
      title: 'Bienvenida editada',
      description: 'Descripción',
      isFreePreview: true,
      videoUrl: '',
    });
    expect(curriculum.updateLesson.mock.calls[0][3]).not.toHaveProperty('attachments');
    expect(emitted).toHaveBeenCalled();
  });

  it('no guarda si el título está vacío', () => {
    component.form.patchValue({ title: '' });
    component.save();
    expect(curriculum.updateLesson).not.toHaveBeenCalled();
  });

  it('rechaza una URL de video que no es https', () => {
    component.form.patchValue({ videoUrl: 'http://cdn.example.com/video.mp4' });
    expect(component.form.controls.videoUrl.valid).toBe(false);
    component.save();
    expect(curriculum.updateLesson).not.toHaveBeenCalled();
  });

  it('muestra preview embebido para una URL de Bunny Stream', () => {
    component.form.patchValue({ videoUrl: 'https://iframe.mediadelivery.net/embed/123/abc-def' });
    fixture.detectChanges();
    expect(root().querySelector('iframe')).not.toBeNull();
  });

  it('no muestra iframe para una URL que no es de Bunny Stream', () => {
    component.form.patchValue({ videoUrl: 'https://www.youtube.com/watch?v=x' });
    fixture.detectChanges();
    expect(root().querySelector('iframe')).toBeNull();
  });

  it('muestra error y no sigue si el guardado falla', () => {
    curriculum.updateLesson.mockReturnValue(throwError(() => new Error('400')));
    component.save();
    expect(info.showError).toHaveBeenCalledWith('Error al guardar la lección');
    expect(component.saving()).toBe(false);
  });
});
