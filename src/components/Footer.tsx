import { ArrowUp, Github, Linkedin } from "lucide-react";
import MagneticButton from "./MagneticButton";

const socials = [
  { icon: Github, label: "GitHub", href: "https://github.com/stevie2codes" },
  { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/js-webb/" },
];

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="px-6 md:px-12 py-14 border-t border-line">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Logo + copyright */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Stephen Webb" className="h-6" />
          <span className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Stephen Webb
          </span>
        </div>

        {/* Center: Social icons */}
        <div className="flex items-center gap-4">
          {socials.map((social) => (
            <MagneticButton key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="w-10 h-10 rounded-full border border-dark/10 flex items-center justify-center text-muted hover:text-dark hover:border-dark/30 transition-all"
              >
                <social.icon className="w-4 h-4" />
              </a>
            </MagneticButton>
          ))}
        </div>

        {/* Right: Back to top */}
        <MagneticButton>
          <button
            onClick={scrollToTop}
            aria-label="Scroll back to top"
            className="group inline-flex items-center gap-2 text-xs text-muted hover:text-dark transition-colors"
          >
            Back to top
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </MagneticButton>
      </div>
    </footer>
  );
}
