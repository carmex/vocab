import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListsComponent } from './lists.component';
import { ListService } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { ClassroomService } from '../../services/classroom.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { SharedMaterialModule } from '../../shared-material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ListType } from '../../models/list-type.enum';
import { firstValueFrom } from 'rxjs';

describe('ListsComponent', () => {
    let component: ListsComponent;
    let fixture: ComponentFixture<ListsComponent>;
    let listServiceSpy: any;
    let authServiceSpy: any;
    let classroomServiceSpy: any;

    beforeEach(async () => {
        listServiceSpy = {
            getMyLists: jest.fn(),
            getListAudioStats: jest.fn().mockResolvedValue([]),
            generateShareCode: jest.fn(),
            subscribeToList: jest.fn()
        };
        authServiceSpy = {
            user$: of({ id: 'test-uid' }),
            isAnonymous: false
        };

        classroomServiceSpy = {
            getStudentQuests: jest.fn()
        };

        await TestBed.configureTestingModule({
            imports: [
                ListsComponent,
                RouterTestingModule,
                SharedMaterialModule,
                BrowserAnimationsModule
            ],
            providers: [
                { provide: ListService, useValue: listServiceSpy },
                { provide: AuthService, useValue: authServiceSpy },
                { provide: ClassroomService, useValue: classroomServiceSpy },
                { provide: MatDialog, useValue: {} },
                { provide: MatSnackBar, useValue: {} }
            ]
        }).compileComponents();

        listServiceSpy.getMyLists.mockReturnValue(of([]));
        classroomServiceSpy.getStudentQuests.mockReturnValue(of([]));

        fixture = TestBed.createComponent(ListsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should mark audio generation as not generating when all words are completed even if pending count is positive', async () => {
        const mockList: any = {
            id: 'share-1',
            word_list_id: 'list-1',
            word_lists: {
                id: 'list-1',
                name: 'Grade 1 Cycle 32',
                list_type: ListType.SIGHT_WORDS
            }
        };

        listServiceSpy.getMyLists.mockReturnValue(of([mockList]));
        listServiceSpy.getListAudioStats.mockResolvedValue([
            {
                list_id: 'list-1',
                total_words: 22,
                completed_words: 22,
                failed_words: 0,
                pending_words: 1, // Edge case: stale pending queue item
                queue_position: 1
            }
        ]);

        const fixtureNew = TestBed.createComponent(ListsComponent);
        const compNew = fixtureNew.componentInstance;
        const lists = await firstValueFrom(compNew.myLists$);

        expect(lists.length).toBe(1);
        expect(lists[0].audioStats?.progress).toBe(100);
        expect(lists[0].audioStats?.isGenerating).toBe(false);
    });

    it('should mark audio generation as generating when there are remaining uncompleted words', async () => {
        const mockList: any = {
            id: 'share-2',
            word_list_id: 'list-2',
            word_lists: {
                id: 'list-2',
                name: 'In Progress List',
                list_type: ListType.SIGHT_WORDS
            }
        };

        listServiceSpy.getMyLists.mockReturnValue(of([mockList]));
        listServiceSpy.getListAudioStats.mockResolvedValue([
            {
                list_id: 'list-2',
                total_words: 20,
                completed_words: 10,
                failed_words: 0,
                pending_words: 10,
                queue_position: 5
            }
        ]);

        const fixtureNew = TestBed.createComponent(ListsComponent);
        const compNew = fixtureNew.componentInstance;
        const lists = await firstValueFrom(compNew.myLists$);

        expect(lists.length).toBe(1);
        expect(lists[0].audioStats?.progress).toBe(50);
        expect(lists[0].audioStats?.isGenerating).toBe(true);
    });

    it('should return lists even if getListAudioStats fails', async () => {
        const mockList: any = {
            id: 'share-3',
            word_list_id: 'list-3',
            word_lists: {
                id: 'list-3',
                name: 'Resilient List',
                list_type: ListType.SIGHT_WORDS
            }
        };

        listServiceSpy.getMyLists.mockReturnValue(of([mockList]));
        listServiceSpy.getListAudioStats.mockRejectedValue(new Error('RPC failed'));

        const fixtureNew = TestBed.createComponent(ListsComponent);
        const compNew = fixtureNew.componentInstance;
        const lists = await firstValueFrom(compNew.myLists$);

        expect(lists.length).toBe(1);
        expect(lists[0].word_lists?.name).toBe('Resilient List');
    });
});
