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

        // 3. Parse result
        const { words, count } = await req.json()

        if (!words || !Array.isArray(words) || words.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No words provided' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const sentenceCount = count || 10;

        console.log(`Generating ${sentenceCount} sentences for ${words.length} words`)

        // 4. Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey)

        // Schema: Array of objects with word (the sentence) and empty definition
        const responseSchema = {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    word: { type: SchemaType.STRING, description: "The generated sentence" },
                    definition: { type: SchemaType.STRING, description: "Empty string or context if needed" }
                },
                required: ["word", "definition"]
            }
        }

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2
            }
        })

        console.log('Input words:', words);

        const prompt = `
        Task: Create ${sentenceCount} simple sentences using ONLY words from the provided list.
        
        Rules:
        1. STRICT VOCABULARY: You must ONLY use the words provided in the "Allowed Words" list below. Do NOT introduce new nouns, verbs, or adjectives not in the list.
        2. MINIMAL CONNECTORS: If absolutely necessary for grammar, you may use very basic connector words (a, the, is, on, in, at, to, for, and), but prefer using only the provided words if possible.
        3. SHORT & SIMPLE: Sentences should be short (3-6 words).
        4. VARIETY: Use different combinations of the words.
        5. FORMAT: Return valid JSON array of objects.

        Allowed Words: ${words.join(', ')}
        
        Return the result as a JSON array of objects where 'word' is the full sentence and 'definition' is an empty string.`;

        // 5. Send request
        const result = await model.generateContent(prompt)
        const response = result.response
        const content = response.text()

        if (!content) {
            throw new Error('No content received from Gemini')
        }

        const generatedItems = JSON.parse(content)
        console.log(`Generated ${generatedItems.length} sentences`)

        return new Response(
            JSON.stringify(generatedItems),
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
