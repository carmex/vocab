import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
import { GoogleGenerativeAI, SchemaType } from "https://esm.sh/@google/generative-ai@0.21.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL_NAME = "gemini-2.5-flash"

Deno.serve(async (req) => {
    // 1. Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Get API key from environment
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set')
        }

        // 3. Parse the uploaded file safely
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            return new Response(
                JSON.stringify({ error: 'No file uploaded' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // Get mode (default: vocab for word/definition pairs)
        const mode = formData.get('mode')?.toString() || 'vocab'
        console.log(`Processing file: ${file.name} (${file.size} bytes) in mode: ${mode}`)

        // 4. Convert image to Base64
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const base64 = encode(uint8Array)

        // 5. Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey)

        let model
        let prompt

        if (mode === 'sightwords') {
            // Sight words mode: no schema, plain text output
            model = genAI.getGenerativeModel({
                model: MODEL_NAME,
                generationConfig: {
                    temperature: 0.1
                }
            })
            prompt =
                "Analyze the provided image and extract all sight words or vocabulary words. " +
                "The words may be in English, Spanish, or Japanese Hiragana characters. " +
                "Return ONLY a comma-separated list of the words, nothing else. " +
                "Do not include definitions, numbers, or any other text. " +
                "Example output: the, and, い, あ, was, are"
        } else {
            // Vocab mode: JSON schema for word/definition pairs
            const vocabSchema = {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        word: { type: SchemaType.STRING },
                        definition: { type: SchemaType.STRING }
                    },
                    required: ["word", "definition"]
                }
            }
            model = genAI.getGenerativeModel({
                model: MODEL_NAME,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: vocabSchema,
                    temperature: 0.1
                }
            })
            prompt =
                "Analyze the provided image and extract all vocabulary word and definition pairs. " +
                "Text must be transcribed exactly as it appears. " +
                "Ignore handwriting that is not clearly a word/definition pair."
        }

        // 6. Send request to Gemini with inline image data
        console.log(`Sending request to Gemini (${MODEL_NAME})`)

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: file.type,
                    data: base64
                }
            },
            prompt
        ])

        const response = result.response
        const content = response.text()

        if (!content) {
            throw new Error('No content received from Gemini')
        }

        // 7. Handle response based on mode
        if (mode === 'sightwords') {
            // Return plain text comma-separated list
            console.log(`Extracted sight words: ${content}`)
            return new Response(
                JSON.stringify({ words: content.trim() }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        } else {
            // Parse JSON response for vocab mode
            let vocabItems
            try {
                vocabItems = JSON.parse(content)
            } catch (e) {
                console.error('Failed to parse JSON:', content)
                return new Response(
                    JSON.stringify({ error: 'Failed to parse Gemini response', raw: content }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                )
            }

            console.log(`Extracted ${vocabItems.length} vocabulary items`)
            return new Response(
                JSON.stringify(vocabItems),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
