import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Github, ImageIcon } from "lucide-react";
import Reveal from "../components/Reveal";
import SectionLabel from "../components/SectionLabel";
import { sideProjects } from "../data/projects";

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const projectIndex = sideProjects.findIndex((p) => p.slug === slug);
  const project = sideProjects[projectIndex];
  const nextProject = sideProjects[(projectIndex + 1) % sideProjects.length];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-4xl md:text-5xl text-dark mb-4">
          Project not found
        </h1>
        <p className="text-muted mb-8">
          The project you're looking for doesn't exist.
        </p>
        <Link
          to="/#work"
          className="px-7 py-3 rounded-full bg-dark text-cream text-sm font-medium hover:bg-dark-soft transition-colors"
        >
          Back to Work
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ═══ HEADER ═══ */}
      <section className="pt-32 md:pt-40 pb-20 md:pb-28 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <Link
              to="/#work"
              className="group inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-dark transition-colors mb-16"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Work
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="flex flex-wrap gap-2 mb-8">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-medium text-orange border border-orange/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-dark leading-[0.95] tracking-tight mb-6">
              {project.title}
            </h1>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="text-lg md:text-xl text-muted leading-relaxed max-w-2xl mb-10">
              {project.description}
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-full border border-dark/15 text-dark text-sm font-medium hover:border-dark/40 transition-colors"
            >
              <Github className="w-4 h-4" />
              View on GitHub
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ═══ SCREENSHOT ═══ */}
      <section className="px-6 md:px-12 pb-20 md:pb-28">
        <Reveal>
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl border border-dashed border-dark/10 bg-cream-dark aspect-video flex flex-col items-center justify-center gap-4">
              <ImageIcon className="w-10 h-10 text-muted/40" strokeWidth={1} />
              <p className="text-sm text-muted/60">Screenshot coming soon</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ WRITEUP ═══ */}
      <section className="px-6 md:px-12 pb-32 md:pb-40">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <SectionLabel className="mb-12">About This Project</SectionLabel>
          </Reveal>

          <div className="space-y-8">
            {project.writeup.map((paragraph, i) => (
              <Reveal key={i} delay={0.05 + i * 0.06}>
                <p className="text-muted leading-[1.9] text-[16px]">
                  {paragraph}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ NEXT PROJECT ═══ */}
      {nextProject && (
        <section className="border-t border-line">
          <Link
            to={`/work/${nextProject.slug}`}
            className="group block px-6 md:px-12 py-20 md:py-28 hover:bg-cream-dark transition-colors duration-500"
          >
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted mb-4">
                  Next Project
                </p>
                <h3 className="font-display text-3xl md:text-4xl text-dark">
                  {nextProject.title}
                </h3>
              </div>
              <ArrowUpRight className="w-8 h-8 text-orange opacity-50 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
          </Link>
        </section>
      )}
    </motion.div>
  );
}
