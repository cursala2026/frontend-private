import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseInterests } from './course-interests';

describe('CourseInterests', () => {
  let component: CourseInterests;
  let fixture: ComponentFixture<CourseInterests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseInterests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourseInterests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
