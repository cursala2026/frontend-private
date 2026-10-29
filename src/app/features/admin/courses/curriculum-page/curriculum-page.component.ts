import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurriculumBuilderComponent } from '../curriculum-builder/curriculum-builder.component';
import { InfoService } from '../../../../core/services/info.service';

@Component({
  selector: 'app-curriculum-page',
  standalone: true,
  imports: [RouterLink, CurriculumBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl space-y-6 p-6">
      <a
        [routerLink]="['/admin/courses', courseId, 'edit-async']"
        class="text-sm text-blue-700 hover:underline"
      >&larr; Volver a los datos del curso</a>
      @if (courseId) {
        <app-curriculum-builder [courseId]="courseId" />
      }
    </div>
  `,
})
export class CurriculumPageComponent {
  private info = inject(InfoService);
  courseId = inject(ActivatedRoute).snapshot.paramMap.get('courseId') ?? '';
  builder = viewChild(CurriculumBuilderComponent);

  canDeactivate(): boolean {
    if (this.builder()?.locked()) {
      this.info.showError('Esperá a que termine la operación en curso antes de salir de la página');
      return false;
    }
    return true;
  }
}
