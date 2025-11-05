import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { Word } from '../models/word.interface';

@Injectable({
  providedIn: 'root'
})
export class VocabularyService {
  constructor(private http: HttpClient) {}

  getWords(): Observable<Word[]> {
    return this.http.get<Word[]>('/words.json')
      .pipe(shareReplay(1));
  }
}