import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

// Capture OAuth callback params BEFORE Angular router can strip them
// This runs synchronously before Angular bootstraps
const hash = window.location.hash;
const search = window.location.search;

// Check for OAuth tokens (implicit flow) or code (PKCE flow)
if (hash.includes('access_token') || search.includes('code=')) {
  sessionStorage.setItem('supabase_oauth_hash', hash);
  sessionStorage.setItem('supabase_oauth_search', search);
}

platformBrowser().bootstrapModule(AppModule, {
  ngZoneEventCoalescing: true,
})
  .catch(err => console.error(err));
