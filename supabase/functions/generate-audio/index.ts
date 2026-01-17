import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Buffer } from "https://deno.land/std@0.168.0/io/buffer.ts"
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
        const { word, language = 'en' } = await req.json()
        if (!word) {
            throw new Error('Word is required')
        }

        // Initialize Supabase Client (Service Role for Admin access to Storage)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Check Cache
        // Include language in filename to prevent collisions and support multi-lingual lists
        const filename = `audio/${language}-${word.toLowerCase().trim()}.wav`
        const { data: existingData } = await supabaseAdmin
            .storage
            .from('quiz-audio')
            .getPublicUrl(filename)

        // Robust Cache Check:
        // Even if 'list' finds it, the file might be missing on disk (integrity issue) or soft-deleted.
        // We verified a HEAD request to the public URL is the best way to ensure it's actually serveable.
        let cacheHit = false;
        if (existingData?.publicUrl) {
            try {
                const check = await fetch(existingData.publicUrl, { method: 'HEAD' });
                if (check.ok) {
                    cacheHit = true;
                } else {
                    console.log(`Cache check failed for ${filename}: ${check.status} ${check.statusText}`);
                }
            } catch (e) {
                console.log(`Cache check error for ${filename}:`, e);
            }
        }

        if (cacheHit) {
            console.log(`Cache hit for ${word} (${language})`)
            return new Response(
                JSON.stringify({ url: existingData.publicUrl }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Cache miss for ${word} (${language}), generating...`)

        // 2. Map language to BCP-47
        let languageCode = 'en-US'
        if (language === 'es') {
            languageCode = 'es-US' // Spanish (US)
        }

        // 3. Authenticate with Service Account
        const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
        if (!serviceAccountJson) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
        }

        const auth = new GoogleAuth({
            credentials: JSON.parse(serviceAccountJson),
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        if (!token) {
            throw new Error('Failed to generate Access Token')
        }

        // 4. Call Cloud Text-to-Speech API (Gemini Model)
        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize`

        // Gemini TTS uses "Personas" (e.g. Kore, Puck) which are cross-lingual.
        // We use 'Kore' (Firm/News Anchor style) for clarity.
        // However, we MUST localize the instructions (prompt) for best results.
        let pronunciationPrompt = "You are a professional news anchor. Pronounce the word clearly and crisply. Use a standard, neutral tone. Do not draw out the vowels; keep the word duration short and natural.";

        if (languageCode.startsWith('es')) {
            pronunciationPrompt = "Eres un presentador de noticias profesional. Pronuncia la palabra de forma clara y nítida. Utiliza un tono estándar y neutro en español. No alargues las vocales; mantén la duración de la palabra corta y natural.";
        }

        console.log(`[TTS] Generating "${word}" (${languageCode}). Prompt: "${pronunciationPrompt}"`);

        const ttsResponse = await fetch(ttsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-goog-user-project': JSON.parse(serviceAccountJson).project_id
            },
            body: JSON.stringify({
                input: {
                    text: word + ".",
                    prompt: pronunciationPrompt
                },
                voice: {
                    languageCode: languageCode,
                    model_name: 'gemini-2.5-flash-tts',
                    name: 'Kore'
                },
                audioConfig: {
                    audioEncoding: 'LINEAR16', // WAV
                    sampleRateHertz: 24000
                }
            })
        })

        if (!ttsResponse.ok) {
            const errText = await ttsResponse.text()
            // Check for Rate Limit to give a better error message
            try {
                const errJson = JSON.parse(errText);
                if (ttsResponse.status === 429 || errJson?.error?.status === 'RESOURCE_EXHAUSTED' || errJson?.error?.code === 429) {
                    throw new Error('TTS Rate Limit Exceeded. Please try again later.');
                }
            } catch (e) {
                // ignore
            }
            throw new Error(`Cloud TTS API error: ${errText}`)
        }

        const ttsResult = await ttsResponse.json()
        const audioContent = ttsResult.audioContent // Base64

        if (!audioContent) {
            throw new Error('No audio content returned from TTS API')
        }

        // 5. Decode Base64 Audio
        const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))

        // 6. Upload to Storage
        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('quiz-audio')
            .upload(filename, audioBuffer, {
                contentType: 'audio/wav',
                upsert: true
            })

        if (uploadError) {
            throw new Error(`Storage upload error: ${uploadError.message}`)
        }

        // 7. Return URL
        const { data: publicUrlData } = supabaseAdmin
            .storage
            .from('quiz-audio')
            .getPublicUrl(filename)

        return new Response(
            JSON.stringify({ url: publicUrlData.publicUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
