export function EmptyState({
  icon = "🗒️",
  title,
  description,
}: {
  icon?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-14 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="mt-3 font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
    </div>
  );
}
