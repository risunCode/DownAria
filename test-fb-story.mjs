/**
 * Test Facebook Story Fetch
 * Run: node test-fb-story.mjs
 */

const BASE_URL = 'http://localhost:3000';
const TEST_URL = 'https://web.facebook.com/stories/122107473992463671/UzpfSVNDOjE1ODU1OTg3NTkyOTAwNjQ=/?view_single=1';

async function testAPI(url) {
    console.log('='.repeat(60));
    console.log('Testing Facebook Story API');
    console.log('URL:', url);
    console.log('='.repeat(60));
    
    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}/api/meta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await res.json();
        const time = Date.now() - start;
        
        console.log(`\nResponse (${time}ms):`);
        console.log('Status:', res.status);
        console.log('Success:', data.success);
        
        if (data.error) {
            console.log('Error:', data.error);
        }
        
        if (data.data) {
            console.log('Title:', data.data.title);
            console.log('Author:', data.data.author);
            console.log('Used Cookie:', data.data.usedCookie);
            console.log('Formats:', data.data.formats?.length || 0);
            
            if (data.data.formats?.length > 0) {
                console.log('\nMedia found:');
                data.data.formats.forEach((f, i) => {
                    console.log(`  ${i + 1}. ${f.quality} (${f.type}) - ${f.url?.substring(0, 60)}...`);
                });
            }
        }
        
        return data;
    } catch (e) {
        console.log('Fetch Error:', e.message);
        return null;
    }
}

// Run test
testAPI(TEST_URL).then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('Test complete');
});
