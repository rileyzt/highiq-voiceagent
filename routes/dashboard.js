const express = require('express');
const CallLogger = require('../database/schema');
const router = express.Router();

console.log('🔄 Loading dashboard routes...');

// Dashboard Stats API endpoint
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        // Get basic stats using CallLogger methods
        const [calls, conversations] = await Promise.all([
            CallLogger.getCalls(),
            CallLogger.getConversations()
        ]);

        // Calculate stats from the data
        const totalCalls = calls.length;
        const totalConversations = conversations.length;
        const completedCalls = calls.filter(call => call.call_status === 'answered').length;
        
        // Calculate average response time
        const responseTimes = conversations
            .filter(conv => conv.response_time)
            .map(conv => conv.response_time);
        const avgResponseTime = responseTimes.length > 0 
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
            : 0;

        // Group calls by status
        const callsByStatus = calls.reduce((acc, call) => {
            acc[call.call_status] = (acc[call.call_status] || 0) + 1;
            return acc;
        }, {});

        // Get recent activity (last 24 hours)
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentCalls = calls.filter(call => {
            const callDate = new Date(call.call_date);
            return callDate >= yesterday;
        }).length;

        const recentConversations = conversations.filter(conv => {
            const convDate = new Date(conv.timestamp);
            return convDate >= yesterday;
        }).length;

        const stats = {
            overview: {
                totalCalls,
                totalConversations,
                avgResponseTime: Math.round(avgResponseTime),
                callsByStatus,
                completedCalls,
                successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0
            },
            recent24h: {
                calls: recentCalls,
                conversations: recentConversations
            },
            performance: {
                avgResponseTime: Math.round(avgResponseTime),
                fastResponses: responseTimes.filter(time => time < 1000).length,
                slowResponses: responseTimes.filter(time => time > 3000).length
            },
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Stats calculated: ${totalCalls} calls, ${totalConversations} conversations`);
        res.json(stats);

    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch stats',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Recent Calls API endpoint
router.get('/calls', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        console.log(`📞 Fetching ${limit} recent calls...`);
        
        const calls = await CallLogger.getCalls();
        
        // Sort by call_date (most recent first) and limit
        const recentCalls = calls
            .sort((a, b) => new Date(b.call_date) - new Date(a.call_date))
            .slice(0, limit)
            .map(call => ({
                id: call.call_sid,
                from: call.customer_phone,
                to: call.to_number,
                status: call.call_status,
                duration: call.call_duration,
                timestamp: call.call_date,
                demoRequested: call.demo_requested
            }));

        console.log(`✅ Retrieved ${recentCalls.length} recent calls`);
        res.json({ 
            calls: recentCalls,
            total: calls.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching calls:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch calls',
            details: error.message 
        });
    }
});

// Recent Conversations API endpoint
router.get('/conversations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        console.log(`💬 Fetching ${limit} recent conversations...`);
        
        const conversations = await CallLogger.getConversations();
        
        // Sort by timestamp (most recent first) and limit
        const recentConversations = conversations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit)
            .map(conv => ({
                id: conv.id,
                callSid: conv.call_sid,
                customerPhone: conv.customer_phone,
                customerMessage: conv.customer_message,
                aiResponse: conv.ai_response,
                responseTime: conv.response_time,
                confidence: conv.stt_confidence,
                timestamp: conv.timestamp
            }));

        console.log(`✅ Retrieved ${recentConversations.length} recent conversations`);
        res.json({ 
            conversations: recentConversations,
            total: conversations.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching conversations:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch conversations',
            details: error.message 
        });
    }
});

// Analytics endpoint - Call volume by day
router.get('/analytics/call-volume', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        console.log(`📈 Fetching call volume for ${days} days...`);
        
        const calls = await CallLogger.getCalls();
        
        // Group calls by date
        const callsByDate = {};
        const now = new Date();
        
        // Initialize dates with 0 calls
        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            callsByDate[dateStr] = { date: dateStr, calls: 0, completed: 0 };
        }
        
        // Count actual calls
        calls.forEach(call => {
            const callDate = new Date(call.call_date);
            const dateStr = callDate.toISOString().split('T')[0];
            
            if (callsByDate[dateStr]) {
                callsByDate[dateStr].calls++;
                if (call.call_status === 'answered') {
                    callsByDate[dateStr].completed++;
                }
            }
        });
        
        const volumeData = Object.values(callsByDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        console.log(`✅ Call volume data generated for ${days} days`);
        res.json({
            data: volumeData,
            period: `${days} days`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching call volume:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch call volume',
            details: error.message 
        });
    }
});

// Customer insights endpoint
router.get('/customers', async (req, res) => {
    try {
        console.log('👥 Fetching customer insights...');
        
        // This would use the advanced SQLite methods we created
        // For now, let's get basic customer data from calls
        const [calls, conversations] = await Promise.all([
            CallLogger.getCalls(),
            CallLogger.getConversations()
        ]);
        
        // Group by customer phone
        const customerMap = {};
        
        calls.forEach(call => {
            const phone = call.customer_phone;
            if (!customerMap[phone]) {
                customerMap[phone] = {
                    phone,
                    totalCalls: 0,
                    totalConversations: 0,
                    firstCall: call.call_date,
                    lastCall: call.call_date,
                    demoRequested: false
                };
            }
            
            customerMap[phone].totalCalls++;
            customerMap[phone].demoRequested = customerMap[phone].demoRequested || call.demo_requested;
            
            // Update first/last call dates
            if (new Date(call.call_date) < new Date(customerMap[phone].firstCall)) {
                customerMap[phone].firstCall = call.call_date;
            }
            if (new Date(call.call_date) > new Date(customerMap[phone].lastCall)) {
                customerMap[phone].lastCall = call.call_date;
            }
        });
        
        // Add conversation counts
        conversations.forEach(conv => {
            const phone = conv.customer_phone;
            if (customerMap[phone]) {
                customerMap[phone].totalConversations++;
            }
        });
        
        const customers = Object.values(customerMap)
            .sort((a, b) => new Date(b.lastCall) - new Date(a.lastCall));
        
        console.log(`✅ Customer insights generated for ${customers.length} customers`);
        res.json({
            customers,
            summary: {
                totalCustomers: customers.length,
                activeCustomers: customers.filter(c => {
                    const lastCall = new Date(c.lastCall);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return lastCall >= weekAgo;
                }).length,
                demosRequested: customers.filter(c => c.demoRequested).length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fetching customer insights:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch customer insights',
            details: error.message 
        });
    }
});

// Health check for dashboard API
router.get('/health', async (req, res) => {
    try {
        // Test database connection
        const [calls, conversations] = await Promise.all([
            CallLogger.getCalls(),
            CallLogger.getConversations()
        ]);
        
        res.json({
            status: 'healthy',
            database: 'connected',
            data: {
                totalCalls: calls.length,
                totalConversations: conversations.length
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
        
    } catch (error) {
        console.error('❌ Dashboard API health check failed:', error.message);
        res.status(500).json({
            status: 'unhealthy',
            database: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Real-time stats endpoint (for auto-refresh)
router.get('/realtime', async (req, res) => {
    try {
        const [calls, conversations] = await Promise.all([
            CallLogger.getCalls(),
            CallLogger.getConversations()
        ]);
        
        // Get stats for last hour
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const recentCalls = calls.filter(call => 
            new Date(call.call_date) >= hourAgo
        ).length;
        
        const recentConversations = conversations.filter(conv => 
            new Date(conv.timestamp) >= hourAgo
        ).length;
        
        res.json({
            lastHour: {
                calls: recentCalls,
                conversations: recentConversations
            },
            totals: {
                calls: calls.length,
                conversations: conversations.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching realtime stats:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch realtime stats',
            details: error.message 
        });
    }
});

console.log('✅ Dashboard routes loaded successfully');

module.exports = router;