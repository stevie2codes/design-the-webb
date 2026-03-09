export default function SectionLabel({
  children,
  className = "mb-20",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="text-xs font-medium tracking-[0.2em] uppercase text-orange">
        {children}
      </span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}
