const speech = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

class STTService {
    constructor() {
        // Initialize Google Cloud Speech client
        this.speechClient = new speech.SpeechClient({
            // Uses GOOGLE_APPLICATION_CREDENTIALS environment variable
            // Or you can specify keyFilename: 'path/to/service-account-key.json'
        });
        
        // Optimized config for phone calls
        this.speechConfig = {
            encoding: 'MULAW', // Twilio uses μ-law encoding
            sampleRateHertz: 8000, // Phone quality
            languageCode: 'en-US',
            model: 'phone_call', // Optimized for phone audio
            useEnhanced: true, // Better accuracy
            enableAutomaticPunctuation: true,
            enableWordTimeOffsets: false, // Not needed for real-time
            maxAlternatives: 1, // Just best result
            profanityFilter: false, // Keep it natural
            speechContexts: [{
                phrases: [
                    // Business context phrases for better recognition
                    'HighIQ', 'AI agent', 'automation', 'customer service',
                    'demo', 'pricing', 'timeline', 'team size',
                    'voice agent', 'chatbot', 'support tickets',
                    'appointment booking', 'lead generation'
                ],
                boost: 10 // Boost recognition of these phrases
            }]
        };
        
        // Track active transcription sessions
        this.activeSessions = new Map();
        
        console.log('🎤 STT Service initialized');
    }

    /**
     * Convert Twilio audio stream to text
     * @param {string} callSid - Twilio call SID
     * @param {Buffer} audioBuffer - Audio data from Twilio
     * @param {boolean} isComplete - Whether this is the final chunk
     * @returns {Promise<string>} - Transcribed text
     */
    async transcribeAudio(callSid, audioBuffer, isComplete = false) {
        try {
            console.log(`🎤 Transcribing audio for call: ${callSid}, size: ${audioBuffer.length} bytes`);
            
            // For real-time streaming, use streaming recognition
            if (!isComplete) {
                return await this.streamingTranscribe(callSid, audioBuffer);
            }
            
            // For complete audio chunks, use synchronous recognition
            const request = {
                audio: {
                    content: audioBuffer.toString('base64')
                },
                config: this.speechConfig
            };

            const [response] = await this.speechClient.recognize(request);
            
            if (response.results && response.results.length > 0) {
                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join(' ')
                    .trim();
                
                console.log(`✅ Transcribed: "${transcription}"`);
                return this.cleanTranscription(transcription);
            }
            
            console.log('⚠️ No transcription results');
            return '';
            
        } catch (error) {
            console.error('❌ STT Error:', error);
            
            // Return fallback for common errors
            if (error.code === 'INVALID_ARGUMENT') {
                console.error('Invalid audio format - check Twilio webhook config');
                return '[audio_format_error]';
            } else if (error.code === 'UNAUTHENTICATED') {
                console.error('Google Cloud credentials issue');
                return '[auth_error]';
            }
            
            return '[transcription_error]';
        }
    }

    /**
     * Streaming transcription for real-time processing
     * @param {string} callSid - Call identifier
     * @param {Buffer} audioChunk - Audio chunk
     * @returns {Promise<string>} - Partial or complete transcription
     */
    async streamingTranscribe(callSid, audioChunk) {
        try {
            // Get or create streaming session
            let session = this.activeSessions.get(callSid);
            
            if (!session) {
                // Create new streaming session
                const recognizeStream = this.speechClient
                    .streamingRecognize({
                        config: this.speechConfig,
                        interimResults: false, // Only final results for voice calls
                        enableVoiceActivityEvents: true
                    });

                session = {
                    stream: recognizeStream,
                    lastResult: '',
                    timeout: setTimeout(() => {
                        this.closeSession(callSid);
                    }, 30000) // 30 second timeout
                };

                // Handle streaming results
                recognizeStream.on('data', (data) => {
                    if (data.results && data.results.length > 0) {
                        const result = data.results[0];
                        if (result.isFinal) {
                            session.lastResult = result.alternatives[0].transcript;
                            console.log(`🎤 Streaming result: "${session.lastResult}"`);
                        }
                    }
                });

                recognizeStream.on('error', (error) => {
                    console.error('❌ Streaming STT error:', error);
                    this.closeSession(callSid);
                });

                this.activeSessions.set(callSid, session);
                console.log(`🎤 Started streaming session for: ${callSid}`);
            }

            // Send audio chunk to stream
            session.stream.write({ audioContent: audioChunk });
            
            // Reset timeout
            clearTimeout(session.timeout);
            session.timeout = setTimeout(() => {
                this.closeSession(callSid);
            }, 30000);

            return session.lastResult;
            
        } catch (error) {
            console.error('❌ Streaming transcription error:', error);
            this.closeSession(callSid);
            return '[streaming_error]';
        }
    }

    /**
     * Process Twilio MediaStream for real-time transcription
     * @param {WebSocket} ws - WebSocket connection from Twilio
     * @param {string} callSid - Call identifier
     * @param {Function} onTranscription - Callback for transcription results
     */
    handleTwilioMediaStream(ws, callSid, onTranscription) {
        console.log(`🎤 Setting up MediaStream handler for: ${callSid}`);
        
        let audioBuffer = Buffer.alloc(0);
        let silenceCounter = 0;
        const SILENCE_THRESHOLD = 10; // Detect speech breaks
        
        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message);
                
                switch (msg.event) {
                    case 'connected':
                        console.log(`🔗 MediaStream connected: ${callSid}`);
                        break;
                        
                    case 'start':
                        console.log(`🎤 MediaStream started: ${callSid}`);
                        break;
                        
                    case 'media':
                        // Twilio sends base64 encoded μ-law audio
                        const audioChunk = Buffer.from(msg.media.payload, 'base64');
                        audioBuffer = Buffer.concat([audioBuffer, audioChunk]);
                        
                        // Process in chunks for better real-time performance
                        if (audioBuffer.length >= 1600) { // ~200ms of audio at 8kHz
                            this.processAudioChunk(callSid, audioBuffer, onTranscription);
                            audioBuffer = Buffer.alloc(0);
                            silenceCounter = 0;
                        } else {
                            silenceCounter++;
                        }
                        break;
                        
                    case 'stop':
                        console.log(`⏹️ MediaStream stopped: ${callSid}`);
                        this.closeSession(callSid);
                        break;
                }
                
            } catch (error) {
                console.error('❌ MediaStream message error:', error);
            }
        });

        ws.on('close', () => {
            console.log(`🔌 MediaStream closed: ${callSid}`);
            this.closeSession(callSid);
        });
    }

    /**
     * Process audio chunk and trigger transcription
     * @param {string} callSid - Call ID  
     * @param {Buffer} audioBuffer - Audio data
     * @param {Function} callback - Transcription callback
     */
    async processAudioChunk(callSid, audioBuffer, callback) {
        try {
            const transcription = await this.streamingTranscribe(callSid, audioBuffer);
            
            if (transcription && transcription.length > 0) {
                const cleanText = this.cleanTranscription(transcription);
                if (cleanText.length > 2) { // Ignore very short results
                    callback(cleanText);
                }
            }
            
        } catch (error) {
            console.error('❌ Audio chunk processing error:', error);
        }
    }

    /**
     * Clean up transcription text
     * @param {string} text - Raw transcription
     * @returns {string} - Cleaned text
     */
    cleanTranscription(text) {
        if (!text) return '';
        
        return text
            .trim()
            .toLowerCase()
            // Fix common phone transcription errors
            .replace(/\bhigh iq\b/gi, 'HighIQ')
            .replace(/\bhi q\b/gi, 'HighIQ') 
            .replace(/\bhiq\b/gi, 'HighIQ')
            .replace(/\ba i\b/gi, 'AI')
            .replace(/\bdemmo\b/gi, 'demo')
            .replace(/\bprising\b/gi, 'pricing')
            // Remove filler words common in phone calls
            .replace(/\b(um|uh|ah|er|hmm)\b/g, '')
            // Clean up extra spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Close streaming session
     * @param {string} callSid - Call identifier
     */
    closeSession(callSid) {
        const session = this.activeSessions.get(callSid);
        if (session) {
            if (session.stream) {
                session.stream.end();
            }
            if (session.timeout) {
                clearTimeout(session.timeout);
            }
            this.activeSessions.delete(callSid);
            console.log(`🗑️ Closed STT session: ${callSid}`);
        }
    }

    /**
     * Convert audio file to text (for testing)
     * @param {string} audioFilePath - Path to audio file
     * @returns {Promise<string>} - Transcribed text
     */
    async transcribeFile(audioFilePath) {
        try {
            const audioBytes = fs.readFileSync(audioFilePath).toString('base64');
            
            const request = {
                audio: { content: audioBytes },
                config: this.speechConfig
            };

            const [response] = await this.speechClient.recognize(request);
            
            if (response.results && response.results.length > 0) {
                return response.results
                    .map(result => result.alternatives[0].transcript)
                    .join(' ');
            }
            
            return '';
            
        } catch (error) {
            console.error('❌ File transcription error:', error);
            throw error;
        }
    }

    /**
     * Health check for STT service
     * @returns {Promise<Object>} - Health status
     */
    async healthCheck() {
        try {
            // Test with a minimal request
            const testAudio = Buffer.from('test').toString('base64');
            await this.speechClient.recognize({
                audio: { content: testAudio },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US'
                }
            });
            
            return {
                status: 'healthy',
                activeSessions: this.activeSessions.size,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get service statistics
     * @returns {Object} - Service stats
     */
    getStats() {
        return {
            activeSessions: this.activeSessions.size,
            sessionIds: Array.from(this.activeSessions.keys()),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new STTService();