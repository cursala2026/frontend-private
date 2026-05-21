import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { QuestionnairesService } from '../../services/questionnaires.service';

describe('QuestionnairesService', () => {
  let service: QuestionnairesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [QuestionnairesService] });
    service = TestBed.inject(QuestionnairesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call hasSubmissions endpoint with correct URL', () => {
    service.hasSubmissions('qid-1').subscribe(resp => {
      expect(resp).toBeDefined();
    });

    const req = httpMock.expectOne(r => r.method === 'GET' && r.url.endsWith('/questionnaires/qid-1/has-submissions'));
    expect(req).toBeTruthy();
    req.flush({ data: { hasSubmissions: true } });
  });

  it('should call updateQuestionnaire with PATCH and given payload', () => {
    const payload = { title: 'New title', questions: [{ questionText: 'Q' }] } as any;
    service.updateQuestionnaire('qid-2', payload).subscribe(resp => {
      expect(resp).toBeDefined();
    });

    const req = httpMock.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/questionnaires/qid-2'));
    expect(req.request.body).toEqual(payload);
    req.flush({ data: {} });
  });
});
