/**
 * Side projects (SPEC §5 C3, §6 detail, Appendix A). Descriptions, tags,
 * URLs and writeups are verbatim; do not edit wording here.
 */
import { StateId } from '../field/states/ids';

export interface Screenshot {
  readonly src: string;
  /** Intrinsic size, measured from the file (set as width/height attributes). */
  readonly width: number;
  readonly height: number;
}

export type ProjectIndex = 1 | 2 | 3 | 4;

export interface Project {
  readonly slug: string;
  /** 1-based order in the Side projects chapter. */
  readonly index: ProjectIndex;
  /** "P/01" … "P/04". */
  readonly indexLabel: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly githubUrl: string;
  readonly liveUrl?: string;
  /** MCP App has none: it shows "Screenshot coming soon". */
  readonly screenshot?: Screenshot;
  /** The field silhouette for this project (S4–S7). */
  readonly emblem: StateId;
  /**
   * Desktop side of the screenshot card and silhouette (§5 C3). The text
   * column takes the other side: 4–38vw when the card is right, 62–96vw
   * when it is left.
   */
  readonly side: 'right' | 'left';
  /** Three paragraphs, verbatim. */
  readonly writeup: readonly [string, string, string];
}

export const projects: readonly Project[] = [
  {
    slug: "pulse",
    index: 1,
    indexLabel: "P/01",
    title: "Pulse",
    description:
      "A conversational interface for querying government open data through Socrata APIs. Your city's open data, one question away.",
    tags: ["TypeScript", "AI", "Gov Data"],
    githubUrl: "https://github.com/stevie2codes/socrata-chat",
    liveUrl: "https://pulse-data.netlify.app/",
    screenshot: { src: "/screenshots/pulse.jpg", width: 1200, height: 953 },
    emblem: StateId.PULSE,
    side: "right",
    writeup: [
      "Government open data is incredibly powerful — but it's also notoriously hard to access for anyone who doesn't speak SoQL or know their way around API endpoints. Pulse is an experiment in bridging that gap: a conversational interface that lets you ask plain-English questions about public datasets and get structured answers back.",
      "I built this as a side project to explore how AI could make government data more approachable, which directly connects to the work I do at Tyler Technologies. The tool takes a user's natural language query, translates it into a Socrata API call, and returns formatted results — turning what would normally require technical knowledge into a simple conversation.",
      "The project uses TypeScript throughout, with an AI layer handling the natural language processing and query translation. It's a proof of concept for a broader idea: that the future of data access isn't better dashboards — it's removing the dashboard entirely and letting people just ask questions.",
    ],
  },
  {
    slug: "gov-data-generator",
    index: 2,
    indexLabel: "P/02",
    title: "Gov Data Generator",
    description:
      "A tool for generating realistic government data sets for testing and prototyping reporting interfaces.",
    tags: ["TypeScript", "Data", "Tooling"],
    githubUrl: "https://github.com/stevie2codes/gov-data-generator",
    liveUrl: "https://stevie2codes.github.io/gov-data-generator/",
    screenshot: { src: "/screenshots/gov-data-generator.png", width: 1200, height: 953 },
    emblem: StateId.LATTICE,
    side: "left",
    writeup: [
      "When you're designing reporting tools for government agencies, you need realistic data to prototype against — but real government data comes with privacy constraints and bureaucratic access hurdles. Gov Data Generator solves this by creating synthetic datasets that mirror the structure, relationships, and quirks of actual public sector data.",
      "I built this out of necessity. At Tyler Technologies, I was constantly needing representative datasets to test new reporting interface designs, but getting access to production data for prototyping was slow and complicated. This tool generates everything from budget line items to permit records, with configurable parameters for volume, complexity, and data quality.",
      "It's become an essential part of my design workflow — I can spin up a realistic dataset in seconds and immediately start prototyping against it, without waiting for data access approvals or sanitization processes.",
    ],
  },
  {
    slug: "prmpt-art",
    index: 3,
    indexLabel: "P/03",
    title: "Prmpt Art",
    description:
      "A prompt library for maximizing the effectiveness of prompts into AI agents. Building better conversations with machines.",
    tags: ["TypeScript", "AI Agents", "Prompt Engineering"],
    githubUrl: "https://github.com/stevie2codes/prmptart",
    liveUrl: "https://prmptart.com/",
    screenshot: { src: "/screenshots/prmpt-art.jpg", width: 1200, height: 953 },
    emblem: StateId.DECK,
    side: "right",
    writeup: [
      "The quality of AI output is directly tied to the quality of the input — and yet most people treat prompt engineering as an afterthought. Prmpt Art is a curated library of prompt patterns, templates, and strategies for getting better results from AI agents and language models.",
      "I started this project because I was spending a lot of time crafting and refining prompts for various AI tools in my workflow, and I realized the patterns I was discovering could be useful to others. The library organizes prompts by use case — from code generation to data analysis to creative writing — with explanations of why each pattern works.",
      "It's also a personal reference I use constantly. As someone who works at the intersection of design and AI, having a well-organized prompt toolkit has become as essential as having a component library.",
    ],
  },
  {
    slug: "mcp-app",
    index: 4,
    indexLabel: "P/04",
    title: "MCP App",
    description:
      "Exploring the Model Context Protocol — building applications that integrate with AI tool ecosystems.",
    tags: ["TypeScript", "MCP", "AI Tools"],
    githubUrl: "https://github.com/stevie2codes/mcp-app",
    emblem: StateId.CONSTELLATION,
    side: "left",
    writeup: [
      "The Model Context Protocol (MCP) is emerging as a standard for how AI tools communicate and share context. MCP App is my exploration of this ecosystem — building applications that can plug into the MCP infrastructure and interact with AI tools in a structured, interoperable way.",
      "This project started as a learning exercise but quickly became a playground for experimenting with how AI tool integrations could work in practice. It explores questions like: How should context be shared between tools? What does a good tool interface look like? How can we make AI integrations feel seamless rather than bolted-on?",
      "The insights from building with MCP have been valuable for thinking about tool design more broadly — especially as AI integrations become a bigger part of the products I design at Tyler Technologies.",
    ],
  },
];

export const PROJECT_COUNT = projects.length;

export function getProject(slug: string | undefined): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/** The project after `slug`, wrapping to the first ("Next project" on detail pages). */
export function getNextProject(slug: string): Project {
  const i = projects.findIndex((p) => p.slug === slug);
  return projects[(i + 1) % projects.length];
}
