require('dotenv').config();
const sttService = require('./services/stt');

async function testSTT() {
    console.log('🧪 Testing STT Service...');
    
    try {
        // Test health check
        const health = await sttService.healthCheck();
        console.log('Health Check:', health);
        
        if (health.status === 'healthy') {
            console.log('✅ STT Service is working!');
            console.log('🎤 Ready to transcribe phone calls');
        } else {
            console.log('❌ STT Service has issues:', health.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
            console.log('💡 Fix: Make sure your .env has GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-key.json');
        }
        
        if (error.message.includes('UNAUTHENTICATED')) {
            console.log('💡 Fix: Check your service account key file path and permissions');
        }
        
        if (error.message.includes('PERMISSION_DENIED')) {
            console.log('💡 Fix: Make sure Speech-to-Text API is enabled in Google Cloud Console');
        }
    }
}

testSTT();