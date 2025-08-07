const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));
app.use(cors()); // Enable CORS for dashboard API

// Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Routes
app.use('/voice', require('./routes/voice'));
app.use('/dashboard', require('./routes/dashboard')); // Add dashboard API routes
app.get('/dashboard-ui', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
})

// Basic route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Dashboard UI route
app.get('/dashboard-ui', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Voice Agent Running', 
        timestamp: new Date(),
        endpoints: {
            voice: '/voice',
            dashboard: '/dashboard-ui',
            api: '/dashboard/*'
        }
    });
});

// Test call route
app.post('/test-call', async (req, res) => {
    console.log('📞 Making test call...');
    
    try {
        const call = await twilioClient.calls.create({
            url: 'https://96fd41fbc8b6.ngrok-free.app/voice/incoming',
            to: '+918967079773', // Your number
            from: process.env.TWILIO_PHONE_NUMBER
        });
        
        res.json({ success: true, callSid: call.sid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🎙️ Voice Agent server running on port ${port}`);
    console.log(`📊 Dashboard available at: http://localhost:${port}/dashboard-ui`);
    console.log(`🔗 Voice agent at: http://localhost:${port}`);
    console.log(`📈 API endpoints at: http://localhost:${port}/dashboard/*`);
});

// Export twilioClient
module.exports = { twilioClient };