// Simple test script to verify dashboard endpoints
// Run this with: node test-dashboard.js

const http = require('http');

const testEndpoint = (path, description) => {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };

        console.log(`Testing ${description}...`);
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ ${description} - OK`);
                    if (path.includes('/dashboard/')) {
                        try {
                            const jsonData = JSON.parse(data);
                            console.log(`   Data preview: ${JSON.stringify(jsonData).substring(0, 100)}...`);
                        } catch (e) {
                            console.log(`   Response length: ${data.length} characters`);
                        }
                    }
                } else {
                    console.log(`❌ ${description} - Status: ${res.statusCode}`);
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            console.log(`❌ ${description} - Error: ${err.message}`);
            resolve();
        });

        req.setTimeout(5000, () => {
            console.log(`⏰ ${description} - Timeout`);
            req.destroy();
            resolve();
        });

        req.end();
    });
};

async function runTests() {
    console.log('🧪 Testing HighIQ Voice Agent Dashboard...\n');
    
    // Test main endpoints
    await testEndpoint('/', 'Main page');
    await testEndpoint('/health', 'Health check');
    await testEndpoint('/dashboard-ui', 'Dashboard UI');
    
    console.log('\n📊 Testing Dashboard API endpoints...');
    await testEndpoint('/dashboard/stats', 'Dashboard stats');
    await testEndpoint('/dashboard/calls', 'Dashboard calls');
    await testEndpoint('/dashboard/conversations', 'Dashboard conversations');
    await testEndpoint('/dashboard/analytics', 'Dashboard analytics');
    
    console.log('\n🏁 Test completed!');
    console.log('\nNext steps:');
    console.log('1. If dashboard-ui shows ❌, check if dashboard.html exists in public/');
    console.log('2. If API endpoints show ❌, check if routes/dashboard.js exists');
    console.log('3. Make a test call to populate some data');
    console.log('4. Visit http://localhost:3000/dashboard-ui in your browser');
}

runTests();