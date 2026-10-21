import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { SettingsService } from './services/settings.service';
import { AuthService } from './services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { SupabaseService } from './services/supabase.service';
import { SpeechService } from './services/speech.service';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { of, Subject } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AppComponent', () => {
    let component: AppComponent;
    let fixture: ComponentFixture<AppComponent>;
    let swUpdateSpy: any;
    let versionUpdatesSubject: Subject<any>;

    beforeEach(async () => {
        versionUpdatesSubject = new Subject();
        swUpdateSpy = {
            isEnabled: true,
            versionUpdates: versionUpdatesSubject.asObservable(),
            activateUpdate: jest.fn().mockResolvedValue(true),
            checkForUpdate: jest.fn().mockResolvedValue(true)
        };

        const authServiceSpy = {
            profile$: of({ role: 'student' }),
            currentUser: { id: 'test', email: 'test@test.com', is_anonymous: false }
        };

        const supabaseSpy = {
            client: {
                from: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                            })
                        })
                    })
                })
            }
        };

        await TestBed.configureTestingModule({
            declarations: [AppComponent],
            providers: [
                { provide: SettingsService, useValue: { loadSettings: jest.fn() } },
                { provide: AuthService, useValue: authServiceSpy },
                { provide: MatDialog, useValue: { open: jest.fn(), openDialogs: [] } },
                { provide: SupabaseService, useValue: supabaseSpy },
                { provide: SpeechService, useValue: {} },
                { provide: SwUpdate, useValue: swUpdateSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(AppComponent);
        component = fixture.componentInstance;
    });

    it('should create the app', () => {
        expect(component).toBeTruthy();
    });

    it('should activate update and reload when a new version is ready', async () => {
        const reloadSpy = jest.fn();
        Object.defineProperty(window, 'location', {
            value: { ...window.location, reload: reloadSpy },
            writable: true
        });

        component.ngOnInit();
        versionUpdatesSubject.next({ type: 'VERSION_READY' } as VersionReadyEvent);

        expect(swUpdateSpy.activateUpdate).toHaveBeenCalled();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(reloadSpy).toHaveBeenCalled();
    });

    it('should check for updates on initialization when swUpdate is enabled', () => {
        swUpdateSpy.checkForUpdate = jest.fn().mockResolvedValue(true);
        component.ngOnInit();
        expect(swUpdateSpy.checkForUpdate).toHaveBeenCalled();
    });
});
