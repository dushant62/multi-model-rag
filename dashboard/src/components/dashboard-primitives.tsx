export function SectionHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="space-y-1">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-[1.05rem] font-semibold text-[var(--text-primary)] tracking-tight">
        {title}
      </h2>
      <p className="text-[0.8rem] leading-5 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="surface-card rounded-xl p-4">
      <p className="eyebrow">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
        {value}
      </div>
      <p className="mt-1 text-[0.72rem] leading-5 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

