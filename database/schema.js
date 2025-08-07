const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const dbDir = path.join(__dirname);
const dbPath = path.join(dbDir, 'voice_agent.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database:', dbPath);
    }
});

// Create tables if they don't exist
const initializeTables = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Customers table
            db.run(`CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                first_call_date TEXT,
                total_calls INTEGER DEFAULT 0,
                demo_sent BOOLEAN DEFAULT 0,
                demo_sent_date TEXT,
                service_interest TEXT,
                lead_status TEXT DEFAULT 'new',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // Call logs table
            db.run(`CREATE TABLE IF NOT EXISTS call_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT UNIQUE NOT NULL,
                customer_phone TEXT,
                call_duration INTEGER DEFAULT 0,
                call_status TEXT DEFAULT 'initiated',
                conversation_summary TEXT,
                demo_requested BOOLEAN DEFAULT 0,
                call_date TEXT DEFAULT CURRENT_TIMESTAMP,
                to_number TEXT,
                FOREIGN KEY (customer_phone) REFERENCES customers(phone)
            )`);

            // Conversations table
            db.run(`CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                customer_phone TEXT,
                customer_message TEXT,
                ai_response TEXT,
                response_time INTEGER,
                stt_confidence TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (call_sid) REFERENCES call_logs(call_sid),
                FOREIGN KEY (customer_phone) REFERENCES customers(phone)
            )`);

            // SMS logs table
            db.run(`CREATE TABLE IF NOT EXISTS sms_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_phone TEXT,
                message_type TEXT DEFAULT 'demo_delivery',
                message_sent TEXT,
                sms_sid TEXT,
                sent_date TEXT DEFAULT CURRENT_TIMESTAMP,
                delivery_status TEXT DEFAULT 'sent',
                FOREIGN KEY (customer_phone) REFERENCES customers(phone)
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating tables:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Database tables initialized');
                    resolve();
                }
            });
        });
    });
};

// Initialize tables on startup
initializeTables().catch(console.error);

class CallLogger {
    // Log incoming call (compatible with existing voice.js)
    static logCall(callData) {
        return new Promise((resolve, reject) => {
            const { callSid, from, to, status, duration = 0 } = callData;
            
            // First, ensure customer exists
            this.upsertCustomer(from).then(() => {
                // Insert call log
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO call_logs 
                    (call_sid, customer_phone, to_number, call_status, call_duration, call_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                
                stmt.run([
                    callSid,
                    from,
                    to,
                    status || 'initiated',
                    duration,
                    new Date().toISOString()
                ], function(err) {
                    if (err) {
                        console.error('❌ Error logging call:', err.message);
                        reject(err);
                    } else {
                        console.log(`📞 Call logged: ${callSid} from ${from}`);
                        resolve(this.lastID);
                    }
                });
                
                stmt.finalize();
            }).catch(reject);
        });
    }

    // Log conversation turn (compatible with existing voice.js)
    static logConversation(conversationData) {
        return new Promise((resolve, reject) => {
            const { 
                callSid, 
                customerMessage, 
                aiResponse, 
                responseTime,
                sttConfidence 
            } = conversationData;

            // Get customer phone from call_sid
            db.get(
                'SELECT customer_phone FROM call_logs WHERE call_sid = ?',
                [callSid],
                (err, row) => {
                    if (err) {
                        console.error('❌ Error finding customer phone:', err.message);
                        reject(err);
                        return;
                    }

                    const customerPhone = row?.customer_phone;
                    
                    const stmt = db.prepare(`
                        INSERT INTO conversations 
                        (call_sid, customer_phone, customer_message, ai_response, response_time, stt_confidence, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    stmt.run([
                        callSid,
                        customerPhone,
                        customerMessage,
                        aiResponse,
                        responseTime || 0,
                        sttConfidence || 'unknown',
                        new Date().toISOString()
                    ], function(err) {
                        if (err) {
                            console.error('❌ Error logging conversation:', err.message);
                            reject(err);
                        } else {
                            console.log(`💬 Conversation logged for: ${callSid}`);
                            resolve(this.lastID);
                        }
                    });
                    
                    stmt.finalize();
                }
            );
        });
    }

    // Upsert customer (create if doesn't exist, update if exists)
    static upsertCustomer(phone, additionalData = {}) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            
            // Check if customer exists
            db.get('SELECT * FROM customers WHERE phone = ?', [phone], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row) {
                    // Update existing customer
                    const stmt = db.prepare(`
                        UPDATE customers 
                        SET total_calls = total_calls + 1, 
                            updated_at = ?,
                            service_interest = COALESCE(?, service_interest),
                            notes = COALESCE(?, notes)
                        WHERE phone = ?
                    `);
                    
                    stmt.run([
                        now,
                        additionalData.service_interest,
                        additionalData.notes,
                        phone
                    ], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`👤 Customer updated: ${phone}`);
                            resolve(row.id);
                        }
                    });
                    stmt.finalize();
                } else {
                    // Create new customer
                    const stmt = db.prepare(`
                        INSERT INTO customers 
                        (phone, first_call_date, total_calls, service_interest, notes, created_at, updated_at)
                        VALUES (?, ?, 1, ?, ?, ?, ?)
                    `);
                    
                    stmt.run([
                        phone,
                        now,
                        additionalData.service_interest || 'general',
                        additionalData.notes || '',
                        now,
                        now
                    ], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`👤 New customer created: ${phone}`);
                            resolve(this.lastID);
                        }
                    });
                    stmt.finalize();
                }
            });
        });
    }

    // Log SMS delivery
    static logSMS(smsData) {
        return new Promise((resolve, reject) => {
            const { customerPhone, messageType, messageSent, smsSid, deliveryStatus } = smsData;
            
            const stmt = db.prepare(`
                INSERT INTO sms_logs 
                (customer_phone, message_type, message_sent, sms_sid, delivery_status, sent_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([
                customerPhone,
                messageType || 'demo_delivery',
                messageSent,
                smsSid,
                deliveryStatus || 'sent',
                new Date().toISOString()
            ], function(err) {
                if (err) {
                    console.error('❌ Error logging SMS:', err.message);
                    reject(err);
                } else {
                    console.log(`📱 SMS logged: ${customerPhone}`);
                    resolve(this.lastID);
                }
            });
            
            stmt.finalize();
        });
    }

    // Mark demo as sent for customer
    static markDemoSent(phone) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                UPDATE customers 
                SET demo_sent = 1, 
                    demo_sent_date = ?,
                    updated_at = ?
                WHERE phone = ?
            `);
            
            const now = new Date().toISOString();
            stmt.run([now, now, phone], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🎯 Demo marked as sent: ${phone}`);
                    resolve(this.changes);
                }
            });
            stmt.finalize();
        });
    }

    // ANALYTICS METHODS

    // Get call statistics
    static getCallStats(timeframe = '7days') {
        return new Promise((resolve, reject) => {
            let timeFilter = '';
            const now = new Date();
            
            switch (timeframe) {
                case '24hours':
                    timeFilter = `WHERE call_date >= datetime('now', '-1 day')`;
                    break;
                case '7days':
                    timeFilter = `WHERE call_date >= datetime('now', '-7 days')`;
                    break;
                case '30days':
                    timeFilter = `WHERE call_date >= datetime('now', '-30 days')`;
                    break;
                default:
                    timeFilter = '';
            }

            const query = `
                SELECT 
                    COUNT(*) as total_calls,
                    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as completed_calls,
                    AVG(call_duration) as avg_duration,
                    COUNT(CASE WHEN demo_requested = 1 THEN 1 END) as demos_requested
                FROM call_logs 
                ${timeFilter}
            `;

            db.get(query, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get demo conversion rate
    static getDemoStats() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(DISTINCT c.phone) as total_customers,
                    COUNT(CASE WHEN c.demo_sent = 1 THEN 1 END) as demos_sent,
                    ROUND(
                        (COUNT(CASE WHEN c.demo_sent = 1 THEN 1 END) * 100.0) / COUNT(DISTINCT c.phone), 
                        2
                    ) as conversion_rate
                FROM customers c
            `;

            db.get(query, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get daily call volume (for charts)
    static getDailyCallVolume(days = 7) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    DATE(call_date) as date,
                    COUNT(*) as call_count,
                    COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as completed_calls
                FROM call_logs 
                WHERE call_date >= datetime('now', '-${days} days')
                GROUP BY DATE(call_date)
                ORDER BY date ASC
            `;

            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Get top service interests
    static getServiceInterests() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    service_interest,
                    COUNT(*) as count,
                    COUNT(CASE WHEN demo_sent = 1 THEN 1 END) as demos_sent
                FROM customers 
                WHERE service_interest IS NOT NULL 
                GROUP BY service_interest 
                ORDER BY count DESC
            `;

            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Get recent calls for dashboard
    static getRecentCalls(limit = 10) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    cl.call_sid,
                    cl.customer_phone,
                    cl.call_duration,
                    cl.call_status,
                    cl.call_date,
                    c.demo_sent,
                    c.service_interest
                FROM call_logs cl
                LEFT JOIN customers c ON cl.customer_phone = c.phone
                ORDER BY cl.call_date DESC
                LIMIT ?
            `;

            db.all(query, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // LEGACY COMPATIBILITY METHODS (for existing code)

    // Get calls (returns SQLite data in JSON format)
    static getCalls() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM call_logs ORDER BY call_date DESC', [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Get conversations (returns SQLite data in JSON format)
    static getConversations() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM conversations ORDER BY timestamp DESC', [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Close database connection
    static close() {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Database connection closed');
                    resolve();
                }
            });
        });
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Closing database connection...');
    CallLogger.close().then(() => {
        process.exit(0);
    });
});

module.exports = CallLogger;