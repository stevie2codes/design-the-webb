import { useRef, useState } from "react";
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
import Reveal from "../components/Reveal";
import ScrambleText from "../components/ScrambleText";
import SectionLabel from "../components/SectionLabel";
import { sideProjects } from "../data/projects";
import HeroIllustration from "../components/HeroIllustration";

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
  const [scrambleDone, setScrambleDone] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const taglineWords = ["Product", "designer", "at", "Tyler", "Technologies."];
  const taglineWords2 = ["I", "make", "complex", "data", "feel", "obvious."];

  return (
    <>
      {/* ═══ HERO ═══ */}
      <section
        ref={heroRef}
        className="relative min-h-screen overflow-hidden"
        onMouseMove={(e) => {
          const rect = heroRef.current?.getBoundingClientRect();
          if (rect) {
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
        }}
      >
        {/* Mouse-reactive radial glow */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(217,119,87,0.15), transparent 60%)`,
          }}
        />

        {/* Split layout content */}
        <div className="flex items-center min-h-screen px-6 md:px-12 pt-28 pb-12 md:pt-0 md:pb-0">
          <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-start md:items-center gap-10 lg:gap-20">
            {/* Left column — text */}
            <div className="flex-1 max-w-xl">
              <motion.p
                className="text-xs font-medium tracking-[0.25em] uppercase text-orange mb-5 md:mb-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Senior Product Designer
              </motion.p>

              <h1 className="font-display text-dark tracking-tight">
                <span className="block text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] leading-[0.9]">
                  <ScrambleText text="Stephen" delay={500} speed={120} />
                </span>
                <span className="block text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] leading-[0.9]">
                  <ScrambleText
                    text="Webb"
                    delay={900}
                    speed={140}
                    onComplete={() => setScrambleDone(true)}
                  />
                </span>
              </h1>

              {/* Animated underline */}
              <motion.div
                className="h-[2px] bg-gradient-to-r from-orange to-orange/30 mt-3 origin-left"
                initial={{ scaleX: 0 }}
                animate={scrambleDone ? { scaleX: 1 } : {}}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* Staggered tagline */}
              <div className="mt-8 md:mt-10">
                <p className="text-lg text-muted leading-relaxed max-w-sm">
                  {taglineWords.map((word, i) => (
                    <motion.span
                      key={`t1-${i}`}
                      className="inline-block mr-[0.3em]"
                      initial={{ opacity: 0, y: 12 }}
                      animate={scrambleDone ? { opacity: 1, y: 0 } : {}}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.06,
                        ease: "easeOut",
                      }}
                    >
                      {word}
                    </motion.span>
                  ))}
                  <br />
                  {taglineWords2.map((word, i) => (
                    <motion.span
                      key={`t2-${i}`}
                      className="inline-block mr-[0.3em]"
                      initial={{ opacity: 0, y: 12 }}
                      animate={scrambleDone ? { opacity: 1, y: 0 } : {}}
                      transition={{
                        duration: 0.4,
                        delay: taglineWords.length * 0.06 + i * 0.06,
                        ease: "easeOut",
                      }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </p>

                {/* CTAs — fade in after tagline */}
                <motion.div
                  className="flex gap-4 mt-8"
                  initial={{ opacity: 0, y: 16 }}
                  animate={scrambleDone ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.5,
                    delay:
                      (taglineWords.length + taglineWords2.length) * 0.06 + 0.1,
                    ease: "easeOut",
                  }}
                >
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
                </motion.div>
              </div>
            </div>

            {/* Right column — illustration */}
            <motion.div
              className="hidden md:flex flex-1 items-center justify-center"
              initial={{ opacity: 0, x: 40 }}
              animate={scrambleDone ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <motion.div
                className="w-full max-w-md lg:max-w-lg xl:max-w-xl"
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <HeroIllustration className="w-full h-auto" />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={scrambleDone ? { opacity: 1 } : {}}
          transition={{
            delay: (taglineWords.length + taglineWords2.length) * 0.06 + 0.4,
            duration: 0.6,
          }}
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
                <span className="text-orange">data meets decisions</span>
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
              <span className="text-orange">full product surface</span>
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
              <span className="text-orange">worth using</span>
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
