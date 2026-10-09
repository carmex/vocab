/**
 * Utility functions for audio generation and TTS input formatting.
 */

/**
 * Formats a word or sentence for the TTS model by quoting it.
 * Wrapping the text in double quotes prevents LLM-based TTS models
 * (such as gemini-2.5-flash-tts) from mistaking isolated vocabulary words
 * (e.g. "audio") for structural keywords, modality headers, or broadcasting cues.
 *
 * @param text The input word or sentence to format.
 * @returns The formatted string, e.g. '"audio".'
 */
export function formatTtsInputText(text: string): string {
    const trimmed = text.trim().replace(/^["']|["']$/g, '').replace(/\.+$/, '');
    return `"${trimmed}".`;
}
