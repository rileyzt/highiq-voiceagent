// File: services/sms.js
const twilio = require('twilio');

class SMSService {
    constructor() {
        // Use the same Twilio credentials as your voice calls
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
        
        if (!this.fromNumber) {
            console.error('❌ TWILIO_PHONE_NUMBER not found in environment variables');
        }
    }

    async sendDemoLink(toPhone, demoUrl, customerName = 'there') {
        try {
            // ⚡ VALIDATION: Check if trying to send to same number
            if (toPhone === this.fromNumber) {
                console.log('⚠️ Cannot send SMS to same number as FROM number (testing scenario)');
                console.log(`📱 Would send SMS to: ${toPhone}`);
                console.log('💡 For testing: Use a different phone number in call-me endpoint');
                
                return { 
                    success: true, 
                    sid: 'TEST_MODE', 
                    message: 'SMS blocked (same number), but would work in production',
                    phone: toPhone,
                    isTestMode: true
                };
            }

            // ✅ CASUAL, FRIENDLY MESSAGE WITH YOUR LINKS
            const message = `Hey! 🚀 Thanks for calling HighIQ AI!

🎬 Watch our demo: https://youtu.be/6MLu3fbNsdY?si=pRG-nELh0jktFLzn

📅 Book your free consultation: https://calendly.com/pervezonboard

We'll show you how to automate your customer service and save hours daily!

Questions? Just call us back 📞

- The HighIQ Team`;
            
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: toPhone
            });

            console.log(`📱 Demo SMS sent successfully: ${result.sid} to ${toPhone}`);
            return { 
                success: true, 
                sid: result.sid, 
                message: 'Demo link sent via SMS',
                phone: toPhone
            };
            
        } catch (error) {
            console.error('❌ SMS failed:', error);
            
            // Special handling for same number error
            if (error.code === 21266) {
                console.log('💡 TIP: Use a different phone number for testing (not your Twilio number)');
                return { 
                    success: false, 
                    error: 'Cannot send to same number as FROM number. Use different test number.',
                    phone: toPhone,
                    isTestingIssue: true
                };
            }
            
            return { 
                success: false, 
                error: error.message,
                phone: toPhone
            };
        }
    }

    async sendFollowUp(toPhone, customerName, email = null) {
        try {
            // Same validation for follow-up SMS
            if (toPhone === this.fromNumber) {
                console.log('⚠️ Follow-up SMS blocked (same number testing)');
                return { success: true, sid: 'TEST_MODE', isTestMode: true };
            }

            const message = `Hi ${customerName}! Thanks for your interest in HighIQ AI.

Check your messages and let's schedule that demo! Our AI can help you:
• Handle 80% of inquiries automatically
• Save 60% on support costs  
• Work 24/7 without breaks

Call us back anytime for questions.`;
            
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: toPhone
            });

            console.log(`📱 Follow-up SMS sent: ${result.sid} to ${toPhone}`);
            return { success: true, sid: result.sid };
            
        } catch (error) {
            console.error('❌ Follow-up SMS failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Send simple confirmation SMS
    async sendQuickConfirmation(toPhone, customerName = 'there') {
        try {
            // Same validation
            if (toPhone === this.fromNumber) {
                console.log('⚠️ Quick confirmation SMS blocked (same number testing)');
                return { success: true, sid: 'TEST_MODE', isTestMode: true };
            }

            const message = `Hi ${customerName}! Your HighIQ AI demo info is on the way. 

We'll help you automate customer support and save time. Call back anytime with questions!`;
            
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: toPhone
            });

            console.log(`📱 Quick confirmation sent: ${result.sid}`);
            return { success: true, sid: result.sid };
            
        } catch (error) {
            console.error('❌ Quick confirmation failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.fromNumber) {
                return { status: 'error', message: 'No Twilio phone number configured' };
            }
            
            if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
                return { status: 'error', message: 'Twilio credentials missing' };
            }
            
            return { 
                status: 'healthy', 
                message: 'SMS service ready',
                fromNumber: this.fromNumber 
            };
        } catch (error) {
            return { status: 'error', message: `SMS error: ${error.message}` };
        }
    }
}

module.exports = new SMSService();