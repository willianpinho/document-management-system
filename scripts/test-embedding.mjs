#!/usr/bin/env node
// Test script for embedding generation

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
  if (!token) {
    console.error('Failed to get token');
    return;
  }
  console.log('Token obtained:', token?.substring(0, 30) + '...');

  // Get organizations first
  const orgsRes = await fetch('http://localhost:4000/api/v1/organizations', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const orgsData = await orgsRes.json();

  const orgId = orgsData.data?.[0]?.id;
  if (!orgId) {
    console.error('No organization found');
    return;
  }
  console.log('Using organization:', orgId);

  // Use a known document ID that has extractedText from the database
  const docId = '32c3a9bd-da2e-4764-b1d6-0abcb404ff7f'; // Company Handbook.pdf

  console.log('\nTriggering embedding for document:', docId);

  // Trigger embedding
  const processRes = await fetch('http://localhost:4000/api/v1/documents/' + docId + '/process', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Organization-ID': orgId
    },
    body: JSON.stringify({ operations: ['EMBEDDING'] })
  });
  const processData = await processRes.json();
  console.log('Process result:', JSON.stringify(processData, null, 2));

  if (!processData.success) {
    console.error('Failed to trigger processing');
    return;
  }

  // Wait for processing
  console.log('\nWaiting 10 seconds for processing...');
  await new Promise(r => setTimeout(r, 10000));

  // Check queue status
  const queueRes = await fetch('http://localhost:4000/api/v1/processing/stats', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const queueData = await queueRes.json();
  console.log('\nQueue stats:', JSON.stringify(queueData.data, null, 2));

  // Check jobs
  const jobsRes = await fetch('http://localhost:4000/api/v1/processing/jobs?limit=5', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const jobsData = await jobsRes.json();
  console.log('\nRecent jobs:');
  (jobsData.data || []).slice(0, 5).forEach(j => {
    console.log(`  ${j.id.substring(0, 8)}... | ${j.type} | ${j.status} | ${j.errorMessage || 'OK'}`);
  });
}

run().catch(console.error);
