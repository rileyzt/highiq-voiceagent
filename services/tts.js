const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TTSService {
    constructor() {
        // Initialize Google Cloud Text-to-Speech client
        this.ttsClient = new textToSpeech.TextToSpeechClient({
            // Uses GOOGLE_APPLICATION_CREDENTIALS environment variable
        });
        
        // Voice configuration optimized for phone calls
        this.voiceConfig = {
            languageCode: 'en-US',
            name: 'en-US-Neural2-F', // Natural female voice
            ssmlGender: 'FEMALE'
        };
        
        // Audio configuration for Twilio compatibility
        this.audioConfig = {
            audioEncoding: 'MULAW', // μ-law for phone compatibility
            sampleRateHertz: 8000,  // Phone quality
            effectsProfileId: ['telephony-class-application'], // Optimized for phone
            pitch: 0.0,     // Natural pitch
            speakingRate: 0.9 // Slightly slower for clarity
        };
        
        // Cache directory for generated audio
        this.cacheDir = path.join(__dirname, '../cache/tts');
        this.ensureCacheDir();
        
        // Track generated audio files for cleanup
        this.generatedFiles = new Map();
        
        // Cleanup old files every hour
        setInterval(() => {
            this.cleanupOldFiles();
        }, 60 * 60 * 1000);
        
        console.log('🔊 TTS Service initialized with voice:', this.voiceConfig.name);
    }

    /**
     * Ensure cache directory exists
     */
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            console.log('📁 Created TTS cache directory:', this.cacheDir);
        }
    }

    /**
     * Convert text to speech and return audio buffer
     * @param {string} text - Text to convert to speech
     * @param {Object} options - Optional voice/audio settings
     * @returns {Promise<Buffer>} - Audio data as buffer
     */
    async textToSpeech(text, options = {}) {
        try {
            if (!text || text.trim().length === 0) {
                throw new Error('Text is required for TTS conversion');
            }

            console.log(`🔊 Converting to speech: "${text.substring(0, 50)}..."`);
            
            // Clean and prepare text
            const cleanText = this.preprocessText(text);
            
            // Check cache first
            const cacheKey = this.getCacheKey(cleanText, options);
            const cachedFile = path.join(this.cacheDir, `${cacheKey}.wav`);
            
            if (fs.existsSync(cachedFile)) {
                console.log('📦 Using cached TTS:', cacheKey);
                return fs.readFileSync(cachedFile);
            }

            // Merge options with defaults
            const voiceConfig = { ...this.voiceConfig, ...options.voice };
            const audioConfig = { ...this.audioConfig, ...options.audio };
            
            // Prepare request
            const request = {
                input: { text: cleanText },
                voice: voiceConfig,
                audioConfig: audioConfig
            };

            // Generate speech
            const [response] = await this.ttsClient.synthesizeSpeech(request);
            
            if (!response.audioContent) {
                throw new Error('No audio content received from TTS service');
            }

            // Cache the result
            fs.writeFileSync(cachedFile, response.audioContent);
            this.generatedFiles.set(cacheKey, Date.now());
            
            console.log(`✅ TTS generated: ${cleanText.length} chars -> ${response.audioContent.length} bytes`);
            
            return response.audioContent;
            
        } catch (error) {
            console.error('❌ TTS Error:', error);
            throw error;
        }
    }

    /**
     * Convert text to speech with SSML support
     * @param {string} ssmlText - SSML formatted text
     * @param {Object} options - Voice/audio options
     * @returns {Promise<Buffer>} - Audio data
     */
    async ssmlToSpeech(ssmlText, options = {}) {
        try {
            console.log(`🔊 Converting SSML to speech: "${ssmlText.substring(0, 50)}..."`);
            
            // Validate SSML
            if (!ssmlText.includes('<speak>')) {
                ssmlText = `<speak>${ssmlText}</speak>`;
            }

            // Merge options with defaults
            const voiceConfig = { ...this.voiceConfig, ...options.voice };
            const audioConfig = { ...this.audioConfig, ...options.audio };
            
            const request = {
                input: { ssml: ssmlText },
                voice: voiceConfig,
                audioConfig: audioConfig
            };

            const [response] = await this.ttsClient.synthesizeSpeech(request);
            
            if (!response.audioContent) {
                throw new Error('No audio content received from SSML TTS');
            }

            console.log(`✅ SSML TTS generated: ${response.audioContent.length} bytes`);
            return response.audioContent;
            
        } catch (error) {
            console.error('❌ SSML TTS Error:', error);
            throw error;
        }
    }

    /**
     * Generate TTS for Twilio-compatible URL
     * @param {string} text - Text to convert
     * @param {string} callSid - Call identifier for file naming
     * @param {Object} options - TTS options
     * @returns {Promise<string>} - URL to generated audio file
     */
    async generateTwilioAudio(text, callSid, options = {}) {
        try {
            // Generate audio
            const audioBuffer = await this.textToSpeech(text, options);
            
            // Save to public directory for Twilio access
            const fileName = `tts_${callSid}_${Date.now()}.wav`;
            const publicDir = path.join(__dirname, '../public/audio');
            
            // Ensure public audio directory exists
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }
            
            const filePath = path.join(publicDir, fileName);
            fs.writeFileSync(filePath, audioBuffer);
            
            // Return URL that Twilio can access
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const audioUrl = `${baseUrl}/audio/${fileName}`;
            
            console.log(`🔊 Generated Twilio audio: ${audioUrl}`);
            
            // Schedule cleanup
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up TTS file: ${fileName}`);
                }
            }, 5 * 60 * 1000); // Delete after 5 minutes
            
            return audioUrl;
            
        } catch (error) {
            console.error('❌ Twilio audio generation error:', error);
            throw error;
        }
    }

    /**
     * Preprocess text for better TTS output
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     */
    preprocessText(text) {
        if (!text) return '';
        
        return text
            .trim()
            // Fix common business terms for better pronunciation
            .replace(/\bHighIQ\b/g, 'High I Q')
            .replace(/\bAI\b/g, 'A I')
            .replace(/\bAPI\b/g, 'A P I')
            .replace(/\bCRM\b/g, 'C R M')
            .replace(/\bROI\b/g, 'R O I')
            .replace(/\bSaaS\b/g, 'Software as a Service')
            // Add natural pauses
            .replace(/\. /g, '. <break time="300ms"/> ')
            .replace(/\? /g, '? <break time="400ms"/> ')
            .replace(/\! /g, '! <break time="300ms"/> ')
            // Fix numbers for better pronunciation
            .replace(/\b24\/7\b/g, 'twenty four seven')
            .replace(/\b(\d+)%\b/g, '$1 percent')
            // Remove problematic characters
            .replace(/[^\w\s.,!?()-]/g, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Create SSML for enhanced speech control
     * @param {string} text - Base text
     * @param {Object} options - SSML options
     * @returns {string} - SSML formatted text
     */
    createSSML(text, options = {}) {
        const {
            rate = '0.9',
            pitch = '0st',
            volume = '0dB',
            emphasis = null,
            pause = null
        } = options;

        let ssml = `<speak>`;
        
        // Apply prosody controls
        ssml += `<prosody rate="${rate}" pitch="${pitch}" volume="${volume}">`;
        
        if (emphasis) {
            ssml += `<emphasis level="${emphasis}">`;
        }
        
        ssml += this.preprocessText(text);
        
        if (emphasis) {
            ssml += `</emphasis>`;
        }
        
        if (pause) {
            ssml += `<break time="${pause}"/>`;
        }
        
        ssml += `</prosody></speak>`;
        
        return ssml;
    }

    /**
     * Get available voices
     * @returns {Promise<Array>} - Available voices
     */
    async getAvailableVoices() {
        try {
            const [result] = await this.ttsClient.listVoices({
                languageCode: 'en-US'
            });
            
            return result.voices.map(voice => ({
                name: voice.name,
                gender: voice.ssmlGender,
                languageCode: voice.languageCodes[0]
            }));
            
        } catch (error) {
            console.error('❌ Error fetching voices:', error);
            return [];
        }
    }

    /**
     * Generate cache key for text and options
     * @param {string} text - Text content
     * @param {Object} options - TTS options
     * @returns {string} - Cache key
     */
    getCacheKey(text, options = {}) {
        const content = text + JSON.stringify(options);
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Clean up old cached files
     */
    cleanupOldFiles() {
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        
        for (const [key, timestamp] of this.generatedFiles.entries()) {
            if (now - timestamp > maxAge) {
                const filePath = path.join(this.cacheDir, `${key}.wav`);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up old TTS cache: ${key}`);
                }
                this.generatedFiles.delete(key);
            }
        }
    }

    /**
     * Test TTS with sample text
     * @returns {Promise<Buffer>} - Test audio
     */
    async testTTS() {
        const testText = "Hello! This is a test of the HighIQ AI text-to-speech system. How does it sound?";
        return await this.textToSpeech(testText);
    }

    /**
     * Health check for TTS service
     * @returns {Promise<Object>} - Health status
     */
    async healthCheck() {
        try {
            // Test with minimal request
            await this.ttsClient.listVoices({ languageCode: 'en-US' });
            
            return {
                status: 'healthy',
                voice: this.voiceConfig.name,
                cacheSize: this.generatedFiles.size,
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
            voice: this.voiceConfig.name,
            cacheSize: this.generatedFiles.size,
            cacheDir: this.cacheDir,
            audioFormat: this.audioConfig.audioEncoding,
            sampleRate: this.audioConfig.sampleRateHertz,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new TTSService();