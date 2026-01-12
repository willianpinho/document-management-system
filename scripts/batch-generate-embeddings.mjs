#!/usr/bin/env node
// Batch generate embeddings for all documents with extracted text

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

  // Get documents with extracted text from database (using the known IDs)
  const docIds = [
    '32c3a9bd-da2e-4764-b1d6-0abcb404ff7f', // Company Handbook.pdf
    '15928b85-f080-464b-acae-92a5f3979a67', // Service Agreement - Client A.pdf
    'ef9d4a48-8e1c-4c9e-9b5c-04459d717e72', // NDA - Partner Corp.pdf
    'f2d46545-6159-4e55-aba2-1b01db79f7f0', // Invoice-2024-001.pdf
    '46029e8e-6f56-4d5b-8834-5825ccd8633e', // Invoice-2024-002.pdf
    '2e30fc28-c2de-4c64-89ea-bebba16c3ac2', // Brand Guidelines.pdf
    '1f1a589b-0697-4f2d-b027-bb260a4a20ca', // README.txt
    '5696061a-263d-44de-a822-1a76ac1f9abc', // Sales Data 2024.csv
    'ebda18e6-d2f7-451a-81dc-6bd283a51cbe', // Customer List.csv
    'd37fb9ff-8dd7-4f31-9e4d-8946c51673d5', // Company Logo.bmp
  ];

  console.log('\nQueueing embedding jobs for', docIds.length, 'documents...\n');

  let successCount = 0;
  for (const docId of docIds) {
    try {
      const res = await fetch('http://localhost:4000/api/v1/documents/' + docId + '/process', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'X-Organization-ID': orgId
        },
        body: JSON.stringify({ operations: ['EMBEDDING'] })
      });
      const data = await res.json();
      if (data.success) {
        console.log('Queued:', docId.substring(0, 8) + '... | Job:', data.data?.jobIds?.[0]?.substring(0, 8) + '...');
        successCount++;
      } else {
        console.log('Failed:', docId.substring(0, 8) + '... |', data.message);
      }
    } catch (err) {
      console.log('Error:', docId.substring(0, 8) + '... |', err.message);
    }
  }

  console.log('\n' + successCount + '/' + docIds.length, 'embedding jobs queued');
  console.log('\nWaiting 30 seconds for processing...');
  await new Promise(r => setTimeout(r, 30000));

  // Check final status
  console.log('\n=== Final Status ===');
  const queueRes = await fetch('http://localhost:4000/api/v1/processing/queues/stats', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const queueData = await queueRes.json();
  console.log('Queue stats:', JSON.stringify(queueData.data, null, 2));
}

run().catch(console.error);
