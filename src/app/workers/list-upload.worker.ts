/// <reference lib="webworker" />

addEventListener('message', async ({ data }) => {
    const { supabaseUrl, supabaseKey, authToken, listId, words } = data;

    if (!supabaseUrl || !supabaseKey || !listId || !words || !Array.isArray(words)) {
        postMessage({ type: 'error', message: 'Missing required data for upload.' });
        return;
    }

    const BATCH_SIZE = 100; // Adjust based on Supabase limits (usually safe)
    const total = words.length;
    let processed = 0;

    try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = words.slice(i, i + BATCH_SIZE).map(w => ({
                list_id: listId,
                word: w.word,
                definition: w.definition
            }));

            const response = await fetch(`${supabaseUrl}/rest/v1/list_words`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal' // We don't need the inserted rows back
                },
                body: JSON.stringify(batch)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            processed += batch.length;
            const progress = Math.round((processed / total) * 100);
            postMessage({ type: 'progress', value: progress });
        }

        postMessage({ type: 'result', success: true });
    } catch (err: any) {
        postMessage({ type: 'error', message: err.message || 'Unknown upload error' });
    }
});
