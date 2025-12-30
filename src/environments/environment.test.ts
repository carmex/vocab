// Test environment for E2E testing with local Supabase
export const environment = {
    production: false,
    supabase: {
        // Local Supabase instance (started with npx supabase start)
        url: 'http://127.0.0.1:54321',
        // Default local development anon key
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    }
};
