export interface Project {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  githubUrl: string;
  writeup: string[];
}

export const sideProjects: Project[] = [
  {
    slug: "socrata-chat",
    title: "Socrata Chat",
    description:
      "A conversational interface for querying government open data through Socrata APIs. Natural language meets public datasets.",
    tags: ["TypeScript", "AI", "Gov Data"],
    githubUrl: "https://github.com/stevie2codes/socrata-chat",

    writeup: [
      "Government open data is incredibly powerful — but it's also notoriously hard to access for anyone who doesn't speak SoQL or know their way around API endpoints. Socrata Chat is an experiment in bridging that gap: a conversational interface that lets you ask plain-English questions about public datasets and get structured answers back.",
      "I built this as a side project to explore how AI could make government data more approachable, which directly connects to the work I do at Tyler Technologies. The tool takes a user's natural language query, translates it into a Socrata API call, and returns formatted results — turning what would normally require technical knowledge into a simple conversation.",
      "The project uses TypeScript throughout, with an AI layer handling the natural language processing and query translation. It's a proof of concept for a broader idea: that the future of data access isn't better dashboards — it's removing the dashboard entirely and letting people just ask questions.",
    ],
  },
  {
    slug: "gov-data-generator",
    title: "Gov Data Generator",
    description:
      "A tool for generating realistic government data sets for testing and prototyping reporting interfaces.",
    tags: ["TypeScript", "Data", "Tooling"],
    githubUrl: "https://github.com/stevie2codes/gov-data-generator",

    writeup: [
      "When you're designing reporting tools for government agencies, you need realistic data to prototype against — but real government data comes with privacy constraints and bureaucratic access hurdles. Gov Data Generator solves this by creating synthetic datasets that mirror the structure, relationships, and quirks of actual public sector data.",
      "I built this out of necessity. At Tyler Technologies, I was constantly needing representative datasets to test new reporting interface designs, but getting access to production data for prototyping was slow and complicated. This tool generates everything from budget line items to permit records, with configurable parameters for volume, complexity, and data quality.",
      "It's become an essential part of my design workflow — I can spin up a realistic dataset in seconds and immediately start prototyping against it, without waiting for data access approvals or sanitization processes.",
    ],
  },
  {
    slug: "gov-report-ai",
    title: "Gov Report AI",
    description:
      "An AI-powered government reporting tool exploring how machine learning can streamline public sector report generation.",
    tags: ["Python", "AI/ML", "Reporting"],
    githubUrl: "https://github.com/stevie2codes/gov-report-ai",

    writeup: [
      "Government agencies spend enormous amounts of time generating reports — compliance reports, budget summaries, performance dashboards. Most of this work is repetitive and follows predictable patterns, which makes it a perfect candidate for AI assistance. Gov Report AI explores what that future could look like.",
      "This Python-based project uses machine learning to analyze data patterns and automatically generate narrative report sections, chart recommendations, and data summaries. It's not about replacing analysts — it's about handling the tedious parts so they can focus on the insights that actually matter.",
      "Building this in Python let me explore the ML/AI side of reporting more deeply than I could in my day-to-day design work. The insights from this project have directly influenced how I think about the AI-centric redesign of our reporting platform at Tyler Technologies.",
    ],
  },
  {
    slug: "prmpt-art",
    title: "Prmpt Art",
    description:
      "A prompt library for maximizing the effectiveness of prompts into AI agents. Building better conversations with machines.",
    tags: ["TypeScript", "AI Agents", "Prompt Engineering"],
    githubUrl: "https://github.com/stevie2codes/prmptart",

    writeup: [
      "The quality of AI output is directly tied to the quality of the input — and yet most people treat prompt engineering as an afterthought. Prmpt Art is a curated library of prompt patterns, templates, and strategies for getting better results from AI agents and language models.",
      "I started this project because I was spending a lot of time crafting and refining prompts for various AI tools in my workflow, and I realized the patterns I was discovering could be useful to others. The library organizes prompts by use case — from code generation to data analysis to creative writing — with explanations of why each pattern works.",
      "It's also a personal reference I use constantly. As someone who works at the intersection of design and AI, having a well-organized prompt toolkit has become as essential as having a component library.",
    ],
  },
  {
    slug: "mcp-app",
    title: "MCP App",
    description:
      "Exploring the Model Context Protocol — building applications that integrate with AI tool ecosystems.",
    tags: ["TypeScript", "MCP", "AI Tools"],
    githubUrl: "https://github.com/stevie2codes/mcp-app",

    writeup: [
      "The Model Context Protocol (MCP) is emerging as a standard for how AI tools communicate and share context. MCP App is my exploration of this ecosystem — building applications that can plug into the MCP infrastructure and interact with AI tools in a structured, interoperable way.",
      "This project started as a learning exercise but quickly became a playground for experimenting with how AI tool integrations could work in practice. It explores questions like: How should context be shared between tools? What does a good tool interface look like? How can we make AI integrations feel seamless rather than bolted-on?",
      "The insights from building with MCP have been valuable for thinking about tool design more broadly — especially as AI integrations become a bigger part of the products I design at Tyler Technologies.",
    ],
  },
];
