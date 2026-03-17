import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export default function NotFoundPage() {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 md:px-12">
      <div className="text-center">
        <p className="text-xs font-medium tracking-[0.25em] uppercase text-orange mb-6">
          404
        </p>
        <h1 className="font-display text-5xl md:text-7xl text-dark tracking-tight mb-6">
          Page not found
        </h1>
        <p className="text-muted max-w-md mx-auto mb-10 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="group inline-flex items-center px-7 py-3 rounded-lg bg-dark text-cream text-sm font-medium hover:bg-dark-soft hover:-translate-y-0.5 hover:shadow-lg hover:shadow-dark/10 transition-all duration-300"
        >
          Back to Home
          <ArrowUpRight className="inline-block ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
