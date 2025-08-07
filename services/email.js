const sgMail = require('@sendgrid/mail');

class EmailService {
    constructor() {
        this.apiKey = process.env.SENDGRID_API_KEY;
        this.fromEmail = process.env.SENDGRID_FROM_EMAIL;
        
        if (!this.apiKey) {
            console.error('❌ SENDGRID_API_KEY not found in environment variables');
        } else {
            sgMail.setApiKey(this.apiKey);
            console.log('📧 Email Service initialized with SendGrid');
        }
        
        if (!this.fromEmail) {
            console.error('❌ SENDGRID_FROM_EMAIL not found in environment variables');
        }
    }

    // Send demo booking link via email
    async sendDemoLink(customerData, bookingUrl) {
        try {
            const { email, name, phone, businessNeeds } = customerData;
            
            if (!email) {
                throw new Error('Customer email is required to send demo link');
            }

            const emailTemplate = this.generateDemoEmailTemplate(name, bookingUrl, businessNeeds);
            
            const msg = {
                to: email,
                from: {
                    email: this.fromEmail,
                    name: 'HighIQ AI Team'
                },
                subject: 'Your HighIQ AI Demo - Book Your Slot Now! 🚀',
                html: emailTemplate.html,
                text: emailTemplate.text
            };

            console.log(`📧 Sending demo link to: ${email}`);
            const response = await sgMail.send(msg);
            
            console.log(`✅ Demo email sent successfully to ${email}`);
            return {
                success: true,
                messageId: response[0].headers['x-message-id'],
                email: email,
                bookingUrl: bookingUrl
            };

        } catch (error) {
            console.error('❌ Failed to send demo email:', error.message);
            
            // Handle specific SendGrid errors
            if (error.code === 403) {
                console.error('❌ SendGrid API key invalid or insufficient permissions');
            } else if (error.code === 400) {
                console.error('❌ Invalid email format or missing required fields');
            }
            
            throw error;
        }
    }

    // Send confirmation email after demo is booked
    async sendBookingConfirmation(customerData, meetingDetails) {
        try {
            const { email, name } = customerData;
            const { meetingTime, meetingUrl, eventName } = meetingDetails;
            
            if (!email) {
                throw new Error('Customer email is required for booking confirmation');
            }

            const emailTemplate = this.generateConfirmationEmailTemplate(
                name, 
                meetingTime, 
                meetingUrl, 
                eventName
            );
            
            const msg = {
                to: email,
                from: {
                    email: this.fromEmail,
                    name: 'HighIQ AI Team'
                },
                subject: `Demo Confirmed! Your HighIQ AI Meeting is Scheduled ✅`,
                html: emailTemplate.html,
                text: emailTemplate.text
            };

            console.log(`📅 Sending booking confirmation to: ${email}`);
            const response = await sgMail.send(msg);
            
            console.log(`✅ Confirmation email sent successfully to ${email}`);
            return {
                success: true,
                messageId: response[0].headers['x-message-id'],
                email: email
            };

        } catch (error) {
            console.error('❌ Failed to send confirmation email:', error.message);
            throw error;
        }
    }

    // Generate demo invitation email template
    generateDemoEmailTemplate(customerName, bookingUrl, businessNeeds) {
        const name = customerName || 'there';
        const needs = businessNeeds ? `\n\nWe understand you're looking for: "${businessNeeds}"` : '';
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Your HighIQ AI Demo</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🚀 Your HighIQ AI Demo</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Let's transform your business with AI automation</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 18px; margin-bottom: 20px;">Hi ${name}! 👋</p>
                
                <p>Thank you for your interest in HighIQ AI! We're excited to show you how our AI automation can transform your business operations.${needs}</p>
                
                <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
                    <h3 style="color: #667eea; margin-top: 0;">📅 Book Your Demo Slot</h3>
                    <p>Choose a time that works best for you. Our demos are personalized and typically last 20-30 minutes.</p>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${bookingUrl}" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-weight: bold; 
                                  font-size: 16px; 
                                  display: inline-block;">
                            📅 Book My Demo Now
                        </a>
                    </div>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="color: #333; margin-top: 0;">What to expect in your demo:</h4>
                    <ul style="padding-left: 20px;">
                        <li>🎯 Personalized AI solution for your business</li>
                        <li>📊 ROI calculations and timeline estimates</li>
                        <li>🔧 Live demonstration of our AI agents</li>
                        <li>💬 Q&A session with our AI experts</li>
                        <li>📋 Custom implementation roadmap</li>
                    </ul>
                </div>
                
                <p style="margin-top: 30px;">
                    <strong>Need to reschedule or have questions?</strong><br>
                    Simply reply to this email or call us back anytime.
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <div style="text-align: center; color: #666; font-size: 14px;">
                    <p><strong>HighIQ AI</strong><br>
                    Transforming businesses with intelligent automation</p>
                    <p>📞 Call us back anytime | 📧 Reply to this email</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const text = `
Hi ${name}!

Thank you for your interest in HighIQ AI! We're excited to show you how our AI automation can transform your business operations.${needs}

📅 BOOK YOUR DEMO:
${bookingUrl}

What to expect in your demo:
• Personalized AI solution for your business
• ROI calculations and timeline estimates  
• Live demonstration of our AI agents
• Q&A session with our AI experts
• Custom implementation roadmap

Need to reschedule or have questions? Simply reply to this email or call us back anytime.

Best regards,
HighIQ AI Team
Transforming businesses with intelligent automation
        `;

        return { html, text };
    }

    // Generate booking confirmation email template
    generateConfirmationEmailTemplate(customerName, meetingTime, meetingUrl, eventName) {
        const name = customerName || 'there';
        const formattedTime = new Date(meetingTime).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Demo Confirmed - HighIQ AI</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">✅ Demo Confirmed!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your HighIQ AI meeting is all set</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 18px; margin-bottom: 20px;">Hi ${name}! 🎉</p>
                
                <p>Perfect! Your HighIQ AI demo has been confirmed. We're looking forward to showing you how AI automation can transform your business.</p>
                
                <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #28a745; margin: 25px 0;">
                    <h3 style="color: #28a745; margin-top: 0;">📅 Meeting Details</h3>
                    <p><strong>Event:</strong> ${eventName || 'HighIQ AI Demo'}</p>
                    <p><strong>Date & Time:</strong> ${formattedTime}</p>
                    ${meetingUrl ? `<p><strong>Join Link:</strong> <a href="${meetingUrl}" style="color: #28a745;">${meetingUrl}</a></p>` : ''}
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="color: #333; margin-top: 0;">📋 Prepare for your demo:</h4>
                    <ul style="padding-left: 20px;">
                        <li>Think about your biggest business challenges</li>
                        <li>Consider your team size and current processes</li>
                        <li>Prepare questions about AI automation</li>
                        <li>Have your calendar ready for next steps</li>
                    </ul>
                </div>
                
                <p style="margin-top: 30px;">
                    <strong>Need to reschedule?</strong><br>
                    No problem! Just reply to this email or use your original booking link.
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <div style="text-align: center; color: #666; font-size: 14px;">
                    <p><strong>HighIQ AI</strong><br>
                    Transforming businesses with intelligent automation</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const text = `
Hi ${name}!

Perfect! Your HighIQ AI demo has been confirmed. We're looking forward to showing you how AI automation can transform your business.

📅 MEETING DETAILS:
Event: ${eventName || 'HighIQ AI Demo'}
Date & Time: ${formattedTime}
${meetingUrl ? `Join Link: ${meetingUrl}` : ''}

📋 Prepare for your demo:
• Think about your biggest business challenges
• Consider your team size and current processes  
• Prepare questions about AI automation
• Have your calendar ready for next steps

Need to reschedule? No problem! Just reply to this email.

Best regards,
HighIQ AI Team
        `;

        return { html, text };
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.apiKey) {
                return { status: 'error', message: 'No SendGrid API key configured' };
            }
            
            if (!this.fromEmail) {
                return { status: 'error', message: 'No from email configured' };
            }
            
            // Test API key validity (without sending email)
            return { status: 'healthy', message: 'SendGrid configured correctly' };
            
        } catch (error) {
            return { 
                status: 'error', 
                message: `SendGrid error: ${error.message}` 
            };
        }
    }

    // Send test email
    async sendTestEmail(toEmail) {
        try {
            const msg = {
                to: toEmail,
                from: {
                    email: this.fromEmail,
                    name: 'HighIQ AI Team'
                },
                subject: 'HighIQ AI - Email Service Test ✅',
                html: '<h2>🎉 Email service is working!</h2><p>Your HighIQ AI email integration is set up correctly.</p>',
                text: 'Email service is working! Your HighIQ AI email integration is set up correctly.'
            };

            const response = await sgMail.send(msg);
            console.log(`✅ Test email sent successfully to ${toEmail}`);
            
            return {
                success: true,
                messageId: response[0].headers['x-message-id']
            };

        } catch (error) {
            console.error('❌ Test email failed:', error.message);
            throw error;
        }
    }
}

module.exports = new EmailService();