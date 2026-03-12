export default function Footer() {
  return (
    <footer className="px-6 md:px-12 py-10 border-t border-line">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-xs text-muted">
          &copy; {new Date().getFullYear()} Stephen Webb. Designed with care.
        </span>
        <span className="text-xs text-muted/50">
          Built with React + Tailwind
        </span>
      </div>
    </footer>
  );
}
