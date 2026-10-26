import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ListService } from './list.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

describe('ListService', () => {
    let service: ListService;
    let mockSupabaseClient: any;
    let mockFrom: jest.Mock;
    let mockSelect: jest.Mock;
    let mockIn: jest.Mock;

    beforeEach(() => {
        mockIn = jest.fn();
        mockSelect = jest.fn().mockReturnValue({ in: mockIn });
        mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

        mockSupabaseClient = {
            from: mockFrom
        };

        TestBed.configureTestingModule({
            providers: [
                ListService,
                { provide: SupabaseService, useValue: { client: mockSupabaseClient } },
                { provide: AuthService, useValue: { currentUser: { id: 'user-1' } } }
            ]
        });

        service = TestBed.inject(ListService);
    });

    describe('getWordsForLists', () => {
        it('should fetch words for multiple lists in a single batched query using .in()', async () => {
            const mockWords = [
                { id: 'w1', list_id: 'list-1', word: 'cat' },
                { id: 'w2', list_id: 'list-2', word: 'dog' }
            ];
            mockIn.mockResolvedValue({ data: mockWords, error: null });

            const result = await firstValueFrom(service.getWordsForLists(['list-1', 'list-2']));

            expect(mockFrom).toHaveBeenCalledTimes(1);
            expect(mockFrom).toHaveBeenCalledWith('list_words');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockIn).toHaveBeenCalledWith('list_id', ['list-1', 'list-2']);
            expect(result).toEqual(mockWords);
        });

        it('should return an empty array without querying Supabase when listIds is empty', async () => {
            const result = await firstValueFrom(service.getWordsForLists([]));

            expect(mockFrom).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it('should throw an error when Supabase returns an error', async () => {
            const dbError = new Error('Database failure');
            mockIn.mockResolvedValue({ data: null, error: dbError });

            await expect(firstValueFrom(service.getWordsForLists(['list-1']))).rejects.toThrow('Database failure');
        });
    });
});
