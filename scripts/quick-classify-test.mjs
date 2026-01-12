#!/usr/bin/env node
// Quick classification test - single document

async function run() {
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dms-test.com', password: 'admin123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;

  const orgsRes = await fetch('http://localhost:4000/api/v1/organizations', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const orgsData = await orgsRes.json();
  const orgId = orgsData.data?.[0]?.id;

  // Test on Invoice document (it has a clear category)
  const docId = 'f2d46545-6159-4e55-aba2-1b01db79f7f0';

  console.log('Triggering classification for Invoice-2024-001.pdf...');
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
  console.log('Job queued:', data.data?.jobIds?.[0]);

  console.log('\nWaiting 10 seconds for processing...');
  await new Promise(r => setTimeout(r, 10000));

  // Get document
  const docRes = await fetch('http://localhost:4000/api/v1/documents/' + docId, {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const docData = await docRes.json();
  const classification = docData.data?.metadata?.aiClassification;

  console.log('\nClassification result:');
  console.log(JSON.stringify(classification, null, 2));
}

run().catch(console.error);
