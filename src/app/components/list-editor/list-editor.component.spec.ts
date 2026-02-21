import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ListEditorComponent } from './list-editor.component';
import { ListService } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ListType } from '../../models/list-type.enum';
import { SpeechService } from '../../services/speech.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('ListEditorComponent', () => {
    let component: ListEditorComponent;
    let fixture: ComponentFixture<ListEditorComponent>;
    let mockListService: any;
    let mockAuthService: any;
    let mockSupabaseService: any;
    let mockDialog: any;
    let mockRouter: any;
    let mockRoute: any;
    let mockSpeechService: any;

    beforeEach(async () => {
        mockListService = {
            getListDetails: jest.fn().mockReturnValue(of({})),
            getWords: jest.fn().mockReturnValue(of([])),
            createList: jest.fn(),
            addWords: jest.fn(),
            updateList: jest.fn(),
            syncWords: jest.fn()
        };
        mockAuthService = {
            isAnonymous: false,
            user$: of(null),
            signOut: jest.fn()
        };
        mockSupabaseService = {
            client: {
                auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
                functions: { invoke: jest.fn() }
            }
        };
        mockDialog = { open: jest.fn() };
        mockRouter = { navigate: jest.fn() };
        mockRoute = {
            queryParamMap: of({ get: () => null }),
            paramMap: of({ get: () => null })
        };
        mockSpeechService = {
            playPremium: jest.fn().mockResolvedValue(undefined),
            forceRegenerateAudio: jest.fn().mockResolvedValue('blob:new-audio')
        };

        await TestBed.configureTestingModule({
            imports: [ListEditorComponent, BrowserAnimationsModule, RouterTestingModule], // Standalone component
            providers: [
                { provide: ListService, useValue: mockListService },
                { provide: AuthService, useValue: mockAuthService },
                { provide: SupabaseService, useValue: mockSupabaseService },
                { provide: MatDialog, useValue: mockDialog },
                { provide: Router, useValue: mockRouter },
                { provide: ActivatedRoute, useValue: mockRoute },
                { provide: SpeechService, useValue: mockSpeechService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ListEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Audio Controls (Sight Words)', () => {
        beforeEach(() => {
            component.listType = ListType.SIGHT_WORDS;
            component.words = [
                { word: 'cat', definition: '' },
                { word: 'dog', definition: '' }
            ];
            fixture.detectChanges();
        });

        it('should have playAudio and regenerateAudio methods', () => {
            expect((component as any).playAudio).toBeDefined();
            expect((component as any).regenerateAudio).toBeDefined();
        });

        it('should call speechService.playPremium when playAudio is called', async () => {
            // We'll assume the method signature is playAudio(index)
            // Since it's not implemented yet, this cast avoids compilation error but will fail runtime if missing
            await (component as any).playAudio(0);
            expect(mockSpeechService.playPremium).toHaveBeenCalledWith('cat', component.language);
        });

        it('should call speechService.forceRegenerateAudio when regenerateAudio is called', async () => {
            await (component as any).regenerateAudio(0);
            expect(mockSpeechService.forceRegenerateAudio).toHaveBeenCalledWith('cat', component.language);
        });

        // UI Tests - verify buttons exist in template
        // This is hard to test before implementing, but we can try checking logic properties first
    });
});
