import Link from 'next/link';
import { Button } from '@dms/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Document Management System
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Cloud-based document management with AI-powered processing. Upload, organize, and search
          your documents with intelligent OCR and classification.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link href="/login">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="lg">
              Create account
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
