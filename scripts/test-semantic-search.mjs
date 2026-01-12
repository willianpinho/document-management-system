#!/usr/bin/env node
// Test script for semantic search

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

  // Test 1: Full-text search
  console.log('\n=== Full-Text Search ===');
  const fullTextRes = await fetch('http://localhost:4000/api/v1/search?query=handbook+policies', {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Organization-ID': orgId
    }
  });
  const fullTextData = await fullTextRes.json();
  console.log('Full-text results:', fullTextData.data?.length || 0, 'documents');
  (fullTextData.data || []).slice(0, 3).forEach(d => {
    console.log('  -', d.name, '| Relevance:', d.relevance?.toFixed(3) || 'N/A');
  });

  // Test 2: Semantic search (find documents about company policies)
  console.log('\n=== Semantic Search ===');
  const semanticRes = await fetch('http://localhost:4000/api/v1/search/semantic', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Organization-ID': orgId
    },
    body: JSON.stringify({
      query: 'What are the company policies and procedures?',
      limit: 5,
      threshold: 0.3
    })
  });
  const semanticData = await semanticRes.json();
  console.log('Semantic search response:', JSON.stringify(semanticData, null, 2));

  // Test 3: Hybrid search (combines full-text and semantic)
  console.log('\n=== Hybrid Search ===');
  const hybridRes = await fetch('http://localhost:4000/api/v1/search/hybrid', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Organization-ID': orgId
    },
    body: JSON.stringify({
      query: 'invoice billing payment',
      limit: 5,
      semanticWeight: 0.5
    })
  });
  const hybridData = await hybridRes.json();
  console.log('Hybrid search response:', JSON.stringify(hybridData, null, 2));
}

run().catch(console.error);
