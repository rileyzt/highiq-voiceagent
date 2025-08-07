const path = require('path');
const fs = require('fs');

// JSON file paths
const dataDir = path.join(__dirname, '../data');
const callsFile = path.join(dataDir, 'calls.json');
const conversationsFile = path.join(dataDir, 'conversations.json');
const smsFile = path.join(dataDir, 'sms_logs.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize JSON files if they don't exist
const initializeFiles = () => {
    if (!fs.existsSync(callsFile)) {
        fs.writeFileSync(callsFile, JSON.stringify([], null, 2));
        console.log('✅ Created calls.json');
    }
    if (!fs.existsSync(conversationsFile)) {
        fs.writeFileSync(conversationsFile, JSON.stringify([], null, 2));
        console.log('✅ Created conversations.json');
    }
    if (!fs.existsSync(smsFile)) {
        fs.writeFileSync(smsFile, JSON.stringify([], null, 2));
        console.log('✅ Created sms_logs.json');
    }
    console.log('✅ JSON storage initialized');
};

// Helper functions to read/write JSON
const readJSON = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Error reading ${filePath}:`, error.message);
        return [];
    }
};

const writeJSON = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`❌ Error writing ${filePath}:`, error.message);
        return false;
    }
};

// Initialize on startup
initializeFiles();

class CallLogger {
    // Log incoming call (compatible with existing voice.js)
    static logCall(callData) {
        try {
            const { callSid, from, to, status, duration = 0 } = callData;
            
            // First, ensure customer tracking
            this.upsertCustomer(from);
            
            // Read existing calls
            const calls = readJSON(callsFile);
            
            // Create call record
            const callRecord = {
                id: calls.length + 1,
                call_sid: callSid,
                customer_phone: from,
                to_number: to,
                call_status: status || 'initiated',
                call_duration: duration,
                conversation_summary: '',
                demo_requested: false,
                call_date: new Date().toISOString()
            };
            
            // Check if call already exists (prevent duplicates)
            const existingIndex = calls.findIndex(call => call.call_sid === callSid);
            if (existingIndex !== -1) {
                // Update existing call
                calls[existingIndex] = { ...calls[existingIndex], ...callRecord };
            } else {
                // Add new call
                calls.push(callRecord);
            }
            
            // Write back to file
            writeJSON(callsFile, calls);
            
            console.log(`📞 Call logged: ${callSid} from ${from}`);
            return Promise.resolve(callRecord.id);
            
        } catch (error) {
            console.error('❌ Error logging call:', error.message);
            return Promise.reject(error);
        }
    }

    // Log conversation turn (compatible with existing voice.js)
    static logConversation(conversationData) {
        try {
            const { 
                callSid, 
                customerMessage, 
                aiResponse, 
                responseTime,
                sttConfidence 
            } = conversationData;

            // Get customer phone from call_sid
            const calls = readJSON(callsFile);
            const callRecord = calls.find(call => call.call_sid === callSid);
            
            if (!callRecord) {
                throw new Error(`Call ${callSid} not found`);
            }

            const customerPhone = callRecord.customer_phone;
            
            // Read existing conversations
            const conversations = readJSON(conversationsFile);
            
            // Create conversation record
            const conversationRecord = {
                id: conversations.length + 1,
                call_sid: callSid,
                customer_phone: customerPhone,
                customer_message: customerMessage,
                ai_response: aiResponse,
                response_time: responseTime || 0,
                stt_confidence: sttConfidence || 'unknown',
                timestamp: new Date().toISOString()
            };
            
            // Add new conversation
            conversations.push(conversationRecord);
            
            // Write back to file
            writeJSON(conversationsFile, conversations);
            
            console.log(`💬 Conversation logged for: ${callSid}`);
            return Promise.resolve(conversationRecord.id);
            
        } catch (error) {
            console.error('❌ Error logging conversation:', error.message);
            return Promise.reject(error);
        }
    }

    // Upsert customer (create if doesn't exist, update if exists)
    static upsertCustomer(phone, additionalData = {}) {
        try {
            const calls = readJSON(callsFile);
            const now = new Date().toISOString();
            
            // Find existing customer calls
            const customerCalls = calls.filter(call => call.customer_phone === phone);
            
            if (customerCalls.length > 0) {
                // Customer exists - just tracking via calls
                console.log(`👤 Customer call tracked: ${phone}`);
                return Promise.resolve(phone);
            } else {
                // New customer - will be tracked when call is logged
                console.log(`👤 New customer will be tracked: ${phone}`);
                return Promise.resolve(phone);
            }
            
        } catch (error) {
            console.error('❌ Error upserting customer:', error.message);
            return Promise.reject(error);
        }
    }

    // Log SMS delivery
    static logSMS(smsData) {
        try {
            const { customerPhone, messageType, messageSent, smsSid, deliveryStatus } = smsData;
            
            // Read existing SMS logs
            const smsLogs = readJSON(smsFile);
            
            // Create SMS record
            const smsRecord = {
                id: smsLogs.length + 1,
                customer_phone: customerPhone,
                message_type: messageType || 'demo_delivery',
                message_sent: messageSent,
                sms_sid: smsSid,
                delivery_status: deliveryStatus || 'sent',
                sent_date: new Date().toISOString()
            };
            
            // Add new SMS log
            smsLogs.push(smsRecord);
            
            // Write back to file
            writeJSON(smsFile, smsLogs);
            
            console.log(`📱 SMS logged: ${customerPhone}`);
            return Promise.resolve(smsRecord.id);
            
        } catch (error) {
            console.error('❌ Error logging SMS:', error.message);
            return Promise.reject(error);
        }
    }

    // Mark demo as sent for customer
    static markDemoSent(phone) {
        try {
            const calls = readJSON(callsFile);
            let updated = 0;
            
            // Update all calls for this customer to mark demo_requested = true
            calls.forEach(call => {
                if (call.customer_phone === phone) {
                    call.demo_requested = true;
                    updated++;
                }
            });
            
            if (updated > 0) {
                writeJSON(callsFile, calls);
                console.log(`🎯 Demo marked as sent: ${phone}`);
            }
            
            return Promise.resolve(updated);
            
        } catch (error) {
            console.error('❌ Error marking demo as sent:', error.message);
            return Promise.reject(error);
        }
    }

    // ANALYTICS METHODS

    // Get call statistics
    static getCallStats(timeframe = '7days') {
        try {
            const calls = readJSON(callsFile);
            let filteredCalls = calls;
            
            // Apply time filter
            if (timeframe !== 'all') {
                const now = new Date();
                let cutoffDate;
                
                switch (timeframe) {
                    case '24hours':
                        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        break;
                    case '7days':
                        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case '30days':
                        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        cutoffDate = new Date(0);
                }
                
                filteredCalls = calls.filter(call => 
                    new Date(call.call_date) >= cutoffDate
                );
            }
            
            // Calculate stats
            const stats = {
                total_calls: filteredCalls.length,
                completed_calls: filteredCalls.filter(call => 
                    call.call_status === 'completed' || call.call_status === 'answered'
                ).length,
                avg_duration: filteredCalls.length > 0 
                    ? filteredCalls.reduce((sum, call) => sum + (call.call_duration || 0), 0) / filteredCalls.length 
                    : 0,
                demos_requested: filteredCalls.filter(call => call.demo_requested).length
            };
            
            return Promise.resolve(stats);
            
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Get demo conversion rate
    static getDemoStats() {
        try {
            const calls = readJSON(callsFile);
            
            // Get unique customers
            const customerPhones = [...new Set(calls.map(call => call.customer_phone))];
            const customersWithDemos = [...new Set(
                calls.filter(call => call.demo_requested).map(call => call.customer_phone)
            )];
            
            const stats = {
                total_customers: customerPhones.length,
                demos_sent: customersWithDemos.length,
                conversion_rate: customerPhones.length > 0 
                    ? Math.round((customersWithDemos.length / customerPhones.length) * 100 * 100) / 100
                    : 0
            };
            
            return Promise.resolve(stats);
            
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Get daily call volume (for charts)
    static getDailyCallVolume(days = 7) {
        try {
            const calls = readJSON(callsFile);
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            
            // Filter calls within timeframe
            const recentCalls = calls.filter(call => 
                new Date(call.call_date) >= cutoffDate
            );
            
            // Group by date
            const callsByDate = {};
            recentCalls.forEach(call => {
                const date = new Date(call.call_date).toISOString().split('T')[0];
                if (!callsByDate[date]) {
                    callsByDate[date] = {
                        date,
                        call_count: 0,
                        completed_calls: 0
                    };
                }
                callsByDate[date].call_count++;
                if (call.call_status === 'completed' || call.call_status === 'answered') {
                    callsByDate[date].completed_calls++;
                }
            });
            
            // Convert to array and sort
            const result = Object.values(callsByDate)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            
            return Promise.resolve(result);
            
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Get top service interests
    static getServiceInterests() {
        try {
            // Since we don't track service interests in JSON, return empty
            return Promise.resolve([]);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Get recent calls for dashboard
    static getRecentCalls(limit = 10) {
        try {
            const calls = readJSON(callsFile);
            
            const result = calls
                .sort((a, b) => new Date(b.call_date) - new Date(a.call_date))
                .slice(0, limit)
                .map(call => ({
                    call_sid: call.call_sid,
                    customer_phone: call.customer_phone,
                    call_duration: call.call_duration,
                    call_status: call.call_status,
                    call_date: call.call_date,
                    demo_sent: call.demo_requested,
                    service_interest: 'general'
                }));
            
            return Promise.resolve(result);
            
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // LEGACY COMPATIBILITY METHODS (for existing code)

    // Get calls (returns data in same format as SQLite)
    static getCalls() {
        try {
            const calls = readJSON(callsFile);
            return Promise.resolve(calls);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Get conversations (returns data in same format as SQLite)
    static getConversations() {
        try {
            const conversations = readJSON(conversationsFile);
            return Promise.resolve(conversations);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Close database connection (no-op for JSON)
    static close() {
        console.log('✅ JSON storage - no connection to close');
        return Promise.resolve();
    }
}

// Handle graceful shutdown (no-op for JSON)
process.on('SIGINT', () => {
    console.log('\n🔄 JSON storage - graceful shutdown...');
    CallLogger.close().then(() => {
        process.exit(0);
    });
});

module.exports = CallLogger;