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

        console.log(`Processing file: ${file.name} (${file.size} bytes)`)

        // 4. Convert image to Base64
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const base64 = encode(uint8Array)

        // 5. Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey)

        // Define the schema using SchemaType enum for Deno compatibility
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

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: vocabSchema,
                temperature: 0.1
            }
        })

        // 6. Create the prompt
        const prompt =
            "Analyze the provided image and extract all vocabulary word and definition pairs. " +
            "Text must be transcribed exactly as it appears. " +
            "Ignore handwriting that is not clearly a word/definition pair."

        // 7. Send request to Gemini with inline image data
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

        // 8. Parse JSON response (Gemini with responseSchema returns clean JSON)
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

        // 9. Return Success
        console.log(`Extracted ${vocabItems.length} vocabulary items`)
        return new Response(
            JSON.stringify(vocabItems),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
