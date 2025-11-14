/**
 * FIND SUPEREMBED API ENDPOINT
 * 
 * The player must call an API to get sources. Let's find it.
 */

const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');

console.log('🔍 FINDING SUPEREMBED API ENDPOINT\n');
console.log('='.repeat(80) + '\n');

// Look for fetch/ajax/XMLHttpRequest in ALL content
console.log('1. Looking for HTTP request patterns:\n');

const requestPatterns = [
  { name: 'fetch()', regex: /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi },
  { name: 'XMLHttpRequest', regex: /\.open\s*\(\s*["']([^"']+)["'],\s*["'`]([^"'`]+)["'`]/gi },
  { name: '$.ajax', regex: /\$\.ajax\s*\(\s*{[^}]*url\s*:\s*["'`]([^"'`]+)["'`]/gi },
  { name: '$.get', regex: /\$\.get\s*\(\s*["'`]([^"'`]+)["'`]/gi },
  { name: '$.post', regex: /\$\.post\s*\(\s*["'`]([^"'`]+)["'`]/gi },
  { name: 'axios', regex: /axios\.[^(]+\(\s*["'`]([^"'`]+)["'`]/gi },
];

const foundEndpoints = new Set();

requestPatterns.forEach(({ name, regex }) => {
  const matches = [...html.matchAll(regex)];
  if (matches.length > 0) {
    console.log(`${name}: ${matches.length} matches`);
    matches.forEach(m => {
      const url = m[1] || m[2];
      console.log(`  ${url}`);
      foundEndpoints.add(url);
    });
    console.log('');
  }
});

// Look for API-like paths
console.log('\n2. Looking for API-like paths:\n');

const apiPatterns = [
  /["'`](\/[^"'`]*(?:api|source|stream|get|load|fetch)[^"'`]*)["'`]/gi,
  /["'`](https?:\/\/[^"'`]*(?:api|source|stream)[^"'`]*)["'`]/gi,
];

apiPatterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    const unique = [...new Set(matches.map(m => m[1]))];
    unique.slice(0, 20).forEach(path => {
      if (path.length < 200) {
        console.log(`  ${path}`);
        foundEndpoints.add(path);
      }
    });
    console.log('');
  }
});

// Look for cloudnestra URLs
console.log('\n3. Looking for cloudnestra URLs:\n');

const cloudnestraPattern = /https?:\/\/[^"'`\s]*cloudnestra[^"'`\s]*/gi;
const cloudnestraMatches = [...html.matchAll(cloudnestraPattern)];

if (cloudnestraMatches.length > 0) {
  console.log(`Found ${cloudnestraMatches.length} cloudnestra URLs:`);
  const unique = [...new Set(cloudnestraMatches.map(m => m[0]))];
  unique.forEach(url => {
    console.log(`  ${url}`);
    foundEndpoints.add(url);
  });
  console.log('');
}

// Look for vidsrc URLs
console.log('\n4. Looking for vidsrc URLs:\n');

const vidsrcPattern = /https?:\/\/[^"'`\s]*vidsrc[^"'`\s]*/gi;
const vidsrcMatches = [...html.matchAll(vidsrcPattern)];

if (vidsrcMatches.length > 0) {
  console.log(`Found ${vidsrcMatches.length} vidsrc URLs:`);
  const unique = [...new Set(vidsrcMatches.map(m => m[0]))];
  unique.forEach(url => {
    console.log(`  ${url}`);
    foundEndpoints.add(url);
  });
  console.log('');
}

// Look for dynamic URL construction
console.log('\n5. Looking for dynamic URL construction:\n');

const constructionPatterns = [
  /["'`]([^"'`]*)\$\{[^}]+\}([^"'`]*)["'`]/gi,
  /["'`]([^"'`]*)\+\s*\w+\s*\+([^"'`]*)["'`]/gi,
];

constructionPatterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.slice(0, 10).forEach(m => {
      console.log(`  ${m[0].substring(0, 100)}`);
    });
    console.log('');
  }
});

// Look for base URL definitions
console.log('\n6. Looking for base URL definitions:\n');

const baseUrlPatterns = [
  /(?:baseUrl|apiUrl|endpoint|apiEndpoint|sourceUrl)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
  /const\s+(\w*[Uu]rl\w*)\s*=\s*["'`]([^"'`]+)["'`]/gi,
];

baseUrlPatterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.forEach(m => {
      console.log(`  ${m[0].substring(0, 150)}`);
      if (m[1] && m[1].includes('http')) {
        foundEndpoints.add(m[1]);
      }
      if (m[2]) {
        foundEndpoints.add(m[2]);
      }
    });
    console.log('');
  }
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY\n');
console.log('='.repeat(80) + '\n');

console.log(`Total unique endpoints found: ${foundEndpoints.size}\n`);

if (foundEndpoints.size > 0) {
  console.log('ALL ENDPOINTS:');
  [...foundEndpoints].forEach((ep, i) => {
    console.log(`${i + 1}. ${ep}`);
  });
  console.log('');
}

// Save results
fs.writeFileSync(
  'deobfuscation/superembed-endpoints.json',
  JSON.stringify([...foundEndpoints], null, 2)
);

console.log('💾 Saved to superembed-endpoints.json\n');

// Now let's try to fetch these endpoints
console.log('='.repeat(80));
console.log('TESTING ENDPOINTS\n');
console.log('='.repeat(80) + '\n');

const https = require('https');
const { URL } = require('url');

async function testEndpoint(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json,text/html,*/*',
          'Referer': 'https://cloudnestra.com/'
        },
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            url,
            status: res.statusCode,
            contentType: res.headers['content-type'],
            bodyLength: data.length,
            body: data.substring(0, 500)
          });
        });
      });

      req.on('error', () => resolve({ url, error: 'Failed' }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, error: 'Timeout' });
      });
      req.end();

    } catch (e) {
      resolve({ url, error: e.message });
    }
  });
}

(async () => {
  const testableEndpoints = [...foundEndpoints].filter(ep => 
    ep.startsWith('http') && !ep.includes('${') && !ep.includes('+')
  );

  if (testableEndpoints.length > 0) {
    console.log(`Testing ${testableEndpoints.length} endpoints...\n`);

    for (const endpoint of testableEndpoints.slice(0, 5)) {
      console.log(`Testing: ${endpoint}`);
      const result = await testEndpoint(endpoint);
      
      if (result.error) {
        console.log(`  ❌ ${result.error}\n`);
      } else {
        console.log(`  ✅ Status: ${result.statusCode}`);
        console.log(`  Content-Type: ${result.contentType}`);
        console.log(`  Body length: ${result.bodyLength}`);
        if (result.body) {
          console.log(`  Preview: ${result.body.substring(0, 200)}\n`);
        }
      }
    }
  }
})();
