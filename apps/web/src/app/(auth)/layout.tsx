import { FileText } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-2 text-primary-foreground">
          <FileText className="h-8 w-8" />
          <span className="text-xl font-bold">DMS</span>
        </div>
        <div className="space-y-4 text-primary-foreground">
          <blockquote className="text-2xl font-medium leading-relaxed">
            &ldquo;The Document Management System has transformed how we organize and
            process our documents. The AI-powered features save us hours every week.&rdquo;
          </blockquote>
          <div>
            <p className="font-semibold">Sarah Johnson</p>
            <p className="text-primary-foreground/80">VP of Operations, TechCorp</p>
          </div>
        </div>
        <div className="text-sm text-primary-foreground/60">
          Secure, AI-powered document management for modern teams.
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex w-full flex-col justify-center lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
