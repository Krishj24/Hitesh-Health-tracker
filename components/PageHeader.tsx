import Link from "next/link";

export default function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-5">
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500
                     hover:text-slate-800 dark:hover:text-slate-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
