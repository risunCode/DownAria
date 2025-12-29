const API_KEY = 'dwa_live_OCtzTCWNmFCwthDLVFRqM0cBbC2jlNvf';
const VIDEO_URL = 'https://www.facebook.com/huo.zhi.mu.fu/posts/pfbid0Qv7WqGs1T4SRcwvKM4XugcyhiUF1us3Q6EDHn2bqicP7xDEJTKdQNCXFwwXEDSsDl';
// Try port 3000, if fail, we might need to find the correct port.
const API_BASE = 'http://localhost:3000';

async function testMethods() {
    console.log(`Testing API at: ${API_BASE}`);
    console.log(`Target URL: ${VIDEO_URL}\n`);

    // 1. Test Fetch
    console.log('--- 1. Testing JavaScript Fetch ---');
    try {
        const fetchUrl = `${API_BASE}/api/v1?key=${API_KEY}&url=${encodeURIComponent(VIDEO_URL)}`;
        console.log(`Fetching: ${fetchUrl}`);
        const start = Date.now();
        const response = await fetch(fetchUrl);
        const duration = Date.now() - start;

        console.log(`Status: ${response.status} ${response.statusText}`);

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (data.success) {
                console.log(`✅ Fetch Success (${duration}ms):`);
                console.log(`   Title: ${data.data?.title || 'No Title'}`);
                console.log(`   Platform: ${data.platform}`);
                console.log('   Data:', JSON.stringify(data.data, null, 2).substring(0, 200) + '...');
            } else {
                console.log('❌ Fetch Failed (API returned error):', data);
            }
        } catch (e) {
            console.log('❌ Fetch Failed (Non-JSON response):', text.substring(0, 200));
        }
    } catch (error) {
        console.error('❌ Fetch Network Error:', error.message);
        if (error.cause) console.error('   Cause:', error.cause);
    }
}

testMethods();
