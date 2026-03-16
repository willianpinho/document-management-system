import Link from 'next/link';
import { Button } from '@dms/ui';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>

        <h1 className="mb-8 text-4xl font-bold tracking-tight">Privacy Policy</h1>

        <div className="prose prose-gray max-w-none dark:prose-invert">
          <p className="mb-8 text-lg text-muted-foreground">Last updated: January 2026</p>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">1. Introduction</h2>
            <p className="text-muted-foreground">
              Document Management System (&quot;DMS&quot;, &quot;we&quot;, &quot;our&quot;, or
              &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains
              how we collect, use, disclose, and safeguard your information when you use our
              document management service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">2. Information We Collect</h2>
            <h3 className="mb-3 text-xl font-medium">Personal Information</h3>
            <p className="mb-4 text-muted-foreground">
              We may collect personal information that you voluntarily provide when registering for
              an account, including:
            </p>
            <ul className="mb-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Name and email address</li>
              <li>Organization name and billing information</li>
              <li>Profile picture (optional)</li>
            </ul>

            <h3 className="mb-3 text-xl font-medium">Document Data</h3>
            <p className="text-muted-foreground">
              Documents you upload are stored securely and encrypted. We may process document
              content for features like OCR, search indexing, and AI-powered classification, but
              this processing is solely to provide our services to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">3. How We Use Your Information</h2>
            <p className="mb-4 text-muted-foreground">We use the information we collect to:</p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Provide, operate, and maintain our services</li>
              <li>Process document uploads, storage, and retrieval</li>
              <li>Enable document processing features (OCR, search, classification)</li>
              <li>Send administrative information, updates, and security alerts</li>
              <li>Respond to inquiries and offer support</li>
              <li>Improve our services based on usage patterns</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">4. Data Security</h2>
            <p className="mb-4 text-muted-foreground">
              We implement robust security measures to protect your data:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>All documents are encrypted at rest and in transit (AES-256, TLS 1.3)</li>
              <li>Access controls and audit logging for all operations</li>
              <li>Regular security assessments and penetration testing</li>
              <li>SOC 2 Type II compliance</li>
              <li>Multi-tenant isolation with row-level security</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">5. Data Sharing</h2>
            <p className="mb-4 text-muted-foreground">
              We do not sell, trade, or rent your personal information. We may share information
              only in the following situations:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Service Providers:</strong> With third-party vendors who assist in operating
                our service (e.g., AWS for hosting, Stripe for payments)
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a merger, acquisition, or
                sale of assets
              </li>
              <li>
                <strong>With Your Consent:</strong> When you explicitly authorize sharing
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">6. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your documents and personal information for as long as your account is
              active or as needed to provide services. Upon account deletion, we will delete your
              data within 30 days, except where retention is required for legal compliance or
              legitimate business purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">7. Your Rights</h2>
            <p className="mb-4 text-muted-foreground">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Access and download your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Export your documents in standard formats</li>
              <li>Opt out of marketing communications</li>
              <li>Object to processing of your data</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use essential cookies to maintain your session and preferences. We do not use
              third-party tracking cookies for advertising. You can control cookie settings through
              your browser preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new Privacy Policy on this page and updating the
              &quot;Last updated&quot; date. We encourage you to review this Privacy Policy
              periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy or our data practices, please contact
              us at privacy@dms.com.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t pt-8">
          <div className="flex gap-4">
            <Link href="/terms">
              <Button variant="outline">Terms of Service</Button>
            </Link>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
