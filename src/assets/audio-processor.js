class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const inputChannel = input[0];

            // Accumulate samples until we reach bufferSize
            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                if (this.bufferIndex >= this.bufferSize) {
                    // Send buffer to main thread (AudioWorklet sends copies by default)
                    this.port.postMessage(this.buffer);

                    // Reset buffer
                    // Note: We can reuse the same Float32Array if we weren't posting it,
                    // but postMessage behavior with TypedArrays depends on transferables.
                    // To be safe and simple, we create a new view or overwrite.
                    // Since we want to avoid allocation if possible, we could double buffer,
                    // but for now, re-using and overwriting is risky if main thread reads it async 
                    // (though postMessage copy-on-send logic protects us usually).
                    // Actually, postMessage clone algorithm handles it.
                    // Yet, to be 100% safe against zeroing out before send is complete (if any optimization exists):
                    this.buffer = new Float32Array(this.bufferSize);
                    this.bufferIndex = 0;
                }
            }
        }
        // Keep processor alive
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
