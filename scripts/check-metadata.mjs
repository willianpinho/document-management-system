#!/usr/bin/env node
// Check document metadata

async function run() {
  // Login
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dms-test.com', password: 'admin123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;

  // Get organizations
  const orgsRes = await fetch('http://localhost:4000/api/v1/organizations', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const orgsData = await orgsRes.json();
  const orgId = orgsData.data?.[0]?.id;

  // Get document directly
  const docId = '32c3a9bd-da2e-4764-b1d6-0abcb404ff7f'; // Company Handbook.pdf
  const docRes = await fetch('http://localhost:4000/api/v1/documents/' + docId, {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const docData = await docRes.json();
  console.log('Document aiClassification:');
  console.log(JSON.stringify(docData.data?.metadata?.aiClassification, null, 2));
}

run().catch(console.error);
