import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Layers,
  BarChart3,
  Compass,
  PenTool,
  Mail,
  Github,
  Linkedin,
  Twitter,
} from "lucide-react";
import BlueprintGrid from "../components/BlueprintGrid";
import Reveal from "../components/Reveal";
import SectionLabel from "../components/SectionLabel";
import { sideProjects } from "../data/projects";

const capabilities = [
  {
    icon: Layers,
    title: "Product Design",
    description:
      "From discovery to delivery. I design end-to-end product experiences rooted in user research, business strategy, and systems thinking.",
  },
  {
    icon: BarChart3,
    title: "Data Visualization",
    description:
      "Turning dense datasets into legible, actionable interfaces. Charts, dashboards, and exploratory tools that respect the complexity of real data.",
  },
  {
    icon: Compass,
    title: "Design Systems",
    description:
      "Building scalable component libraries and design tokens that keep teams aligned and products consistent across dozens of surfaces.",
  },
  {
    icon: PenTool,
    title: "Prototyping",
    description:
      "High-fidelity interactive prototypes that communicate intent precisely. I prototype to think, test, and sell ideas—not just to document them.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Layer 1: p5.js animated background */}
        <BlueprintGrid className="absolute inset-0 w-full h-full" />

        {/* Layer 2: Content */}
        <div className="relative z-10 flex items-end md:items-center min-h-screen px-6 md:px-12 pb-32 md:pb-0">
          <div className="max-w-6xl mx-auto w-full flex items-center gap-12 lg:gap-16">
            <div className="max-w-xl">
              <motion.p
                className="text-xs font-medium tracking-[0.25em] uppercase text-orange mb-5 md:mb-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Senior Product Designer
              </motion.p>

              <h1 className="font-display text-dark tracking-tight">
                <motion.span
                  className="block text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] leading-[0.9]"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  Stephen
                </motion.span>
                <motion.span
                  className="block text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] leading-[0.9] italic text-orange"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  Webb
                </motion.span>
              </h1>

              <motion.div
                className="mt-8 md:mt-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.65 }}
              >
                <p className="text-lg text-muted leading-relaxed mb-8 max-w-sm">
                  Product designer at Tyler Technologies.
                  I make complex data feel obvious.
                </p>

                <div className="flex gap-4">
                  <a
                    href="#work"
                    className="group px-7 py-3 rounded-full bg-dark text-cream text-sm font-medium hover:bg-dark-soft transition-all"
                  >
                    View Work
                    <ArrowUpRight className="inline-block ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                  <a
                    href="#contact"
                    className="px-7 py-3 rounded-full border border-dark/15 text-dark text-sm font-medium hover:border-dark/40 transition-colors"
                  >
                    Get in Touch
                  </a>
                </div>
              </motion.div>
            </div>

            {/* Portrait frame — irregular glitch shape */}
            <motion.div
              className="hidden md:block flex-shrink-0"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="w-[280px] lg:w-[320px] xl:w-[360px] aspect-[3/4]"
                style={{
                  clipPath: `polygon(
                    2% 0%, 65% 0%, 65% 3%, 100% 3%, 100% 18%,
                    95% 18%, 95% 25%, 100% 25%, 100% 62%,
                    92% 62%, 92% 68%, 100% 68%, 100% 88%,
                    70% 88%, 70% 100%, 8% 100%, 8% 95%,
                    0% 95%, 0% 72%, 5% 72%, 5% 45%,
                    0% 45%, 0% 12%, 6% 12%, 6% 5%, 2% 5%
                  )`,
                }}
              >
                <img
                  src="/stephen-portrait.jpg"
                  alt="Stephen Webb"
                  className="w-full h-full object-cover object-top grayscale"
                  draggable={false}
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <span className="text-[10px] tracking-[0.15em] uppercase text-muted">
            Scroll
          </span>
          <motion.div
            className="w-px h-8 bg-dark/20"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "top" }}
          />
        </motion.div>
      </section>

      {/* ═══ ABOUT ═══ */}
      <section id="about" className="py-40 md:py-56 lg:py-64 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>About</SectionLabel>
          </Reveal>

          <div className="grid md:grid-cols-12 gap-16 md:gap-20">
            <Reveal className="md:col-span-6" delay={0.1}>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
                I design products where{" "}
                <span className="italic text-orange">data meets decisions</span>
              </h2>
            </Reveal>

            <Reveal className="md:col-span-6 md:pt-2" delay={0.2}>
              <div className="space-y-6 text-muted leading-[1.8]">
                <p>
                  I'm a Senior Product Designer at Tyler Technologies with a
                  background in front-end development. I spent two years writing
                  code before moving into design — which means I think in
                  systems, components, and real constraints.
                </p>
                <p>
                  Right now I'm leading the end-to-end redesign of our
                  reporting platform, re-envisioning it as an{" "}
                  <em className="text-dark font-normal not-italic">
                    AI-centric experience
                  </em>{" "}
                  — giving users specific, use-case-driven reporting tools
                  that actually meet their needs.
                </p>
                <p>
                  I believe the best data products don't simplify away
                  complexity. They make complexity{" "}
                  <em className="text-dark font-normal not-italic">
                    navigable
                  </em>
                  . Every chart, filter, and interaction should earn its place.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Stats row */}
          <Reveal delay={0.3}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-32 lg:mt-40 bg-line rounded-2xl overflow-hidden">
              {[
                { value: "4+", label: "Years in Product Design" },
                { value: "2", label: "Years as a Developer" },
                { value: "6+", label: "Years in Tech" },
                { value: "1", label: "AI Reporting Platform" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-cream p-10 md:p-14 text-center"
                >
                  <div className="font-display text-3xl md:text-4xl text-dark mb-3">
                    {stat.value}
                  </div>
                  <div className="text-xs tracking-wide text-muted uppercase">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ WORK ═══ */}
      <section id="work" className="py-40 md:py-56 lg:py-64 px-6 md:px-12 bg-cream-dark">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>Selected Work</SectionLabel>
          </Reveal>

          {/* Case studies coming soon */}
          <Reveal>
            <div className="rounded-2xl border border-dashed border-dark/15 p-10 md:p-14 lg:p-16 mb-16 lg:mb-20 text-center">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange mb-4">
                Coming Soon
              </p>
              <h3 className="font-display text-2xl md:text-3xl text-dark mb-4">
                Tyler Technologies Case Studies
              </h3>
              <p className="text-muted leading-relaxed max-w-lg mx-auto">
                Detailed case studies from my work leading the AI-centric
                redesign of enterprise reporting tools. Stay tuned.
              </p>
            </div>
          </Reveal>

          {/* Side projects */}
          <Reveal delay={0.1}>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange mb-10">
              Side Projects
            </p>
          </Reveal>

          <div className="space-y-10 lg:space-y-12">
            {sideProjects.map((project, i) => (
              <Reveal key={project.slug} delay={0.12 + i * 0.08}>
                <Link
                  to={`/work/${project.slug}`}
                  className={`group block rounded-2xl p-10 md:p-14 lg:p-16 ${i % 2 === 0 ? "bg-orange/5" : "bg-dark/[0.03]"} hover:bg-orange/[0.07] transition-all duration-500 cursor-pointer`}
                >
                  <div className="flex-1">
                    <h3 className="font-display text-2xl md:text-3xl text-dark mb-4 flex items-center gap-3">
                      {project.title}
                      <ArrowUpRight className="w-5 h-5 text-orange opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-muted leading-relaxed max-w-2xl mb-6">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full text-xs font-medium text-dark/50 border border-dark/10"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CAPABILITIES ═══ */}
      <section id="capabilities" className="py-40 md:py-56 lg:py-64 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>What I Do</SectionLabel>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.1] mb-24 lg:mb-32 tracking-tight max-w-3xl">
              Thoughtful craft across the{" "}
              <span className="italic text-orange">full product surface</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-px bg-line rounded-2xl overflow-hidden">
            {capabilities.map((cap, i) => (
              <Reveal key={cap.title} delay={i * 0.08}>
                <div className="bg-cream p-12 md:p-16 lg:p-20 group hover:bg-orange/[0.03] transition-colors duration-500 h-full">
                  <cap.icon
                    className="w-6 h-6 text-orange mb-10"
                    strokeWidth={1.5}
                  />
                  <h3 className="font-display text-xl md:text-2xl text-dark mb-5">
                    {cap.title}
                  </h3>
                  <p className="text-muted leading-relaxed text-[15px]">
                    {cap.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" className="py-40 md:py-56 lg:py-64 px-6 md:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange mb-10">
              Get in Touch
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-10 tracking-tight">
              Let's build something
              <br />
              <span className="italic text-orange">worth using</span>
            </h2>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-muted max-w-md mx-auto mb-14 leading-relaxed">
              Always interested in connecting with fellow designers, engineers,
              and product thinkers. Let's talk shop.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <a
              href="mailto:stephen@designthewebb.com"
              className="group inline-flex items-center gap-2 px-10 py-4 rounded-full bg-dark text-cream font-medium hover:bg-dark-soft transition-colors"
            >
              <Mail className="w-4 h-4" />
              stephen@designthewebb.com
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="flex items-center justify-center gap-6 mt-14">
              {[
                { icon: Github, label: "GitHub", href: "https://github.com/stevie2codes" },
                { icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/js-webb/" },
                { icon: Twitter, label: "Twitter", href: "#" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full border border-dark/10 flex items-center justify-center text-muted hover:text-dark hover:border-dark/30 transition-all"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
