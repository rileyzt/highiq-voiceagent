// test-calendly.js
require('dotenv').config(); // Add this line at the top

const calendlyService = require('./services/calendly');

async function testCalendly() {
    try {
        console.log('🔍 Getting Calendly user info...');
        const userInfo = await calendlyService.getUserInfo();
        
        console.log('\n✅ SUCCESS! Add this to your .env file:');
        console.log(`CALENDLY_USER_URI=${userInfo.uri}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testCalendly();