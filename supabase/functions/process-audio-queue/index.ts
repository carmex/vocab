import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleAuth } from "npm:google-auth-library@9"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase Client (Service Role for Admin access)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log('[Queue] Starting audio processing...');

        // 1. Fetch pending items
        // Use LIMIT to process a batch (e.g., 5 items per run to keep duration short)
        // We will loop through them.
        const { data: queueItems, error: queueError } = await supabaseAdmin
            .from('audio_generation_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5);

        if (queueError) throw queueError;

        if (!queueItems || queueItems.length === 0) {
            console.log('[Queue] No pending items.');
            return new Response(JSON.stringify({ message: 'No pending items' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[Queue] Found ${queueItems.length} items to process.`);

        // Setup Google Cloud Auth once
        const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
        if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

        const auth = new GoogleAuth({
            credentials: JSON.parse(serviceAccountJson),
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        let processedCount = 0;

        // 2. Process Loop
        for (const item of queueItems) {
            try {
                console.log(`[Queue] Processing: ${item.word} (${item.language})`);

                // Mark as processing
                await supabaseAdmin
                    .from('audio_generation_queue')
                    .update({ status: 'processing', updated_at: new Date() })
                    .eq('id', item.id);

                // Generate a safe filename for storage (ASCII-only)
                // We use a hash of the word to ensure it's always a valid key, even for non-Latin characters.
                const trimmedWord = item.word.toLowerCase().trim();
                const encoder = new TextEncoder();
                const data = encoder.encode(trimmedWord);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const wordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                const filename = `audio/${item.language}-${wordHash}.wav`;

                // Check if already exists (skip generation if so)
                // We use HEAD check logic or just existing public URL check
                const { data: existingData } = await supabaseAdmin
                    .storage
                    .from('quiz-audio')
                    .getPublicUrl(filename);

                let alreadyExists = false;
                if (existingData?.publicUrl) {
                    try {
                        const check = await fetch(existingData.publicUrl, { method: 'HEAD' });
                        if (check.ok) alreadyExists = true;
                    } catch { }
                }

                if (alreadyExists) {
                    console.log(`[Queue] File exists, skipping generation for ${item.word}`);
                    await supabaseAdmin
                        .from('audio_generation_queue')
                        .update({ status: 'completed', updated_at: new Date() })
                        .eq('id', item.id);
                    continue;
                }

                // Call TTS
                const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize`;

                let pronunciationPrompt = "You are a professional news anchor. Pronounce the word clearly and crisply. Use a standard, neutral tone. Do not draw out the vowels; keep the word duration short and natural.";
                if (item.language === 'es') {
                    pronunciationPrompt = "Eres un presentador de noticias profesional. Pronuncia la palabra de forma clara y nítida. Utiliza un tono estándar y neutro en español latinoamericano. No alargues las vocales; mantén la duración de la palabra corta y natural.";
                }

                let languageCode = 'en-US';
                if (item.language === 'es') languageCode = 'es-US';

                // Throttle: 10 RPM = 1 request every 6 seconds.
                // We use 6500ms to be safe and account for network latency variance.
                if (processedCount > 0) {
                    await new Promise(r => setTimeout(r, 6500));
                }

                console.log(`[Queue] Generating "${item.word}" (${languageCode}). Prompt: "${pronunciationPrompt}"`);

                const ttsResponse = await fetch(ttsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'x-goog-user-project': JSON.parse(serviceAccountJson).project_id
                    },
                    body: JSON.stringify({
                        input: { text: item.word + ".", prompt: pronunciationPrompt },
                        voice: { languageCode: languageCode, model_name: 'gemini-2.5-flash-tts', name: 'Kore' },
                        audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 }
                    })
                });

                if (!ttsResponse.ok) {
                    const errText = await ttsResponse.text();

                    // Specific handling for Rate Limits
                    let isRateLimit = ttsResponse.status === 429;
                    if (!isRateLimit) {
                        try {
                            const errJson = JSON.parse(errText);
                            if (errJson?.error?.status === 'RESOURCE_EXHAUSTED' || errJson?.error?.code === 429) {
                                isRateLimit = true;
                            }
                        } catch (e) {
                            // ignore json parse error
                        }
                    }

                    if (isRateLimit) {
                        console.warn(`[Queue] Rate limit hit for ${item.word}. Aborting batch.`);
                        // Revert to pending so it's picked up next time (by cron or next trigger)
                        // Do NOT increment attempts since this isn't an issue with the word itself
                        await supabaseAdmin
                            .from('audio_generation_queue')
                            .update({ status: 'pending', updated_at: new Date() })
                            .eq('id', item.id);

                        // Stop processing this batch to let quota recover
                        break;
                    }

                    throw new Error(`TTS API Error: ${errText}`);
                }

                const ttsResult = await ttsResponse.json();
                const audioContent = ttsResult.audioContent;
                if (!audioContent) throw new Error('No audio content');

                const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));

                const { error: uploadError } = await supabaseAdmin
                    .storage
                    .from('quiz-audio')
                    .upload(filename, audioBuffer, { contentType: 'audio/wav', upsert: true });

                if (uploadError) throw uploadError;

                // Mark Complete
                await supabaseAdmin
                    .from('audio_generation_queue')
                    .update({ status: 'completed', updated_at: new Date() })
                    .eq('id', item.id);

                processedCount++;

            } catch (err) {
                console.error(`[Queue] Failed Item ${item.id}:`, err);
                const attempts = (item.attempts || 0) + 1;
                const status = attempts >= 3 ? 'failed' : 'pending'; // Retry up to 3 times

                await supabaseAdmin
                    .from('audio_generation_queue')
                    .update({
                        status: status,
                        attempts: attempts,
                        error_message: err.message,
                        updated_at: new Date()
                    })
                    .eq('id', item.id);
            }
        }

        return new Response(
            JSON.stringify({ processed: processedCount }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[Queue] Fatal Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
