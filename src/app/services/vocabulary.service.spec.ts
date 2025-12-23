import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VocabularyService } from './vocabulary.service';
import { Word } from '../models/word.interface';

describe('VocabularyService', () => {
  let service: VocabularyService;
  let httpMock: HttpTestingController;

  const mockWords: Word[] = [
    {
      word: 'test-word',
      type: 'n.',
      definition: 'A test definition'
    },
    {
      word: 'another-word',
      type: 'v.',
      definition: 'Another test definition'
    },
    {
      word: 'third-word',
      type: 'adj.',
      definition: 'A third test definition'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VocabularyService]
    });
    service = TestBed.inject(VocabularyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch words from /words.json', () => {
    service.getWords().subscribe((words: Word[]) => {
      expect(words).toEqual(mockWords);
      expect(words.length).toBe(3);
      expect(words[0].word).toBe('test-word');
      expect(words[1].definition).toBe('Another test definition');
    });

    const req = httpMock.expectOne('/words.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockWords);
  });

  it('should cache words using shareReplay', () => {
    let result1: Word[] = [];
    let result2: Word[] = [];

    service.getWords().subscribe((words1) => {
      result1 = words1;
      expect(words1).toEqual(mockWords);

      // Second subscription should get same data
      service.getWords().subscribe((words2) => {
        result2 = words2;
        expect(words2).toEqual(mockWords);
        expect(words2).toEqual(words1); // Same data from both subscriptions
      });
    });

    const req = httpMock.expectOne('/words.json');
    req.flush(mockWords);
  });

  it('should return Observable<Word[]>', () => {
    const result = service.getWords();
    expect(result).toBeDefined();
    expect(result.subscribe).toBeDefined();
  });

  it('should handle empty word list', () => {
    const emptyWords: Word[] = [];

    service.getWords().subscribe((words: Word[]) => {
      expect(words).toEqual([]);
      expect(words.length).toBe(0);
    });

    const req = httpMock.expectOne('/words.json');
    req.flush(emptyWords);
  });

  it('should handle words with missing properties gracefully', () => {
    const incompleteWords = [
      {
        word: 'incomplete-word'
        // Missing type and definition
      }
    ];

    service.getWords().subscribe((words: any[]) => {
      expect(words).toEqual(incompleteWords);
    });

    const req = httpMock.expectOne('/words.json');
    req.flush(incompleteWords);
  });

  it('should handle HTTP error', () => {
    const errorMessage = 'Network error';

    service.getWords().subscribe({
      next: () => fail('should have failed with 500 error'),
      error: (error) => {
        expect(error.status).toBe(500);
        expect(error.statusText).toBe('Server Error');
      }
    });

    const req = httpMock.expectOne('/words.json');
    req.flush(errorMessage, { status: 500, statusText: 'Server Error' });
  });

  it('should handle network error', () => {
    const errorMessage = 'Network error';

    service.getWords().subscribe({
      next: () => fail('should have failed with network error'),
      error: (error) => {
        expect(error).toBeDefined();
      }
    });

    const req = httpMock.expectOne('/words.json');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
  });
});