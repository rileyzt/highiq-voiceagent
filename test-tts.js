require('dotenv').config();
const ttsService = require('./services/tts');
const fs = require('fs');

async function testTTS() {
    console.log('🔊 Testing TTS Service...');
    
    try {
        // Test health check
        const health = await ttsService.healthCheck();
        console.log('Health Check:', health);
        
        if (health.status !== 'healthy') {
            console.log('❌ TTS Service has issues:', health.error);
            return;
        }
        
        // Test basic TTS
        console.log('🎤 Generating test audio...');
        const testText = "Hello! I'm Alex from HighIQ AI. Our voice agents can handle 24/7 customer support. Would you like a quick demo?";
        
        const audioBuffer = await ttsService.textToSpeech(testText);
        
        // Save test file
        const testFile = './test-tts-output.wav';
        fs.writeFileSync(testFile, audioBuffer);
        
        console.log('✅ TTS working!');
        console.log(`🎵 Generated audio file: ${testFile}`);
        console.log(`📊 Audio size: ${audioBuffer.length} bytes`);
        
        // Test SSML
        console.log('🎭 Testing SSML with pauses and emphasis...');
        const ssmlText = `<speak>
            <prosody rate="0.9">
                Got it - <break time="300ms"/> 100 days works perfectly. 
                <emphasis level="moderate">How big is your team</emphasis> that would use this?
            </prosody>
        </speak>`;
        
        const ssmlAudio = await ttsService.ssmlToSpeech(ssmlText);
        const ssmlFile = './test-ssml-output.wav';
        fs.writeFileSync(ssmlFile, ssmlAudio);
        
        console.log('✅ SSML TTS working!');
        console.log(`🎵 Generated SSML file: ${ssmlFile}`);
        
        // Test Twilio integration
        console.log('📞 Testing Twilio audio generation...');
        const twilioUrl = await ttsService.generateTwilioAudio(
            "Perfect! What's your email for the demo link?", 
            'test-call-123'
        );
        
        console.log('✅ Twilio integration working!');
        console.log(`🔗 Twilio audio URL: ${twilioUrl}`);
        
        console.log('\n🎉 TTS Service is fully functional!');
        console.log('🎵 Play the test files to hear the quality');
        
    } catch (error) {
        console.error('❌ TTS Test failed:', error.message);
        
        if (error.message.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
            console.log('💡 Fix: Make sure your Google Cloud credentials are set');
        }
        
        if (error.message.includes('Text-to-Speech API')) {
            console.log('💡 Fix: Enable Text-to-Speech API in Google Cloud Console');
        }
    }
}

testTTS();