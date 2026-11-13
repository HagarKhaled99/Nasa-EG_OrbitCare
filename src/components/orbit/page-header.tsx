/** Page title block shared by the inner pages (from the original ORBIT TWIN project, Member 4's branch). */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-balance md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground md:text-base">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
