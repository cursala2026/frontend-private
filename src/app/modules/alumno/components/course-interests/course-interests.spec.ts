import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseInterestsComponent } from './course-interests';

describe('CourseInterestsComponent', () => {
  let component: CourseInterestsComponent;
  let fixture: ComponentFixture<CourseInterestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseInterestsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CourseInterestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
