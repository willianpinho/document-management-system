// Server Component — reads a build-time flag only, no interactivity needed,
// so it ships zero client JS. See middleware.ts + app/api/demo-login for the
// actual auto sign-in logic this banner is announcing.
const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function DemoModeBanner() {
  if (!DEMO_MODE_ENABLED) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950"
    >
      Live demo — you&apos;re automatically signed in as a showcase user. Data may be reset at any
      time.
    </div>
  );
}
