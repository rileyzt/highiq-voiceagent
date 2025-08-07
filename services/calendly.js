const axios = require('axios');

class CalendlyService {
    constructor() {
        this.token = process.env.CALENDLY_TOKEN;
        this.userUri = process.env.CALENDLY_USER_URI;
        this.baseUrl = 'https://api.calendly.com';
        
        if (!this.token) {
            console.error('❌ CALENDLY_TOKEN not found in environment variables');
        }
    }

    // Get user info (run this once to get your user URI)
    async getUserInfo() {
        try {
            const response = await axios.get(`${this.baseUrl}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('👤 Calendly User Info:', {
                name: response.data.resource.name,
                email: response.data.resource.email,
                uri: response.data.resource.uri
            });
            
            return response.data.resource;
        } catch (error) {
            console.error('❌ Failed to get Calendly user info:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get available event types (your meeting types)
    async getEventTypes() {
        try {
            if (!this.userUri) {
                throw new Error('CALENDLY_USER_URI not set. Run getUserInfo() first.');
            }

            const response = await axios.get(`${this.baseUrl}/event_types`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    user: this.userUri
                }
            });
            
            console.log('📅 Available Event Types:');
            response.data.collection.forEach(event => {
                console.log(`  - ${event.name} (${event.duration} min): ${event.scheduling_url}`);
            });
            
            return response.data.collection;
        } catch (error) {
            console.error('❌ Failed to get event types:', error.response?.data || error.message);
            throw error;
        }
    }

    // Get scheduling URL for demo bookings
    async getDemoBookingUrl() {
        try {
            const eventTypes = await this.getEventTypes();
            
            // Find the first event type (assuming it's your demo meeting)
            const demoEvent = eventTypes.find(event => 
                event.name.toLowerCase().includes('demo') || 
                event.name.toLowerCase().includes('meeting') ||
                eventTypes.length === 1 // If only one event type, use it
            ) || eventTypes[0]; // Fallback to first event type
            
            if (!demoEvent) {
                throw new Error('No event types found. Please create a meeting type in Calendly.');
            }
            
            console.log(`🎯 Using event type: ${demoEvent.name}`);
            return demoEvent.scheduling_url;
            
        } catch (error) {
            console.error('❌ Failed to get demo booking URL:', error.message);
            throw error;
        }
    }

    // Generate a personalized booking link with prefilled info
    async generatePersonalizedBookingLink(customerData = {}) {
        try {
            const baseUrl = await this.getDemoBookingUrl();
            
            // Add query parameters for prefilling
            const params = new URLSearchParams();
            
            if (customerData.name) {
                params.append('name', customerData.name);
            }
            if (customerData.email) {
                params.append('email', customerData.email);
            }
            if (customerData.phone) {
                params.append('phone', customerData.phone);
            }
            
            // Add custom questions if needed
            if (customerData.businessNeeds) {
                params.append('a1', customerData.businessNeeds); // Custom question 1
            }
            
            const personalizedUrl = params.toString() ? 
                `${baseUrl}?${params.toString()}` : baseUrl;
            
            console.log('🔗 Generated personalized booking link:', personalizedUrl);
            return personalizedUrl;
            
        } catch (error) {
            console.error('❌ Failed to generate personalized booking link:', error.message);
            return await this.getDemoBookingUrl(); // Fallback to basic URL
        }
    }

    // Get upcoming scheduled events (for confirmation/tracking)
    async getScheduledEvents(limit = 10) {
        try {
            const response = await axios.get(`${this.baseUrl}/scheduled_events`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    user: this.userUri,
                    count: limit,
                    sort: 'start_time:asc'
                }
            });
            
            console.log(`📊 Found ${response.data.collection.length} upcoming events`);
            return response.data.collection;
            
        } catch (error) {
            console.error('❌ Failed to get scheduled events:', error.response?.data || error.message);
            throw error;
        }
    }

    // Webhook handler for when meetings are booked
    async handleWebhook(webhookData) {
        try {
            const { event, payload } = webhookData;
            
            console.log(`🔔 Calendly webhook received: ${event}`);
            
            if (event === 'invitee.created') {
                const invitee = payload;
                console.log('👤 New meeting booked:', {
                    name: invitee.name,
                    email: invitee.email,
                    phone: invitee.text_reminder_number,
                    meetingTime: invitee.event.start_time,
                    meetingUrl: invitee.event.location?.join_url
                });
                
                // Here you can update your CRM or send notifications
                return {
                    success: true,
                    message: 'Meeting booking processed',
                    data: invitee
                };
            }
            
            return { success: true, message: 'Webhook processed' };
            
        } catch (error) {
            console.error('❌ Webhook processing failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.token) {
                return { status: 'error', message: 'No Calendly token configured' };
            }
            
            await this.getUserInfo();
            return { status: 'healthy', message: 'Calendly API connected' };
            
        } catch (error) {
            return { 
                status: 'error', 
                message: `Calendly API error: ${error.message}` 
            };
        }
    }
}

module.exports = new CalendlyService();