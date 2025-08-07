const CallLogger = require('../database/schema');
console.log('🔄 Loading voice routes...');
const express = require('express');
const twilio = require('twilio');
const router = express.Router();

// Import services
const sttService = require('../services/stt');
const llmService = require('../services/llm');
const ttsService = require('../services/tts');
const calendlyService = require('../services/calendly');
const smsService = require('../services/sms'); // SMS service for demo delivery

// Configuration
const USE_GOOGLE_STT = process.env.USE_GOOGLE_STT === 'true' || false; // Toggle Google Cloud STT

// ✅ SIMPLIFIED function to detect if customer wants to book a demo
function shouldBookDemo(aiResponse, customerInput) {
    const response = aiResponse.toLowerCase();
    const input = customerInput.toLowerCase();
    
    // AI promises to send demo
    const aiBookingSignals = [
        'texting you',
        'text you',
        'sending you',
        'i\'m texting',
        'texting the demo',
        'demo video and booking',
        'texting you the demo',
        'text the demo link',
        'sending the demo'
    ];
    
    // Customer requests demo
    const customerBookingSignals = [
        'demo',
        'show me',
        'book',
        'schedule',
        'yes please',
        'sounds good',
        'let\'s do it',
        'sign me up',
        'interested',
        'yes',
        'sure',
        'okay'
    ];
    
    const aiWantsToBook = aiBookingSignals.some(signal => response.includes(signal));
    const customerWantsToBook = customerBookingSignals.some(signal => input.includes(signal));
    
    console.log(`🔍 Demo booking check - AI: ${aiWantsToBook}, Customer: ${customerWantsToBook}`);
    console.log(`🔍 AI response: "${response.substring(0, 50)}..."`);
    console.log(`🔍 Customer input: "${input.substring(0, 50)}..."`);
    
    return aiWantsToBook || customerWantsToBook;
}

// GET route for browser testing
router.get('/incoming', (req, res) => {
    res.json({ message: 'Voice route is working! Use POST for actual calls.' });
});

// Handle incoming calls
router.post('/incoming', (req, res) => {
    console.log('📞 Incoming call received');
    
    // Log the call
    CallLogger.logCall({
        callSid: req.body.CallSid,
        from: req.body.From,
        to: req.body.To,
        status: 'answered'
    });
    
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Greet the caller
    twiml.say({
        voice: 'alice'
    }, 'Hello! Welcome to HighIQ AI. What business challenge can I help you solve today?');
    
    if (USE_GOOGLE_STT) {
        console.log('🎤 Using Google Cloud STT with MediaStream');
        
        // Use MediaStream for better STT
        twiml.connect().stream({
            url: `wss://${req.get('host')}/voice/stream`,
            name: req.body.CallSid
        });
        
        // Fallback gather for compatibility
        twiml.gather({
            input: 'speech',
            timeout: 10,
            speechTimeout: 'auto',
            action: '/voice/process-speech',
            method: 'POST',
            hints: 'HighIQ, AI automation, customer service, demo, pricing, timeline' // Help Twilio STT
        });
        
    } else {
        console.log('🎤 Using Twilio built-in STT');
        
        // Enhanced Twilio speech recognition
        twiml.gather({
            input: 'speech',
            timeout: 10,
            speechTimeout: 'auto',
            action: '/voice/process-speech',
            method: 'POST',
            language: 'en-US',
            hints: 'HighIQ, AI automation, customer service, demo, pricing, timeline, team size, support tickets',
            profanityFilter: false, // Keep natural speech
            speechModel: 'phone_call' // Optimized for phone audio
        });
    }
    
    // Fallback if no speech detected
    twiml.say('I didn\'t catch that. Could you tell me what business challenge you\'re facing?');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Process customer speech (works with both STT methods)
router.post('/process-speech', async (req, res) => {
    console.log('🎤 Processing customer speech...');
    
    const startTime = Date.now();
    const twiml = new twilio.twiml.VoiceResponse();
    let speechResult = req.body.SpeechResult;
    const callSid = req.body.CallSid;
    const confidence = req.body.Confidence || 'unknown';
    
    console.log(`📊 Speech confidence: ${confidence}`);
    console.log(`Customer said (${callSid}):`, speechResult);
    
    try {
        // Enhanced speech processing
        if (!speechResult || speechResult.trim().length === 0) {
            console.log('⚠️ Empty speech result received');
            
            twiml.say('I didn\'t catch that. Could you repeat what you need help with?');
            
            // Give another chance
            twiml.gather({
                input: 'speech',
                timeout: 15,
                speechTimeout: 'auto',
                action: '/voice/process-speech',
                method: 'POST',
                hints: 'HighIQ, AI automation, customer service, demo, pricing'
            });
            
            res.type('text/xml');
            res.send(twiml.toString());
            return;
        }
        
        // Clean up speech result
        speechResult = speechResult.trim();
        
        // Low confidence handling (if available)
        if (confidence !== 'unknown' && parseFloat(confidence) < 0.7) {
            console.log(`⚠️ Low confidence speech (${confidence}): "${speechResult}"`);
            
            // For very low confidence, ask for clarification
            if (parseFloat(confidence) < 0.5) {
                twiml.say('I want to make sure I understand correctly. Could you rephrase that?');
                
                twiml.gather({
                    input: 'speech',
                    timeout: 15,
                    speechTimeout: 'auto', 
                    action: '/voice/process-speech',
                    method: 'POST'
                });
                
                res.type('text/xml');
                res.send(twiml.toString());
                return;
            }
        }
        
        // Generate AI response using your existing LLM with conversation context
        console.log(`🧠 Sending to LLM: "${speechResult}"`);
        let aiResponse = await llmService.generateResponse(speechResult, callSid);
        console.log(`🤖 AI Response (${callSid}):`, aiResponse);
        
        // ✅ SIMPLIFIED SMS-ONLY DEMO BOOKING
        if (shouldBookDemo(aiResponse, speechResult)) {
            console.log('🎯 Demo booking detected - sending SMS immediately!');
            
            try {
                // Extract basic customer data from conversation context
                const conversationSummary = llmService.getConversationSummary(callSid);
                const customerData = {
                    phone: req.body.From,
                    serviceInterest: conversationSummary?.context?.serviceInterest || 'automation',
                    businessNeeds: speechResult
                };

                // Generate booking URL (using your Calendly link)
                const bookingUrl = 'https://calendly.com/pervezonboard';
                console.log(`📅 Using Calendly URL: ${bookingUrl}`);

                // Send SMS immediately - no email needed!
                const smsResult = await smsService.sendDemoLink(req.body.From, bookingUrl);
                
                if (smsResult.success) {
                    console.log(`✅ Demo SMS sent successfully: ${smsResult.sid}`);
                    
                    // Update AI response to confirm SMS delivery if not already mentioned
                    if (!aiResponse.toLowerCase().includes('texting') && !aiResponse.toLowerCase().includes('text')) {
                        aiResponse += " I'm texting you the demo video and booking link right now!";
                    }
                } else {
                    console.error('❌ SMS failed:', smsResult.error);
                    // Fallback - promise to call back
                    aiResponse += " I'll have someone follow up with demo details shortly.";
                }

                console.log(`🔗 Demo links sent via SMS to: ${req.body.From}`);

            } catch (error) {
                console.error('❌ Demo booking failed:', error.message);
                // Don't break the call - continue with normal response
                aiResponse += " I'll have someone follow up with demo details shortly.";
            }
        }
        
        // Log the conversation
        CallLogger.logConversation({
            callSid: callSid,
            customerMessage: speechResult,
            aiResponse: aiResponse,
            responseTime: Date.now() - startTime,
            sttConfidence: confidence
        });
        
        // Validate AI response
        if (!aiResponse || aiResponse.trim().length === 0) {
            console.error('❌ Empty AI response received');
            twiml.say('I apologize, let me connect you with a human representative.');
            res.type('text/xml');
            res.send(twiml.toString());
            return;
        }
        
        // Convert response to speech and play it
        const audioUrl = await ttsService.generateTwilioAudio(aiResponse, callSid);
        twiml.play(audioUrl);
        
        // Smart conversation continuation logic
        const lowerResponse = aiResponse.toLowerCase();
        const lowerCustomer = speechResult.toLowerCase();
        
        // Check for conversation ending signals
        const isClosing = lowerResponse.includes('goodbye') || 
                         lowerResponse.includes('thank you for calling') ||
                         lowerResponse.includes('have a great day') ||
                         lowerResponse.includes('talk soon') ||
                         lowerCustomer.includes('goodbye') ||
                         lowerCustomer.includes('thank you') ||
                         lowerCustomer.includes('bye');
        
        // Check for demo booking confirmation
        const isDemoBooked = lowerResponse.includes('texting you') ||
                            lowerResponse.includes('text you') ||
                            lowerResponse.includes('demo link') ||
                            lowerResponse.includes('check your messages') ||
                            lowerResponse.includes('sending you');
        
        if (isClosing || isDemoBooked) {
            console.log(`🎯 Conversation ending detected: closing=${isClosing}, demo=${isDemoBooked}`);
            
            if (isDemoBooked) {
                twiml.say('Perfect! Check your messages in a few seconds. Have a great day!');
            } else {
                twiml.say('Thank you for your interest in HighIQ AI. Have a great day!');
            }
            
            // End the call gracefully
            twiml.hangup();
            
        } else {
            // Continue conversation with enhanced gathering
            console.log('🔄 Continuing conversation...');
            
            twiml.gather({
                input: 'speech',
                timeout: 20, // Longer timeout for thoughtful responses
                speechTimeout: 'auto',
                action: '/voice/process-speech',
                method: 'POST',
                hints: 'demo, pricing, timeline, team size, customers, support, automation, yes, no'
            });
            
            // Fallback prompt
            twiml.pause({ length: 1 });
            twiml.say({
                voice: 'alice',
                rate: '0.9'
            }, 'What else would you like to know?');
            
            // Final fallback
            twiml.gather({
                input: 'speech',
                timeout: 15,
                speechTimeout: 'auto',
                action: '/voice/process-speech',
                method: 'POST'
            });
            
            // If still no response, end gracefully
            twiml.say('It seems like we got disconnected. Feel free to call back anytime. Goodbye!');
        }
        
    } catch (error) {
        console.error('❌ Error processing speech:', error);
        console.error('Stack trace:', error.stack);
        
        // Friendly error handling
        if (error.message.includes('rate limit')) {
            twiml.say('I\'m experiencing high demand right now. Let me get you to a human representative.');
        } else if (error.message.includes('timeout')) {
            twiml.say('I\'m taking a bit longer to process. Let me connect you with someone who can help immediately.');
        } else {
            twiml.say('I apologize for the technical difficulty. Let me connect you with a human agent right away.');
        }
        
        // TODO: Add actual human handoff logic here
        twiml.say('Please hold while I transfer your call.');
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// ✅ REMOVED COMPLEX EMAIL ENDPOINTS - SMS ONLY NOW

// Demo booking endpoint (simplified for SMS)
router.post('/book-demo', async (req, res) => {
    console.log('📅 Demo booking request received');
    
    try {
        const { customerData, callSid } = req.body;
        
        // Use your Calendly link directly
        const bookingUrl = 'https://calendly.com/pervezonboard';
        
        console.log(`🔗 Using Calendly URL for ${callSid}:`, bookingUrl);
        
        res.json({
            success: true,
            bookingUrl: bookingUrl,
            message: 'Demo booking link ready for SMS'
        });
        
    } catch (error) {
        console.error('❌ Demo booking failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Calendly webhook endpoint
router.post('/calendly-webhook', async (req, res) => {
    console.log('🔔 Calendly webhook received');
    
    try {
        const result = await calendlyService.handleWebhook(req.body);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Calendly webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Webhook for call status (enhanced)
router.post('/status', async (req, res) => {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    const callDuration = req.body.CallDuration || 0;
    
    console.log(`📊 Call status for ${callSid}: ${callStatus} (${callDuration}s)`);
    
    // Log call completion
    if (callStatus === 'completed') {
        console.log(`✅ Call completed: ${callSid} - Duration: ${callDuration}s`);
        
        // Get conversation summary before clearing 
        const summary = llmService.getConversationSummary(callSid);
        if (summary) {
            console.log(`📝 Conversation summary:`, {
                messageCount: summary.messageCount,
                context: summary.context
            });
        }
    }
    
    // Clear conversation memory when call ends
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
        console.log(`🧹 Clearing conversation context for ended call: ${callSid}`);
        llmService.clearConversation(callSid);
        
        // Close STT session if using Google Cloud STT
        if (USE_GOOGLE_STT) {
            sttService.closeSession(callSid);
        }
    }
    
    res.sendStatus(200);
});

// Health check endpoint (updated for SMS-only)
router.get('/health', async (req, res) => {
    try {
        const sttHealth = await sttService.healthCheck();
        const llmHealth = await llmService.healthCheck();
        const smsHealth = await smsService.healthCheck();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                stt: sttHealth,
                llm: llmHealth,
                sms: smsHealth,
                usingGoogleSTT: USE_GOOGLE_STT,
                demoDelivery: 'SMS-only (no email collection)'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET route for browser testing call-me
router.get('/call-me', async (req, res) => {
    console.log('📞 Making outbound call via GET...');
    
    const { twilioClient } = require('../server');
    
    try {
        const call = await twilioClient.calls.create({
            url: 'https://b86c17ffeb46.ngrok-free.app/voice/incoming', // Update this URL!
            to: '+918967079773',
            from: process.env.TWILIO_PHONE_NUMBER,
            sendDigits: 'ww1',
            statusCallback: 'https://b86c17ffeb46.ngrok-free.app/voice/status' // Update this URL!
        });
        
        console.log('✅ Call initiated:', call.sid);
        res.json({ 
            success: true, 
            message: 'Call initiated!', 
            callSid: call.sid 
        });
        
    } catch (error) {
        console.error('❌ Call failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// POST route for making outbound calls
router.post('/call-me', async (req, res) => {
    console.log('📞 Making outbound call...');
    
    const { twilioClient } = require('../server');
    
    try {
        const call = await twilioClient.calls.create({
            url: 'https://b86c17ffeb46.ngrok-free.app/voice/incoming', // Update this URL!
            to: '+918967079773',
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: 'https://b86c17ffeb46.ngrok-free.app/voice/status' // Update this URL!
        });
        
        console.log('✅ Call initiated:', call.sid);
        res.json({ 
            success: true, 
            message: 'Call initiated!', 
            callSid: call.sid 
        });
        
    } catch (error) {
        console.error('❌ Call failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Debug endpoint to check conversation context
router.get('/debug/:callSid', (req, res) => {
    const callSid = req.params.callSid;
    const summary = llmService.getConversationSummary(callSid);
    
    if (summary) {
        res.json({
            callSid: callSid,
            conversationSummary: summary,
            status: 'Context found',
            sttService: USE_GOOGLE_STT ? 'Google Cloud' : 'Twilio Built-in',
            demoDelivery: 'SMS-only'
        });
    } else {
        res.json({
            callSid: callSid,
            status: 'No context found',
            sttService: USE_GOOGLE_STT ? 'Google Cloud' : 'Twilio Built-in',
            demoDelivery: 'SMS-only'
        });
    }
});

module.exports = router;