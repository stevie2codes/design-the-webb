import { Fragment, useEffect } from 'react';
import About from '../chapters/About';
import Capabilities from '../chapters/Capabilities';
import Contact from '../chapters/Contact';
import Hero from '../chapters/Hero';
import Nda from '../chapters/Nda';
import Projects from '../chapters/Projects';
import { siteTitle } from '../content/site';
import { useLayoutMode } from '../motion/useLayoutMode';

/**
 * The home film (SPEC §1, §4): C0 Hero → C1 About → C2 NDA → C3 Side
 * projects → C4 What I do → C5 Contact. The footer (C6) lives in the App
 * shell. Chapters remount when the layout flips desktop ↔ mobile (§9.7).
 */
export default function HomePage() {
  const layout = useLayoutMode();

  useEffect(() => {
    document.title = siteTitle;
  }, []);

  return (
    <Fragment key={layout}>
      <Hero />
      <About />
      <Nda />
      <Projects />
      <Capabilities />
      <Contact />
    </Fragment>
  );
}
