import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpEventType } from '@angular/common/http';
import {
  QuestionnairesService,
  Questionnaire,
  Question,
  QuestionOption
} from '../../../../core/services/questionnaires.service';
import { CoursesService } from '../../../../core/services/courses.service';
import { ClassesService } from '../../../../core/services/classes.service';
import { InfoService } from '../../../../core/services/info.service';
import { AuthService } from '../../../../core/services/auth.service';

interface Course {
  _id: string;
  name: string;
}

interface ClassData {
  _id: string;
  name: string;
  order: number;
}

@Component({
  selector: 'app-questionnaire-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './questionnaire-edit.component.html'
})
export class QuestionnaireEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private questionnairesService = inject(QuestionnairesService);
  private coursesService = inject(CoursesService);
  private classesService = inject(ClassesService);
  private infoService = inject(InfoService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  questionnaireForm!: FormGroup;
  isEditMode = false;
  questionnaireId = '';

  courses = signal<Course[]>([]);
  classes = signal<ClassData[]>([]);
  questionnaires = signal<Questionnaire[]>([]); // Questionnaires of the selected course
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  loadingClasses = signal<boolean>(false);
  preselectedCourseId = signal<string | null>(null); // CourseId from query params
  preselectedCourseName = signal<string>(''); // Name of the preselected course

  // Media upload tracking
  mediaUploading = signal<{ [questionIndex: number]: boolean }>({});
  uploadProgress = signal<{ [questionIndex: number]: number }>({});
  mediaPreviews = signal<{ [questionIndex: number]: string }>({});
  pendingMediaFiles = signal<{ [questionIndex: number]: { file: File, promptType: 'IMAGE' | 'VIDEO' } }>({});

  ngOnInit(): void {
    this.initForm();

    // Check for preselected courseId from query params (only in create mode)
    const courseIdFromQuery = this.route.snapshot.queryParamMap.get('courseId');
    if (courseIdFromQuery) {
      this.preselectedCourseId.set(courseIdFromQuery);
      // Set the courseId directly in the form
      this.questionnaireForm.patchValue({ courseId: courseIdFromQuery });
      // Load the specific course to get its name
      this.loadPreselectedCourse(courseIdFromQuery);
      // Load classes for the preselected course
      this.loadClassesByCourse(courseIdFromQuery);
      // Load questionnaires to filter available classes
      this.loadQuestionnairesByCourse(courseIdFromQuery);
    }

    // Check if edit mode
    this.route.params.subscribe(params => {
      if (params['id'] && params['id'] !== 'new') {
        this.isEditMode = true;
        this.questionnaireId = params['id'];
        this.loadCourses();
        this.loadQuestionnaire();
      } else {
        // In create mode, load courses (needed for the dropdown if no preselected course)
        this.loadCourses();
        // Loading will be set to false after courses load
      }
    });
  }

  loadPreselectedCourse(courseId: string): void {
    this.coursesService.getCourseById(courseId).subscribe({
      next: (response) => {
        const courseData = response?.data || response;
        if (courseData) {
          // Store the course name
          this.preselectedCourseName.set(courseData.name || '');
          // Add the preselected course to the courses list if it's not already there
          const currentCourses = this.courses();
          const courseExists = currentCourses.some(c => c._id === courseId);
          if (!courseExists) {
            this.courses.set([...currentCourses, { _id: courseData._id, name: courseData.name }]);
          }
        }
      },
      error: (error) => {
        console.error('Error loading preselected course:', error);
      }
    });
  }

  initForm(): void {
    this.questionnaireForm = this.fb.group({
      courseId: ['', Validators.required],
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(1000)],
      status: ['ACTIVE', Validators.required],
      positionType: ['BETWEEN_CLASSES', Validators.required],
      afterClassId: [''],
      passingScore: [null, [Validators.min(0), Validators.max(100)]],
      allowRetries: [true],
      maxRetries: [null, Validators.min(1)],
      showCorrectAnswers: [true],
      timeLimitMinutes: [null, [Validators.min(1), Validators.max(1440)]],
      questions: this.fb.array([])
    });

    // Add at least one question by default
    this.addQuestion();

    // Subscribe to allowRetries changes to enable/disable maxRetries
    this.questionnaireForm.get('allowRetries')?.valueChanges.subscribe(allowRetries => {
      const maxRetriesControl = this.questionnaireForm.get('maxRetries');
      if (allowRetries) {
        maxRetriesControl?.enable();
      } else {
        maxRetriesControl?.disable();
      }
    });
  }

  get questions(): FormArray {
    return this.questionnaireForm.get('questions') as FormArray;
  }

  getPreselectedCourseName(): string {
    if (this.preselectedCourseName()) {
      return this.preselectedCourseName();
    }
    const preselectedId = this.preselectedCourseId();
    if (preselectedId) {
      const course = this.courses().find(c => c._id === preselectedId);
      return course?.name || 'Cargando...';
    }
    return '';
  }

  loadCourses(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      if (!this.isEditMode) {
        this.loading.set(false);
      }
      return;
    }

    // If we have a preselected courseId, we still need to load courses for the dropdown
    // but we'll hide/disable it if courseId is preselected
    this.coursesService.getTeacherCourses(currentUser._id).subscribe({
      next: (response) => {
        const coursesData = response?.data || [];
        this.courses.set(coursesData);
        
        // If in create mode and we have a preselected courseId, ensure it's set in the form
        if (!this.isEditMode && this.preselectedCourseId()) {
          const courseIdFromQuery = this.preselectedCourseId();
          const courseIdControl = this.questionnaireForm.get('courseId');
          if (courseIdControl && courseIdControl.value !== courseIdFromQuery) {
            courseIdControl.setValue(courseIdFromQuery, { emitEvent: false });
          }
        }
        
        if (!this.isEditMode) {
          this.loading.set(false);
        }
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.infoService.showError('Error al cargar los cursos');
        if (!this.isEditMode) {
          this.loading.set(false);
        }
      }
    });
  }

  onCourseChange(): void {
    const courseId = this.questionnaireForm.get('courseId')?.value;
    if (courseId) {
      this.loadClassesByCourse(courseId);
      // Load questionnaires to filter out classes that already have questionnaires after them
      this.loadQuestionnairesByCourse(courseId);
    } else {
      this.classes.set([]);
      this.questionnaires.set([]);
    }
  }

  loadQuestionnairesByCourse(courseId: string): void {
    this.questionnairesService.getQuestionnairesByCourse(courseId).subscribe({
      next: (response) => {
        const questionnairesData = response?.data || [];
        this.questionnaires.set(questionnairesData);
      },
      error: (error) => {
        console.error('Error loading questionnaires:', error);
        this.questionnaires.set([]);
      }
    });
  }

  getAvailableClassesForQuestionnaire(): ClassData[] {
    const allClasses = this.classes();
    const courseQuestionnaires = this.questionnaires();
    const currentQuestionnaireId = this.questionnaireId; // Current questionnaire being edited
    
    // Get class IDs that already have a questionnaire after them (excluding current questionnaire if editing)
    const classesWithQuestionnaires = new Set(
      courseQuestionnaires
        .filter(q => 
          q._id !== currentQuestionnaireId && // Exclude current questionnaire if editing
          q.position?.type === 'BETWEEN_CLASSES' && 
          q.position?.afterClassId
        )
        .map(q => q.position!.afterClassId!)
    );
    
    // Filter out classes that already have questionnaires after them
    return allClasses.filter(classItem => !classesWithQuestionnaires.has(classItem._id));
  }

  loadClassesByCourse(courseId: string): void {
    this.loadingClasses.set(true);

    this.classesService.getClassesByCourse(courseId).subscribe({
      next: (response) => {
        const classesData = response?.data || [];
        this.classes.set(classesData.sort((a: ClassData, b: ClassData) => a.order - b.order));
        this.loadingClasses.set(false);
      },
      error: (error) => {
        console.error('Error loading classes:', error);
        this.infoService.showError('Error al cargar las clases');
        this.loadingClasses.set(false);
      }
    });
  }

  loadQuestionnaire(): void {
    this.questionnairesService.getQuestionnaireById(this.questionnaireId).subscribe({
      next: (response) => {
        const questionnaire: Questionnaire = response?.data;
        this.populateForm(questionnaire);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading questionnaire:', error);
        this.infoService.showError('Error al cargar el cuestionario');
        this.router.navigate(['/profesor/questionnaires']);
      }
    });
  }

  populateForm(questionnaire: Questionnaire): void {
    // Load classes for the course first
    this.loadClassesByCourse(questionnaire.courseId);
    // Load questionnaires to filter available classes
    this.loadQuestionnairesByCourse(questionnaire.courseId);

    // Clear existing questions
    while (this.questions.length) {
      this.questions.removeAt(0);
    }

    // Populate form
    this.questionnaireForm.patchValue({
      courseId: questionnaire.courseId,
      title: questionnaire.title,
      description: questionnaire.description || '',
      status: questionnaire.status,
      positionType: questionnaire.position.type,
      afterClassId: questionnaire.position.afterClassId || '',
      passingScore: questionnaire.passingScore,
      allowRetries: questionnaire.allowRetries,
      maxRetries: questionnaire.maxRetries,
      showCorrectAnswers: questionnaire.showCorrectAnswers,
      timeLimitMinutes: questionnaire.timeLimitMinutes || null
    });

    // Add questions
    questionnaire.questions.forEach(question => {
      this.addQuestionFromData(question);
    });
    
    // After all questions are added, ensure correctOptionId values are set
    setTimeout(() => {
      this.questions.controls.forEach((questionGroup, index) => {
        if (questionGroup.get('type')?.value === 'MULTIPLE_CHOICE') {
          const correctOptionIdControl = questionGroup.get('correctOptionId');
          const originalCorrectOptionId = questionGroup.get('originalCorrectOptionId')?.value;
          
          if (originalCorrectOptionId && correctOptionIdControl) {
            // Find the index of the option with the original ObjectId
            const optionsArray = questionGroup.get('options') as FormArray;
            const correctIndex = optionsArray.controls.findIndex((opt: any) => {
              const optId = opt.get('_id')?.value;
              return optId && optId.toString() === originalCorrectOptionId.toString();
            });
            
            if (correctIndex >= 0 && correctOptionIdControl.value !== correctIndex.toString()) {
              correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
              this.cdr.detectChanges();
            }
          }
        }
      });
    }, 200);
  }

  createQuestionGroup(question?: Question): FormGroup {
    const group = this.fb.group({
      type: [question?.type || 'MULTIPLE_CHOICE', Validators.required],
      questionText: [question?.questionText || '', [Validators.required, Validators.maxLength(1000)]],
      points: [question?.points || 10, [Validators.required, Validators.min(1)]],
      required: [question?.required ?? true],
      options: this.fb.array([]),
      correctOptionId: [''], // This will store the index as string for the radio button
      originalCorrectOptionId: [question?.correctOptionId || null], // Store original ObjectId from backend
      promptType: [question?.promptType || 'TEXT'],
      promptMediaUrl: [question?.promptMediaUrl || ''],
      promptMediaProvider: [question?.promptMediaProvider || 'BUNNY']
    });

    // If multiple choice, add options
    if (question && question.type === 'MULTIPLE_CHOICE' && question.options) {
      const optionsArray = group.get('options') as FormArray;
      question.options.forEach(opt => {
        optionsArray.push(this.createOptionGroup(opt));
      });
      
      // Set correctOptionId after options are added
      // If correctOptionId is an ObjectId, find its index
      if (question.correctOptionId) {
        const correctOptionIdStr = question.correctOptionId.toString();
        
        // Check if it's an ObjectId (24 hex characters)
        if (correctOptionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(correctOptionIdStr)) {
          // Find the index of the option with this _id
          const correctIndex = question.options.findIndex(
            (opt: any) => opt._id?.toString() === correctOptionIdStr
          );
          
          if (correctIndex >= 0) {
            // Store the original ObjectId for later use when saving
            group.patchValue({ originalCorrectOptionId: correctOptionIdStr }, { emitEvent: false });
            
            // Use string for radio button compatibility (HTML inputs use strings)
            const correctOptionIdControl = group.get('correctOptionId');
            if (correctOptionIdControl) {
              // Set value immediately
              correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
              // Also use setTimeout as backup to ensure it's set after render
              setTimeout(() => {
                correctOptionIdControl.setValue(correctIndex.toString(), { emitEvent: false });
                this.cdr.detectChanges(); // Force change detection
              }, 100);
            }
          } else {
            // If not found, try to parse as index
            const parsedIndex = parseInt(correctOptionIdStr);
            if (!isNaN(parsedIndex) && parsedIndex >= 0) {
              group.get('correctOptionId')?.setValue(parsedIndex.toString(), { emitEvent: false });
            } else {
              // If not found, keep the ObjectId (will be handled on save)
              group.get('correctOptionId')?.setValue(correctOptionIdStr, { emitEvent: false });
            }
          }
        } else {
          // It's already an index or other value - try to parse as number then convert to string
          const parsedIndex = parseInt(correctOptionIdStr);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            group.get('correctOptionId')?.setValue(parsedIndex.toString(), { emitEvent: false });
          } else {
            group.get('correctOptionId')?.setValue(correctOptionIdStr, { emitEvent: false });
          }
        }
      }
    } else if (!question || question.type === 'MULTIPLE_CHOICE') {
      // Add default 4 options for new MC questions
      const optionsArray = group.get('options') as FormArray;
      for (let i = 0; i < 4; i++) {
        optionsArray.push(this.createOptionGroup());
      }
    }

    return group;
  }

  createOptionGroup(option?: QuestionOption): FormGroup {
    return this.fb.group({
      _id: [option?._id || null], // Preserve existing option ID
      text: [option?.text || '', [Validators.required, Validators.maxLength(500)]],
      order: [option?.order || 0]
    });
  }

  addQuestion(): void {
    this.questions.push(this.createQuestionGroup());
  }

  addQuestionFromData(question: Question): void {
    this.questions.push(this.createQuestionGroup(question));
  }

  removeQuestion(index: number): void {
    if (this.questions.length > 1) {
      this.questions.removeAt(index);
    } else {
      this.infoService.showError('Debe haber al menos una pregunta');
    }
  }

  getQuestionOptions(questionIndex: number): FormArray {
    return this.questions.at(questionIndex).get('options') as FormArray;
  }

  addOption(questionIndex: number): void {
    const options = this.getQuestionOptions(questionIndex);
    options.push(this.createOptionGroup());
  }

  removeOption(questionIndex: number, optionIndex: number): void {
    const options = this.getQuestionOptions(questionIndex);
    if (options.length > 2) {
      options.removeAt(optionIndex);
    } else {
      this.infoService.showError('Debe haber al menos 2 opciones');
    }
  }

  onQuestionTypeChange(questionIndex: number): void {
    const question = this.questions.at(questionIndex);
    const type = question.get('type')?.value;
    const optionsArray = question.get('options') as FormArray;

    // Clear options
    while (optionsArray.length) {
      optionsArray.removeAt(0);
    }

    // If MC, add default options
    if (type === 'MULTIPLE_CHOICE') {
      for (let i = 0; i < 4; i++) {
        optionsArray.push(this.createOptionGroup());
      }
    }

    // Clear correct option
    question.patchValue({ correctOptionId: '' });
  }

  onSubmit(): void {
    if (this.questionnaireForm.invalid) {
      this.questionnaireForm.markAllAsTouched();
      this.infoService.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    // Validate that MC questions have correct answer selected
    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions.at(i);
      if (question.get('type')?.value === 'MULTIPLE_CHOICE') {
        if (!question.get('correctOptionId')?.value) {
          this.infoService.showError(`Debes seleccionar la respuesta correcta para la pregunta ${i + 1}`);
          return;
        }
      }
    }

    this.saving.set(true);

    const formValue = this.questionnaireForm.value;

    // Process questions
    const questions: Question[] = formValue.questions.map((q: any, index: number) => {
      const question: Question = {
        type: q.type,
        questionText: q.questionText,
        order: index,
        points: q.points,
        required: q.required,
        promptType: q.promptType || 'TEXT',
        promptMediaUrl: q.promptMediaUrl || undefined,
        promptMediaProvider: q.promptMediaProvider || undefined
      };

      if (q.type === 'MULTIPLE_CHOICE') {
        question.options = q.options.map((opt: any, optIndex: number) => ({
          _id: opt._id || undefined, // Preserve existing option ID if editing
          text: opt.text,
          order: optIndex
        }));

        // Find the correct option ID
        // Priority: Use the selected option's _id (from form), not the original
        if (q.correctOptionId !== null && q.correctOptionId !== undefined && q.correctOptionId !== '') {
          const correctOptionIdStr = q.correctOptionId.toString();
          
          // Check if it's an ObjectId (24 hex characters)
          if (correctOptionIdStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(correctOptionIdStr)) {
            // It's an ObjectId, verify it exists in options
            const correctOption = question.options?.find((opt: any) => opt._id?.toString() === correctOptionIdStr);
            if (correctOption) {
              // Use the ObjectId directly
              question.correctOptionId = correctOptionIdStr;
            } else {
              // ObjectId not found in options - this shouldn't happen, but try to use original as fallback
              const originalCorrectOptionId = q.originalCorrectOptionId;
              if (originalCorrectOptionId && typeof originalCorrectOptionId === 'string' && originalCorrectOptionId.length === 24) {
                question.correctOptionId = originalCorrectOptionId;
              } else {
                question.correctOptionId = correctOptionIdStr;
              }
            }
          } else {
            // It's likely an index (number or string number)
            const selectedOptionIndex = parseInt(correctOptionIdStr);
            if (!isNaN(selectedOptionIndex) && selectedOptionIndex >= 0 && question.options && question.options[selectedOptionIndex]) {
              // Check if the option has an existing _id (editing mode)
              const selectedOption = question.options[selectedOptionIndex];
              const originalCorrectOptionId = q.originalCorrectOptionId;
              
              if (selectedOption._id) {
                // ALWAYS use originalCorrectOptionId if it matches the selected option's _id
                // This ensures we don't send a different ObjectId for the same option
                if (originalCorrectOptionId && 
                    typeof originalCorrectOptionId === 'string' && 
                    originalCorrectOptionId.length === 24 &&
                    selectedOption._id.toString() === originalCorrectOptionId) {
                  // Same option as original, use originalCorrectOptionId to avoid false positives
                  question.correctOptionId = originalCorrectOptionId;
                } else {
                  // Different option selected - check if originalCorrectOptionId exists in any option
                  // If it does, and it's not the selected one, the user changed the answer
                  const originalOptionExists = question.options?.some((opt: any) => opt._id?.toString() === originalCorrectOptionId);
                  if (originalOptionExists && originalCorrectOptionId !== selectedOption._id.toString()) {
                    // User changed the answer - use the new ObjectId
                    question.correctOptionId = selectedOption._id.toString();
                  } else {
                    // Use the selected option's ObjectId
                    question.correctOptionId = selectedOption._id.toString();
                  }
                }
              } else {
                // New option, use index as string (backend will convert to ObjectId)
                question.correctOptionId = selectedOptionIndex.toString();
              }
            } else {
              // Invalid index - try to use originalCorrectOptionId as fallback
              const originalCorrectOptionId = q.originalCorrectOptionId;
              if (originalCorrectOptionId && typeof originalCorrectOptionId === 'string' && originalCorrectOptionId.length === 24) {
                question.correctOptionId = originalCorrectOptionId;
              } else {
                // Invalid value - this shouldn't happen, but try to use as-is, backend will validate
                question.correctOptionId = correctOptionIdStr;
              }
            }
          }
        } else {
          // No correctOptionId set - try to use originalCorrectOptionId as fallback
          const originalCorrectOptionId = q.originalCorrectOptionId;
          if (originalCorrectOptionId && typeof originalCorrectOptionId === 'string' && originalCorrectOptionId.length === 24) {
            question.correctOptionId = originalCorrectOptionId;
          } else {
            // No correctOptionId set - this is an error for MULTIPLE_CHOICE
            throw new Error(`La pregunta ${index + 1} de opción múltiple debe tener una respuesta correcta seleccionada`);
          }
        }
      }

      return question;
    });

    const questionnaireData: Partial<Questionnaire> = {
      courseId: formValue.courseId,
      title: formValue.title,
      description: formValue.description,
      status: formValue.status,
      position: {
        type: formValue.positionType,
        afterClassId: formValue.positionType === 'BETWEEN_CLASSES' ? formValue.afterClassId : undefined
      },
      questions,
      passingScore: formValue.passingScore,
      allowRetries: formValue.allowRetries,
      maxRetries: formValue.allowRetries ? formValue.maxRetries : undefined,
      showCorrectAnswers: formValue.showCorrectAnswers,
      timeLimitMinutes: formValue.timeLimitMinutes || undefined
    };

    const request = this.isEditMode
      ? this.questionnairesService.updateQuestionnaire(this.questionnaireId, questionnaireData)
      : this.questionnairesService.createQuestionnaire(questionnaireData);

    request.subscribe({
      next: (response) => {
        const savedQuestionnaire = response?.data;
        
        // Si es modo creación y hay archivos pendientes, subirlos
        if (!this.isEditMode && savedQuestionnaire && Object.keys(this.pendingMediaFiles()).length > 0) {
          this.questionnaireId = savedQuestionnaire._id;
          this.isEditMode = true; // Cambiar a modo edición para los uploads
          this.uploadPendingMediaFiles(savedQuestionnaire, formValue.courseId);
        } else {
          this.infoService.showSuccess(
            this.isEditMode ? 'Cuestionario actualizado exitosamente' : 'Cuestionario creado exitosamente'
          );
          this.router.navigate(['/profesor/questionnaires'], {
            queryParams: { courseId: formValue.courseId }
          });
        }
      },
      error: (error) => {
        console.error('Error saving questionnaire:', error);
        const errorMsg = error?.error?.message || 'Error al guardar el cuestionario';
        this.infoService.showError(errorMsg);
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/profesor/questionnaires']);
  }

  // ==================== MEDIA UPLOAD METHODS ====================

  onMediaFileSelected(event: Event, questionIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    
    // Validar tipo de archivo
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];
    const allAllowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

    if (!allAllowedTypes.includes(file.type)) {
      this.infoService.showError('Tipo de archivo no permitido. Usa: JPG, PNG, GIF, MP4, WEBM, OGG, AVI, MOV');
      input.value = '';
      return;
    }

    // Validar tamaño (1GB = 1073741824 bytes)
    const maxSize = 1073741824;
    if (file.size > maxSize) {
      this.infoService.showError('El archivo es demasiado grande. Tamaño máximo: 1GB');
      input.value = '';
      return;
    }

    // Determinar el tipo de media
    let promptType: 'IMAGE' | 'VIDEO';
    if (allowedImageTypes.includes(file.type)) {
      promptType = 'IMAGE';
    } else {
      promptType = 'VIDEO';
    }

    // Crear preview local
    const previewUrl = URL.createObjectURL(file);
    const currentPreviews = this.mediaPreviews();
    this.mediaPreviews.set({ ...currentPreviews, [questionIndex]: previewUrl });

    // Actualizar el formulario
    const question = this.questions.at(questionIndex);
    question.patchValue({ promptType });

    // Si estamos editando, subir inmediatamente
    if (this.isEditMode) {
      this.uploadMedia(file, questionIndex, promptType);
    } else {
      // En modo creación, guardar el archivo para subir después de crear el cuestionario
      const currentPending = this.pendingMediaFiles();
      this.pendingMediaFiles.set({ ...currentPending, [questionIndex]: { file, promptType } });
      this.infoService.showInfo('El archivo se subirá automáticamente al crear el cuestionario');
    }
  }

  uploadMedia(file: File, questionIndex: number, promptType: 'IMAGE' | 'VIDEO'): void {
    const question = this.questions.at(questionIndex);
    const questionId = question.value._id;

    if (!questionId) {
      this.infoService.showError('Debes guardar el cuestionario primero antes de subir archivos multimedia');
      return;
    }

    // Marcar como subiendo
    const currentUploading = this.mediaUploading();
    this.mediaUploading.set({ ...currentUploading, [questionIndex]: true });

    const currentProgress = this.uploadProgress();
    this.uploadProgress.set({ ...currentProgress, [questionIndex]: 0 });

    this.questionnairesService.uploadQuestionMedia(
      this.questionnaireId,
      questionId,
      file,
      promptType
    ).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          // Actualizar progreso
          const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
          const currentProgress = this.uploadProgress();
          this.uploadProgress.set({ ...currentProgress, [questionIndex]: percentDone });
        } else if (event.type === HttpEventType.Response) {
          // Upload completado
          const updatedQuestionnaire = event.body?.data;
          if (updatedQuestionnaire) {
            // Actualizar la pregunta con la nueva URL
            const updatedQuestion = updatedQuestionnaire.questions.find(
              (q: Question) => q._id === questionId
            );
            if (updatedQuestion) {
              question.patchValue({
                promptMediaUrl: updatedQuestion.promptMediaUrl,
                promptMediaProvider: updatedQuestion.promptMediaProvider
              });
            }
          }
          
          // Limpiar estado de upload
          const currentUploading = this.mediaUploading();
          delete currentUploading[questionIndex];
          this.mediaUploading.set({ ...currentUploading });

          const currentProgress = this.uploadProgress();
          delete currentProgress[questionIndex];
          this.uploadProgress.set({ ...currentProgress });

          this.infoService.showSuccess('Archivo multimedia subido exitosamente');
        }
      },
      error: (error) => {
        console.error('Error uploading media:', error);
        const errorMsg = error?.error?.message || 'Error al subir el archivo multimedia';
        this.infoService.showError(errorMsg);

        // Limpiar estado de upload
        const currentUploading = this.mediaUploading();
        delete currentUploading[questionIndex];
        this.mediaUploading.set({ ...currentUploading });

        const currentProgress = this.uploadProgress();
        delete currentProgress[questionIndex];
        this.uploadProgress.set({ ...currentProgress });

        // Limpiar preview
        const currentPreviews = this.mediaPreviews();
        if (currentPreviews[questionIndex]) {
          URL.revokeObjectURL(currentPreviews[questionIndex]);
          delete currentPreviews[questionIndex];
          this.mediaPreviews.set({ ...currentPreviews });
        }
      }
    });
  }

  removeMedia(questionIndex: number): void {
    const question = this.questions.at(questionIndex);
    question.patchValue({
      promptType: 'TEXT',
      promptMediaUrl: '',
      promptMediaProvider: 'BUNNY'
    });

    // Limpiar preview
    const currentPreviews = this.mediaPreviews();
    if (currentPreviews[questionIndex]) {
      URL.revokeObjectURL(currentPreviews[questionIndex]);
      delete currentPreviews[questionIndex];
      this.mediaPreviews.set({ ...currentPreviews });
    }

    // Limpiar archivos pendientes
    const currentPending = this.pendingMediaFiles();
    if (currentPending[questionIndex]) {
      delete currentPending[questionIndex];
      this.pendingMediaFiles.set({ ...currentPending });
    }

    // TODO: Llamar al backend para eliminar el archivo si es necesario
    this.infoService.showSuccess('Archivo multimedia eliminado');
  }

  getMediaPreview(questionIndex: number): string | null {
    const question = this.questions.at(questionIndex);
    const promptMediaUrl = question.value.promptMediaUrl;
    const localPreview = this.mediaPreviews()[questionIndex];

    return localPreview || promptMediaUrl || null;
  }

  isMediaUploading(questionIndex: number): boolean {
    return this.mediaUploading()[questionIndex] || false;
  }

  getUploadProgress(questionIndex: number): number {
    return this.uploadProgress()[questionIndex] || 0;
  }

  uploadPendingMediaFiles(questionnaire: Questionnaire, courseId: string): void {
    const pendingFiles = this.pendingMediaFiles();
    const questionIndexes = Object.keys(pendingFiles).map(k => parseInt(k));
    
    if (questionIndexes.length === 0) {
      this.infoService.showSuccess('Cuestionario creado exitosamente');
      this.router.navigate(['/profesor/questionnaires'], {
        queryParams: { courseId }
      });
      return;
    }

    this.infoService.showInfo(`Subiendo ${questionIndexes.length} archivo(s) multimedia...`);
    
    let uploadedCount = 0;
    let hasErrors = false;

    questionIndexes.forEach(questionIndex => {
      const pendingFile = pendingFiles[questionIndex];
      const question = questionnaire.questions[questionIndex];
      
      if (!question || !question._id) {
        console.error(`No se encontró la pregunta en el índice ${questionIndex}`);
        uploadedCount++;
        if (uploadedCount === questionIndexes.length) {
          this.finishPendingUploads(hasErrors, courseId);
        }
        return;
      }

      // Actualizar el cuestionario form con el _id de la pregunta
      const questionControl = this.questions.at(questionIndex);
      questionControl.patchValue({ _id: question._id });

      this.uploadMediaWithCallback(
        pendingFile.file,
        questionIndex,
        pendingFile.promptType,
        question._id,
        () => {
          uploadedCount++;
          if (uploadedCount === questionIndexes.length) {
            this.finishPendingUploads(hasErrors, courseId);
          }
        },
        () => {
          hasErrors = true;
          uploadedCount++;
          if (uploadedCount === questionIndexes.length) {
            this.finishPendingUploads(hasErrors, courseId);
          }
        }
      );
    });
  }

  uploadMediaWithCallback(
    file: File,
    questionIndex: number,
    promptType: 'IMAGE' | 'VIDEO',
    questionId: string,
    onSuccess: () => void,
    onError: () => void
  ): void {
    // Marcar como subiendo
    const currentUploading = this.mediaUploading();
    this.mediaUploading.set({ ...currentUploading, [questionIndex]: true });

    const currentProgress = this.uploadProgress();
    this.uploadProgress.set({ ...currentProgress, [questionIndex]: 0 });

    this.questionnairesService.uploadQuestionMedia(
      this.questionnaireId,
      questionId,
      file,
      promptType
    ).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
          const currentProgress = this.uploadProgress();
          this.uploadProgress.set({ ...currentProgress, [questionIndex]: percentDone });
        } else if (event.type === HttpEventType.Response) {
          const updatedQuestionnaire = event.body?.data;
          if (updatedQuestionnaire) {
            const updatedQuestion = updatedQuestionnaire.questions.find(
              (q: Question) => q._id === questionId
            );
            if (updatedQuestion) {
              const question = this.questions.at(questionIndex);
              question.patchValue({
                promptMediaUrl: updatedQuestion.promptMediaUrl,
                promptMediaProvider: updatedQuestion.promptMediaProvider
              });
            }
          }
          
          // Limpiar estado
          const currentUploading = this.mediaUploading();
          delete currentUploading[questionIndex];
          this.mediaUploading.set({ ...currentUploading });

          const currentProgress = this.uploadProgress();
          delete currentProgress[questionIndex];
          this.uploadProgress.set({ ...currentProgress });

          // Limpiar pending
          const currentPending = this.pendingMediaFiles();
          delete currentPending[questionIndex];
          this.pendingMediaFiles.set({ ...currentPending });

          onSuccess();
        }
      },
      error: (error) => {
        console.error('Error uploading media:', error);
        
        // Limpiar estado
        const currentUploading = this.mediaUploading();
        delete currentUploading[questionIndex];
        this.mediaUploading.set({ ...currentUploading });

        const currentProgress = this.uploadProgress();
        delete currentProgress[questionIndex];
        this.uploadProgress.set({ ...currentProgress });

        onError();
      }
    });
  }

  finishPendingUploads(hasErrors: boolean, courseId: string): void {
    this.saving.set(false);
    
    if (hasErrors) {
      this.infoService.showError('Cuestionario creado, pero algunos archivos multimedia no se pudieron subir');
    } else {
      this.infoService.showSuccess('Cuestionario creado exitosamente con todos los archivos multimedia');
    }
    
    this.router.navigate(['/profesor/questionnaires'], {
      queryParams: { courseId }
    });
  }
}
