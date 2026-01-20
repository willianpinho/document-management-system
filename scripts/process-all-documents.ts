/**
 * Script to process all documents that don't have embeddings
 *
 * Usage:
 *   pnpm tsx scripts/process-all-documents.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding documents without embeddings...\n');

  // Find all documents without embeddings (using raw query for vector field)
  const documents = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      mime_type: string;
      extracted_text: string | null;
      organization_id: string;
    }>
  >`
    SELECT id, name, mime_type, extracted_text, organization_id
    FROM documents
    WHERE status != 'DELETED'
      AND content_vector IS NULL
    ORDER BY created_at DESC
  `;

  console.log(`📄 Found ${documents.length} documents without embeddings:\n`);

  documents.forEach((doc, i) => {
    const hasText = doc.extracted_text ? '✅' : '❌';
    console.log(`  ${i + 1}. ${doc.name} (text: ${hasText})`);
  });

  if (documents.length === 0) {
    console.log('\n✨ All documents already have embeddings!');
    return;
  }

  console.log('\n📋 To process these documents:');
  console.log('   1. Open each document in the web app');
  console.log('   2. Click "Process" and select "Full Processing"');
  console.log('   3. Or use the API endpoint:\n');

  console.log('   curl -X POST http://localhost:4000/api/v1/documents/{id}/process \\');
  console.log('     -H "Authorization: Bearer {token}" \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"operations": ["FULL_PROCESSING"]}\'\n');

  console.log('📝 Document IDs to process:');
  documents.forEach((doc) => {
    console.log(`   - ${doc.id} (${doc.name})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
