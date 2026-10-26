import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { GenerateSentencesModalComponent } from './generate-sentences-modal.component';
import { ListService, ListShare } from '../../../services/list.service';
import { SupabaseService } from '../../../services/supabase.service';
import { ListType } from '../../../models/list-type.enum';

describe('GenerateSentencesModalComponent', () => {
    let component: GenerateSentencesModalComponent;
    let fixture: ComponentFixture<GenerateSentencesModalComponent>;
    let mockListService: {
        getMyLists: jest.Mock;
        getWords: jest.Mock;
        getWordsForLists: jest.Mock;
    };
    let mockSupabaseService: {
        client: {
            functions: {
                invoke: jest.Mock;
            };
        };
    };
    let mockDialogRef: {
        close: jest.Mock;
    };

    const mockSightWordLists: ListShare[] = [
        {
            id: 'share-1',
            word_list_id: 'list-1',
            user_id: 'user-1',
            last_accessed: '2026-10-26T00:00:00Z',
            word_lists: {
                id: 'list-1',
                name: 'Sight Words 1',
                description: '',
                creator_id: 'user-1',
                is_public: false,
                list_type: ListType.SIGHT_WORDS,
                language: 'en',
                created_at: '2026-10-26T00:00:00Z',
                list_words: [{ count: 2 }]
            }
        },
        {
            id: 'share-2',
            word_list_id: 'list-2',
            user_id: 'user-1',
            last_accessed: '2026-10-26T00:00:00Z',
            word_lists: {
                id: 'list-2',
                name: 'Sight Words 2',
                description: '',
                creator_id: 'user-1',
                is_public: false,
                list_type: ListType.SIGHT_WORDS,
                language: 'en',
                created_at: '2026-10-26T00:00:00Z',
                list_words: [{ count: 2 }]
            }
        },
        {
            id: 'share-3',
            word_list_id: 'list-3',
            user_id: 'user-1',
            last_accessed: '2026-10-26T00:00:00Z',
            word_lists: {
                id: 'list-3',
                name: 'Sight Words 3',
                description: '',
                creator_id: 'user-1',
                is_public: false,
                list_type: ListType.SIGHT_WORDS,
                language: 'en',
                created_at: '2026-10-26T00:00:00Z',
                list_words: [{ count: 2 }]
            }
        },
        {
            id: 'share-4',
            word_list_id: 'list-4',
            user_id: 'user-1',
            last_accessed: '2026-10-26T00:00:00Z',
            word_lists: {
                id: 'list-4',
                name: 'Sight Words 4',
                description: '',
                creator_id: 'user-1',
                is_public: false,
                list_type: ListType.SIGHT_WORDS,
                language: 'en',
                created_at: '2026-10-26T00:00:00Z',
                list_words: [{ count: 2 }]
            }
        }
    ];

    beforeEach(async () => {
        mockListService = {
            getMyLists: jest.fn().mockReturnValue(of(mockSightWordLists)),
            getWords: jest.fn(),
            getWordsForLists: jest.fn()
        };

        mockSupabaseService = {
            client: {
                functions: {
                    invoke: jest.fn()
                }
            }
        };

        mockDialogRef = {
            close: jest.fn()
        };

        await TestBed.configureTestingModule({
            imports: [
                GenerateSentencesModalComponent,
                NoopAnimationsModule
            ],
            providers: [
                { provide: MatDialogRef, useValue: mockDialogRef },
                { provide: ListService, useValue: mockListService },
                { provide: SupabaseService, useValue: mockSupabaseService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(GenerateSentencesModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create and filter for SIGHT_WORDS lists', () => {
        expect(component).toBeTruthy();
        expect(component.sourceLists.length).toBe(4);
    });

    it('should fetch words for all selected lists in a single batched call instead of per-list requests', async () => {
        component.selectedLists = mockSightWordLists;
        component.count = 12;

        mockListService.getWordsForLists.mockReturnValue(of([
            { word: 'cat' },
            { word: ' dog ' },
            { word: 'cat' },
            { word: 'bird' },
            { word: '   ' }
        ]));

        const generatedSentences = [
            { word: 'the cat and dog', definition: '' }
        ];
        mockSupabaseService.client.functions.invoke.mockResolvedValue({
            data: generatedSentences,
            error: null
        });

        await component.generate();

        expect(mockListService.getWordsForLists).toHaveBeenCalledTimes(1);
        expect(mockListService.getWordsForLists).toHaveBeenCalledWith(['list-1', 'list-2', 'list-3', 'list-4']);
        expect(mockListService.getWords).not.toHaveBeenCalled();

        expect(mockSupabaseService.client.functions.invoke).toHaveBeenCalledWith('generate-sentences', {
            body: {
                words: ['cat', 'dog', 'bird'],
                count: 12
            }
        });
        expect(mockDialogRef.close).toHaveBeenCalledWith(generatedSentences);
    });
});
