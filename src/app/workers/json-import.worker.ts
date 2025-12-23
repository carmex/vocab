/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
    try {
        const jsonString = data;
        const json = JSON.parse(jsonString);

        if (Array.isArray(json)) {
            const total = json.length;
            const processedWords = [];
            const batchSize = 100;

            for (let i = 0; i < total; i++) {
                const item = json[i];
                processedWords.push({
                    word: item.word || '',
                    definition: item.definition || ''
                });

                // Report progress every batch or at the end
                if ((i + 1) % batchSize === 0 || i === total - 1) {
                    const progress = Math.round(((i + 1) / total) * 100);
                    postMessage({ type: 'progress', value: progress });
                }
            }

            postMessage({ type: 'result', words: processedWords });
        } else {
            postMessage({ type: 'error', message: 'Invalid JSON format. Expected an array of words.' });
        }
    } catch (err) {
        postMessage({ type: 'error', message: 'Error parsing JSON file.' });
    }
});
