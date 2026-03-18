import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight,
  Lock,
  Mail,
} from "lucide-react";
import { gsap } from "../lib/gsap-init";
import { useSplitText } from "../lib/useSplitText";
import GSAPReveal from "../components/GSAPReveal";
import GSAPTextReveal from "../components/GSAPTextReveal";
import MagneticButton from "../components/MagneticButton";
import ScrollScrubText from "../components/ScrollScrubText";
import StatsCounter from "../components/StatsCounter";
import SectionLabel from "../components/SectionLabel";
import TiltCard from "../components/TiltCard";
import AnimatedCapIcon from "../components/AnimatedCapIcon";
import { sideProjects } from "../data/projects";
import HeroBackground from "../components/hero-bg/HeroBackground";

import { useMousePosition } from "../components/hero-bg/useMousePosition";
import { useReducedMotion } from "../lib/useReducedMotion";

const capabilities = [
  {
    iconName: "layers" as const,
    title: "Product Design",
    description:
      "From discovery to delivery. I design end-to-end product experiences rooted in user research, business strategy, and systems thinking.",
  },
  {
    iconName: "barChart" as const,
    title: "Data Visualization",
    description:
      "Turning dense datasets into legible, actionable interfaces. Charts, dashboards, and exploratory tools that respect the complexity of real data.",
  },
  {
    iconName: "compass" as const,
    title: "Design Systems",
    description:
      "Building scalable component libraries and design tokens that keep teams aligned and products consistent across dozens of surfaces.",
  },
  {
    iconName: "penTool" as const,
    title: "Prototyping",
    description:
      "High-fidelity interactive prototypes that communicate intent precisely. I prototype to think, test, and sell ideas—not just to document them.",
  },
];

const stats = [
  { value: "4+", label: "Years in Product Design", subtitle: "Discovery to delivery" },
  { value: "2", label: "Years as a Developer", subtitle: "I speak your engineers' language" },
  { value: "6+", label: "Years in Tech", subtitle: "SaaS, gov-tech, AI" },
  { value: "1", label: "AI Reporting Platform", subtitle: "End-to-end redesign" },
];

function CapabilityCard({
  cap,
  index,
}: {
  cap: (typeof capabilities)[number];
  index: number;
}) {
  const [inView, setInView] = useState(false);
  return (
    <GSAPReveal delay={0.1 + index * 0.1} onEnter={() => setInView(true)}>
      <div className="bg-cream p-12 md:p-16 lg:p-20 group hover:bg-orange/[0.03] transition-colors duration-500 h-full">
        <AnimatedCapIcon
          name={cap.iconName}
          isInView={inView}
          className="mb-10"
        />
        <h3 className="font-display text-xl md:text-2xl text-dark mb-5">
          {cap.title}
        </h3>
        <p className="text-muted leading-relaxed text-[15px]">
          {cap.description}
        </p>
      </div>
    </GSAPReveal>
  );
}

function ScreenshotImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <div className="md:w-[40%] mb-6 md:mb-0 rounded-xl overflow-hidden aspect-[16/10] flex-shrink-0">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
      />
    </div>
  );
}

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const stephenRef = useRef<HTMLSpanElement>(null);
  const webbRef = useRef<HTMLSpanElement>(null);
  const underlineRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);


  const { smoothMouseX, smoothMouseY } = useMousePosition();
  const reduced = useReducedMotion();

  const { split: splitStephen } = useSplitText(stephenRef, { type: "chars" });
  const { split: splitWebb } = useSplitText(webbRef, { type: "chars" });
  const { split: splitTagline } = useSplitText(taglineRef, { type: "words" });

  // ═══ HERO ENTRANCE TIMELINE ═══
  useGSAP(
    () => {
      if (reduced) return;
      const stephenResult = splitStephen();
      const webbResult = splitWebb();
      const taglineResult = splitTagline();

      if (!stephenResult || !webbResult || !taglineResult) return;

      const isMobile = window.innerWidth < 768;
      const charStagger = isMobile ? 0.02 : 0.03;

      const tl = gsap.timeline({ delay: 0.3 });

      // 1. Label fade in
      tl.from(labelRef.current, {
        opacity: 0,
        x: -20,
        duration: 0.6,
        ease: "power2.out",
      });

      // 2. "Stephen" character reveal
      tl.from(
        stephenResult.chars,
        {
          y: "100%",
          opacity: 0,
          duration: 0.5,
          stagger: charStagger,
          ease: "power3.out",
        },
        "-=0.2"
      );

      // 3. "Webb" character reveal
      tl.from(
        webbResult.chars,
        {
          y: "100%",
          opacity: 0,
          duration: 0.5,
          stagger: charStagger,
          ease: "power3.out",
        },
        "-=0.15"
      );

      // 4. Underline scale
      tl.from(underlineRef.current, {
        scaleX: 0,
        duration: 0.8,
        ease: "power2.inOut",
      });

      // 5. Tagline words stagger
      tl.from(
        taglineResult.words,
        {
          y: 12,
          opacity: 0,
          duration: 0.4,
          stagger: 0.04,
          ease: "power2.out",
        },
        "-=0.4"
      );

      // 6. CTA buttons
      tl.from(
        ctaRef.current,
        {
          y: 16,
          opacity: 0,
          duration: 0.5,
          ease: "power3.out",
        },
        "-=0.2"
      );

      // 7. Scroll indicator
      if (scrollIndicatorRef.current) {
        tl.from(scrollIndicatorRef.current, {
          opacity: 0,
          duration: 0.6,
        });
      }
    },
    { scope: heroRef, dependencies: [reduced] }
  );

  // ═══ HERO SCROLL-AWAY PARALLAX ═══
  useGSAP(
    () => {
      if (!heroContentRef.current || !heroRef.current || reduced) return;

      gsap.to(heroContentRef.current, {
        yPercent: -30,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    },
    { scope: heroRef, dependencies: [reduced] }
  );


  return (
    <>
      {/* ═══ HERO ═══ */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        <HeroBackground heroRef={heroRef} smoothMouseX={smoothMouseX} smoothMouseY={smoothMouseY} />

        {/* Hero content — centered */}
        <div
          ref={heroContentRef}
          className="relative z-[2] flex items-center min-h-screen px-6 md:px-12 pt-20 pb-16 md:pt-0 md:pb-0 pointer-events-none"
        >
          <div className="max-w-6xl mx-auto w-full">
            <p
              ref={labelRef}
              className="text-xs font-medium tracking-[0.25em] uppercase text-orange mb-5 md:mb-6"
            >
              Senior Product Designer
            </p>

            <h1 className="font-display text-dark tracking-tight">
              <span
                ref={stephenRef}
                className="block text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] leading-[0.9] overflow-hidden"
              >
                Stephen
              </span>
              <span
                ref={webbRef}
                className="block text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] xl:text-[8rem] leading-[0.9] overflow-hidden"
              >
                Webb
              </span>
            </h1>

            {/* Animated underline */}
            <div
              ref={underlineRef}
              className="h-[2px] bg-gradient-to-r from-orange to-orange/30 mt-3 origin-left"
            />

            {/* Staggered tagline */}
            <div className="mt-8 md:mt-10">
              <p
                ref={taglineRef}
                className="text-lg text-muted leading-relaxed max-w-sm"
              >
                Product designer at Tyler Technologies.
                <br />
                I make complex data feel obvious.
              </p>

              {/* CTAs */}
              <div
                ref={ctaRef}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 pointer-events-auto"
              >
                <MagneticButton>
                  <a
                    href="#work"
                    className="group inline-flex items-center px-7 py-3 rounded-lg bg-dark text-cream text-sm font-medium hover:bg-dark-soft hover:-translate-y-0.5 hover:shadow-lg hover:shadow-dark/10 transition-all duration-300"
                  >
                    View Work
                    <ArrowUpRight className="inline-block ml-1.5 w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                </MagneticButton>
                <MagneticButton>
                  <a
                    href="#contact"
                    className="inline-flex items-center px-7 py-3 rounded-lg border border-dark/15 text-dark text-sm font-medium hover:border-dark/40 hover:-translate-y-0.5 transition-all duration-300"
                  >
                    Get in Touch
                  </a>
                </MagneticButton>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator — hidden on mobile */}
        <div
          ref={scrollIndicatorRef}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 z-[2]"
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
        </div>
      </section>

      {/* ═══ ABOUT ═══ */}
      <section id="about" className="py-24 md:py-32 lg:py-40 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <GSAPReveal>
            <SectionLabel>About</SectionLabel>
          </GSAPReveal>

          <div className="grid md:grid-cols-12 gap-16 md:gap-20">
            <div className="md:col-span-6">
              <ScrollScrubText className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
                I design products where{" "}
                <span className="text-orange">data meets decisions</span>
              </ScrollScrubText>
            </div>

            <GSAPReveal className="md:col-span-6 md:pt-2" delay={0.2}>
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
              </div>
            </GSAPReveal>
          </div>

          {/* Stats row */}
          <StatsCounter stats={stats} className="mt-32 lg:mt-40" />
        </div>
      </section>

      {/* ═══ WORK ═══ */}
      <section id="work" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 bg-cream-dark">
        <div className="max-w-6xl mx-auto">
          <GSAPReveal>
            <SectionLabel>Selected Work</SectionLabel>
          </GSAPReveal>

          {/* Under NDA */}
          <GSAPReveal>
            <div className="rounded-2xl bg-cream-dark p-10 md:p-14 lg:p-16 mb-16 lg:mb-20 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-orange" strokeWidth={1.5} />
                <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange">
                  Under NDA
                </p>
              </div>
              <h3 className="font-display text-2xl md:text-3xl text-dark mb-4">
                Tyler Technologies Case Studies
              </h3>
              <p className="text-muted leading-relaxed max-w-lg mx-auto">
                Detailed case studies from my work at Tyler Technologies.
                Available upon request.
              </p>
            </div>
          </GSAPReveal>

          {/* Side projects */}
          <GSAPReveal delay={0.1}>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange mb-10">
              Side Projects
            </p>
          </GSAPReveal>

          <div className="space-y-10 lg:space-y-12">
            {sideProjects.map((project, i) => (
              <GSAPReveal key={project.slug} delay={0.12 + i * 0.08}>
                <TiltCard>
                  <Link
                    to={`/work/${project.slug}`}
                    className={`group block rounded-2xl p-10 md:p-14 lg:p-16 ${
                      i % 2 === 0 ? "bg-orange/5" : "bg-dark/[0.03]"
                    } hover:bg-orange/[0.07] transition-all duration-500 cursor-pointer`}
                  >
                    <div className={`${project.screenshot ? "md:flex md:gap-10 lg:gap-14" : ""}`}>
                      {project.screenshot && (
                        <ScreenshotImage
                          src={project.screenshot}
                          alt={`${project.title} screenshot`}
                        />
                      )}
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
                    </div>
                  </Link>
                </TiltCard>
              </GSAPReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CAPABILITIES ═══ */}
      <section id="capabilities" className="py-24 md:py-32 lg:py-40 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <GSAPReveal>
            <SectionLabel>What I Do</SectionLabel>
          </GSAPReveal>

          <GSAPTextReveal
            className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.1] mb-24 lg:mb-32 tracking-tight max-w-3xl"
            staggerSpeed={0.015}
          >
            Thoughtful craft across the{" "}
            <span className="text-orange">full product surface</span>
          </GSAPTextReveal>

          <div className="grid md:grid-cols-2 gap-px bg-line rounded-2xl overflow-hidden">
            {capabilities.map((cap, i) => (
              <CapabilityCard key={cap.title} cap={cap} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" className="py-24 md:py-32 lg:py-40 px-6 md:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <GSAPReveal>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-orange mb-10">
              Get in Touch
            </p>
          </GSAPReveal>

          <GSAPTextReveal
            className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-10 tracking-tight"
            staggerSpeed={0.015}
          >
            Let's build something
            <br />
            <span className="text-orange">worth using</span>
          </GSAPTextReveal>

          <GSAPReveal delay={0.2}>
            <p className="text-muted max-w-md mx-auto mb-14 leading-relaxed">
              Always interested in connecting with fellow designers, engineers,
              and product thinkers. Let's talk shop.
            </p>
          </GSAPReveal>

          <GSAPReveal delay={0.3}>
            <MagneticButton>
              <a
                href="mailto:stephen@designthewebb.com"
                className="group inline-flex items-center gap-2 px-10 py-4 rounded-lg bg-dark text-cream font-medium hover:bg-dark-soft hover:-translate-y-0.5 hover:shadow-lg hover:shadow-dark/10 transition-all duration-300"
              >
                <Mail className="w-4 h-4" />
                stephen@designthewebb.com
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </MagneticButton>
          </GSAPReveal>

        </div>
      </section>
    </>
  );
}
