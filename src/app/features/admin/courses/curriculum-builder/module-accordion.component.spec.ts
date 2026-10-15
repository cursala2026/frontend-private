import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ModuleAccordionComponent } from './module-accordion.component';
import { IModule, ILesson } from '../../../../core/models/curriculum.model';

function lesson(id: string, title: string, order: number): ILesson {
  return { _id: id, title, order, attachments: [], isFreePreview: false };
}

const module: IModule = {
  _id: 'm1',
  title: 'Introducción',
  order: 1,
  lessons: [lesson('l1', 'Bienvenida', 1), lesson('l2', 'Instalación', 2)],
};

describe('ModuleAccordionComponent', () => {
  let fixture: ComponentFixture<ModuleAccordionComponent>;
  let component: ModuleAccordionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ModuleAccordionComponent] }).compileComponents();
    fixture = TestBed.createComponent(ModuleAccordionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('module', module);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function buttonByText(label: string): HTMLButtonElement {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const found = buttons.find((b) => b.textContent?.trim() === label);
    if (!found) throw new Error(`Botón no encontrado: ${label}`);
    return found as HTMLButtonElement;
  }

  it('renderiza el título del módulo y la cantidad de lecciones', () => {
    expect(text()).toContain('Introducción');
    expect(text()).toContain('(2 lecciones)');
  });

  it('renderiza el listado de lecciones', () => {
    expect(text()).toContain('Bienvenida');
    expect(text()).toContain('Instalación');
  });

  it('muestra un mensaje cuando el módulo no tiene lecciones', () => {
    fixture.componentRef.setInput('module', { ...module, lessons: [] });
    fixture.detectChanges();
    expect(text()).toContain('Este módulo todavía no tiene lecciones.');
  });

  it('oculta las lecciones al colapsar el acordeón', () => {
    component.toggle();
    fixture.detectChanges();
    expect(text()).not.toContain('Bienvenida');
  });

  it('emite addLesson al presionar "Agregar Lección"', () => {
    const spy = vi.spyOn(component.addLesson, 'emit');
    buttonByText('Agregar Lección').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emite deleteModule al presionar "Eliminar" del módulo', () => {
    const spy = vi.spyOn(component.deleteModule, 'emit');
    buttonByText('Eliminar').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emite editLesson con la lección correcta', () => {
    const spy = vi.spyOn(component.editLesson, 'emit');
    const editButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Editar'
    );
    editButtons[1].click();
    expect(spy).toHaveBeenCalledWith(module.lessons[1]);
  });

  it('emite deleteLesson con la lección correcta', () => {
    const spy = vi.spyOn(component.deleteLesson, 'emit');
    const deleteButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Eliminar'
    );
    deleteButtons[2].click();
    expect(spy).toHaveBeenCalledWith(module.lessons[1]);
  });

  it('emite titleSave con el título nuevo sin espacios sobrantes', () => {
    const spy = vi.spyOn(component.titleSave, 'emit');
    buttonByText('Editar Título').click();
    fixture.detectChanges();
    component.titleDraft.set('  Módulo nuevo  ');
    component.saveTitle();
    expect(spy).toHaveBeenCalledWith('Módulo nuevo');
  });

  it('no emite titleSave si el título no cambió', () => {
    const spy = vi.spyOn(component.titleSave, 'emit');
    component.startTitleEdit();
    component.saveTitle();
    expect(spy).not.toHaveBeenCalled();
  });

  it('no permite guardar un título vacío', () => {
    const spy = vi.spyOn(component.titleSave, 'emit');
    component.startTitleEdit();
    component.titleDraft.set('   ');
    expect(component.canSaveTitle()).toBe(false);
    component.saveTitle();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emite lessonDrop con el evento de arrastre', () => {
    const spy = vi.spyOn(component.lessonDrop, 'emit');
    const event = { previousIndex: 0, currentIndex: 1 } as unknown as CdkDragDrop<ILesson[]>;
    component.lessonDrop.emit(event);
    expect(spy).toHaveBeenCalledWith(event);
  });

  it('deshabilita las acciones cuando disabled es true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(buttonByText('Agregar Lección').disabled).toBe(true);
    expect(buttonByText('Eliminar').disabled).toBe(true);
  });
});
