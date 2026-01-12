#!/usr/bin/env node
// Debug semantic search

async function run() {
  // Login
  console.log('Logging in...');
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dms-test.com', password: 'admin123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  console.log('Token obtained');

  // Get organizations
  const orgsRes = await fetch('http://localhost:4000/api/v1/organizations', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const orgsData = await orgsRes.json();
  const orgId = orgsData.data?.[0]?.id;
  console.log('Using organization:', orgId);

  // Test simple semantic search
  console.log('\n=== Simple Semantic Search ===');
  const semanticRes = await fetch('http://localhost:4000/api/v1/search/semantic', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Organization-ID': orgId
    },
    body: JSON.stringify({
      query: 'handbook'
    })
  });
  const semanticData = await semanticRes.json();
  console.log('Semantic search status:', semanticRes.status);
  console.log('Semantic search response:', JSON.stringify(semanticData, null, 2));

  // Test the health endpoint
  console.log('\n=== Health Check ===');
  const healthRes = await fetch('http://localhost:4000/api/v1/health/ready');
  const healthData = await healthRes.json();
  console.log('Health:', JSON.stringify(healthData, null, 2));

  // Check queue stats for any errors
  console.log('\n=== Queue Stats ===');
  const queueRes = await fetch('http://localhost:4000/api/v1/processing/queues/stats', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const queueData = await queueRes.json();
  console.log('Embedding queue:', JSON.stringify(queueData.data?.queues?.['embedding-queue'], null, 2));

  // Check processing/queues endpoint for OpenAI status
  console.log('\n=== Processing Queues Status ===');
  const queuesRes = await fetch('http://localhost:4000/api/v1/processing/queues', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const queuesData = await queuesRes.json();
  console.log('All queues:', JSON.stringify(queuesData.data, null, 2));
}

run().catch(console.error);
