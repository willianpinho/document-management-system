#!/usr/bin/env node
// Test AI classification

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

  // Test documents to classify
  const docIds = [
    '32c3a9bd-da2e-4764-b1d6-0abcb404ff7f', // Company Handbook.pdf
    'f2d46545-6159-4e55-aba2-1b01db79f7f0', // Invoice-2024-001.pdf
    'ef9d4a48-8e1c-4c9e-9b5c-04459d717e72', // NDA - Partner Corp.pdf
  ];

  console.log('\n=== Triggering AI Classification ===');
  for (const docId of docIds) {
    try {
      const res = await fetch('http://localhost:4000/api/v1/documents/' + docId + '/process', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'X-Organization-ID': orgId
        },
        body: JSON.stringify({ operations: ['AI_CLASSIFY'] })
      });
      const data = await res.json();
      if (data.success) {
        console.log('Queued classification:', docId.substring(0, 8) + '... | Job:', data.data?.jobIds?.[0]?.substring(0, 8) + '...');
      } else {
        console.log('Failed:', docId.substring(0, 8) + '... |', data.message);
      }
    } catch (err) {
      console.log('Error:', docId.substring(0, 8) + '... |', err.message);
    }
  }

  console.log('\nWaiting 15 seconds for processing...');
  await new Promise(r => setTimeout(r, 15000));

  // Check classification results
  console.log('\n=== Classification Results ===');
  for (const docId of docIds) {
    const docRes = await fetch('http://localhost:4000/api/v1/documents/' + docId, {
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Organization-ID': orgId
      }
    });
    const docData = await docRes.json();
    const doc = docData.data;
    const classification = doc?.metadata?.aiClassification;

    console.log('\n' + doc?.name + ':');
    if (classification) {
      console.log('  Category:', classification.category);
      console.log('  Confidence:', classification.confidence);
      console.log('  Language:', classification.language);
      console.log('  Tags:', classification.tags?.join(', '));
      console.log('  Summary:', classification.summary);
    } else {
      console.log('  No classification found');
    }
  }

  // Check queue stats
  console.log('\n=== Queue Stats ===');
  const queueRes = await fetch('http://localhost:4000/api/v1/processing/queues/stats', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const queueData = await queueRes.json();
  console.log('AI Classify queue:', JSON.stringify(queueData.data?.queues?.['ai-classify-queue'], null, 2));
}

run().catch(console.error);
