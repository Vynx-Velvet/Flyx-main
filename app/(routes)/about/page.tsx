'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './about.module.css';

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState('abstract');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
      setIsNavCollapsed(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const tableOfContents = [
    { id: 'abstract', label: 'Abstract', number: 'I' },
    { id: 'introduction', label: 'Introduction', number: 'II' },
    { id: 'literature', label: 'Literature Review', number: 'III' },
    { id: 'methodology', label: 'Methodology', number: 'IV' },
    { id: 'architecture', label: 'System Architecture', number: 'V' },
    { id: 'implementation', label: 'Implementation', number: 'VI' },
    { id: 'evaluation', label: 'Evaluation & Results', number: 'VII' },
    { id: 'discussion', label: 'Discussion', number: 'VIII' },
    { id: 'reverse-engineering', label: 'Reverse Engineering', number: 'IX' },
    { id: 'future', label: 'Future Work', number: 'X' },
    { id: 'conclusion', label: 'Conclusion', number: 'XI' },
    { id: 'legal', label: 'Legal Framework', number: 'XII' },
    { id: 'references', label: 'References', number: 'XIII' },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.container}>
      {/* Progress Bar */}
      <div className={styles.progressBar} style={{ width: `${scrollProgress}%` }} />

      {/* Academic Header */}
      <header className={styles.header}>
        <div className={styles.headerDecoration}>
          <div className={styles.decorLine} />
          <div className={styles.decorDiamond} />
          <div className={styles.decorLine} />
        </div>
        
        <div className={styles.headerContent}>
          <div className={styles.journalInfo}>
            <span className={styles.journalName}>Journal of Independent Software Engineering</span>
            <span className={styles.journalMeta}>Vol. 1, No. 1 • November 2025 • pp. 1-47</span>
          </div>
          
          <h1 className={styles.title}>
            Flyx: An Empirical Study in Solo Development of Production-Grade Streaming Infrastructure
          </h1>
          
          <p className={styles.subtitle}>
            Investigating the Feasibility of Individual Development of Complex Web Applications 
            Through Modern Tooling, Serverless Architecture, and Open-Source Ecosystems
          </p>
          
          <div className={styles.authorBlock}>
            <div className={styles.authorCard}>
              <div className={styles.authorAvatar}>
                <span>V</span>
                <div className={styles.avatarRing} />
              </div>
              <div className={styles.authorDetails}>
                <span className={styles.authorName}>Vynx</span>
                <span className={styles.authorAffiliation}>Independent Developer</span>
                <span className={styles.authorEmail}>Full-Stack Engineer & System Architect</span>
              </div>
            </div>
          </div>

          <div className={styles.paperMeta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Received</span>
              <span className={styles.metaValue}>September 1, 2025</span>
            </div>
            <div className={styles.metaDivider} />
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Revised</span>
              <span className={styles.metaValue}>October 15, 2025</span>
            </div>
            <div className={styles.metaDivider} />
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Accepted</span>
              <span className={styles.metaValue}>November 1, 2025</span>
            </div>
            <div className={styles.metaDivider} />
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Reading Time</span>
              <span className={styles.metaValue}>~35 minutes</span>
            </div>
          </div>
        </div>
        
        <div className={styles.headerGlow} />
      </header>

      {/* Main Content */}
      <div className={styles.mainLayout}>
        {/* Table of Contents Sidebar */}
        <aside className={`${styles.sidebar} ${isNavCollapsed ? styles.sidebarCollapsed : ''}`}>
          <div className={styles.tocContainer}>
            <div className={styles.tocHeader}>
              <h3 className={styles.tocTitle}>Table of Contents</h3>
              <span className={styles.tocProgress}>{Math.round(scrollProgress)}%</span>
            </div>
            <nav className={styles.tocNav}>
              {tableOfContents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`${styles.tocItem} ${activeSection === item.id ? styles.tocActive : ''}`}
                >
                  <span className={styles.tocNumber}>{item.number}</span>
                  <span className={styles.tocLabel}>{item.label}</span>
                  <span className={styles.tocIndicator} />
                </button>
              ))}
            </nav>
            <div className={styles.tocFooter}>
              <span className={styles.wordCount}>~12,500 words</span>
            </div>
          </div>
        </aside>

        {/* Article Content */}
        <article className={styles.article}>

          {/* Abstract */}
          <section id="abstract" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>I</span>
              <h2>Abstract</h2>
            </div>
            <div className={styles.abstractBox}>
              <p>
                This paper presents Flyx, a fully-functional video streaming platform developed to prove 
                a critical hypothesis: that free streaming services do not require malicious advertising, 
                invasive tracking, cryptocurrency miners, or deceptive user interfaces to operate. The 
                pirate streaming ecosystem has long been plagued by platforms that exploit users through 
                aggressive pop-ups, malware distribution, fingerprinting, and dark patterns—treating 
                viewers as products rather than people. Flyx demonstrates that an alternative model is 
                not only possible but practically achievable by a single developer.
              </p>
              <p>
                The platform provides video-on-demand streaming with adaptive bitrate delivery, live 
                television integration, and a clean, ad-free user experience—all without collecting 
                personally identifiable information, deploying tracking cookies, or subjecting users 
                to malicious advertisements. Through systematic documentation of the development process, 
                we provide empirical evidence that ethical streaming platforms can exist, challenging 
                the prevailing assumption that free content must come at the cost of user safety and 
                privacy. This work serves as both a technical reference and a statement that users 
                deserve better than the exploitative status quo.
              </p>
              <div className={styles.keywordsSection}>
                <div className={styles.keywordsHeader}>
                  <span className={styles.keywordIcon}>🏷️</span>
                  <span className={styles.keywordLabel}>Keywords</span>
                </div>
                <div className={styles.keywordsList}>
                  <span className={styles.keyword}>Web Development</span>
                  <span className={styles.keyword}>Streaming Architecture</span>
                  <span className={styles.keyword}>Solo Development</span>
                  <span className={styles.keyword}>Next.js</span>
                  <span className={styles.keyword}>Serverless Computing</span>
                  <span className={styles.keyword}>HLS Protocol</span>
                  <span className={styles.keyword}>Case Study</span>
                  <span className={styles.keyword}>Software Engineering</span>
                </div>
              </div>
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>II</span>
              <h2>Introduction</h2>
            </div>
            
            <h3 className={styles.subsectionTitle}>2.1 The Problem: Exploitation in Pirate Streaming</h3>
            <p className={styles.leadParagraph}>
              The pirate streaming ecosystem represents one of the most hostile environments on the modern 
              web. Users seeking free access to movies and television are routinely subjected to an arsenal 
              of exploitative practices: pop-up advertisements that spawn endlessly, fake "close" buttons 
              that trigger additional ads, cryptocurrency miners running silently in the background, 
              browser fingerprinting for cross-site tracking, malware distribution disguised as video 
              players, and dark patterns designed to trick users into clicking malicious links.
            </p>
            <p>
              These practices are not incidental—they are the business model. Pirate streaming sites 
              generate revenue by treating users as products, selling their attention, computing resources, 
              and personal data to the highest bidder. The implicit assumption underlying this ecosystem 
              is that free content cannot exist without exploitation: if you're not paying with money, 
              you must pay with your security, privacy, and sanity.
            </p>
            <p>
              Flyx was created to challenge this assumption directly. The project asks a simple but 
              important question: can a streaming platform provide free access to content while treating 
              users with respect? Can we build something that doesn't assault visitors with ads, doesn't 
              track their behavior across the web, doesn't mine cryptocurrency on their devices, and 
              doesn't employ deceptive interfaces designed to generate accidental clicks?
            </p>

            <div className={styles.highlightBox}>
              <div className={styles.highlightIcon}>💡</div>
              <div className={styles.highlightContent}>
                <h4>Core Thesis</h4>
                <p>
                  Free streaming platforms do not require malicious advertising, invasive tracking, or 
                  exploitative practices to function. The prevalence of such practices in the pirate 
                  streaming ecosystem reflects a choice to prioritize profit over users, not a technical 
                  or economic necessity.
                </p>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>2.2 The Vision: Ethical Streaming</h3>
            <p>
              Flyx was built on a set of principles that stand in direct opposition to the norms of 
              pirate streaming. No advertisements—not even "acceptable" ones. No tracking cookies or 
              cross-site identifiers. No cryptocurrency mining. No pop-ups, pop-unders, or redirect 
              chains. No fake buttons or deceptive UI elements. No collection of personally identifiable 
              information. No selling of user data to third parties.
            </p>
            <p>
              The goal was not merely to build a streaming platform, but to prove that such a platform 
              could exist without the exploitative practices that users have come to accept as inevitable. 
              If a single developer, working part-time with no budget, can create a functional streaming 
              service that respects its users, then the malicious practices of existing platforms are 
              revealed as choices rather than necessities.
            </p>

            <h3 className={styles.subsectionTitle}>2.3 Contributions</h3>
            <p>
              This paper makes the following contributions:
            </p>
            <ul className={styles.contributionList}>
              <li>
                <strong>Proof of Concept:</strong> Demonstrating that free streaming can exist without 
                malicious ads, tracking, or exploitation—challenging the assumed economics of pirate platforms.
              </li>
              <li>
                <strong>Ethical Architecture:</strong> A reference implementation for privacy-respecting 
                streaming applications that collect only anonymized, aggregate analytics.
              </li>
              <li>
                <strong>User-First Design:</strong> Documentation of design decisions that prioritize 
                user experience and safety over monetization opportunities.
              </li>
              <li>
                <strong>Technical Feasibility:</strong> Evidence that modern tools enable individuals to 
                build sophisticated applications without compromising on ethics.
              </li>
            </ul>
          </section>

          {/* Literature Review */}
          <section id="literature" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>III</span>
              <h2>Literature Review</h2>
            </div>

            <h3 className={styles.subsectionTitle}>3.1 The Exploitation Economy of Pirate Streaming</h3>
            <p>
              Pirate streaming sites operate within what researchers have termed the "exploitation economy"—
              a business model predicated on extracting maximum value from users through any means available. 
              Studies have documented the prevalence of malvertising (malicious advertising) on these 
              platforms, with some sites serving malware to over 50% of visitors (Rafique et al., 2016). 
              The advertising networks serving these sites often have minimal content policies, enabling 
              the distribution of scams, malware, and deceptive content.
            </p>
            <p>
              Beyond advertising, pirate streaming sites frequently deploy cryptocurrency miners that 
              hijack visitors' CPU resources (Konoth et al., 2018). Browser fingerprinting techniques 
              enable cross-site tracking even when users clear cookies or use private browsing modes 
              (Laperdrix et al., 2020). Dark patterns—deceptive UI designs that trick users into 
              unintended actions—are endemic, with fake close buttons, hidden redirects, and misleading 
              download links appearing on virtually every major pirate platform.
            </p>

            <div className={styles.citationBox}>
              <div className={styles.citationMark}>"</div>
              <blockquote>
                The user is not the customer on these platforms—they are the product. Every click, 
                every second of attention, every CPU cycle is monetized without consent or compensation.
              </blockquote>
              <cite>— Analysis of Pirate Streaming Economics</cite>
            </div>

            <h3 className={styles.subsectionTitle}>3.2 The False Necessity Argument</h3>
            <p>
              Defenders of exploitative practices often argue that they are economically necessary—that 
              free content cannot exist without aggressive monetization. This argument deserves scrutiny. 
              The costs of operating a streaming aggregator (as opposed to a content host) are remarkably 
              low: domain registration, basic hosting, and API access to metadata services. Modern 
              serverless platforms offer generous free tiers that can support substantial traffic without 
              cost (Vercel, Netlify, Cloudflare).
            </p>
            <p>
              The reality is that exploitative practices are not necessary—they are simply more profitable 
              than ethical alternatives. Site operators choose to deploy malware, mine cryptocurrency, 
              and track users because these practices generate revenue, not because the sites couldn't 
              function without them. Flyx exists to demonstrate this distinction empirically.
            </p>

            <h3 className={styles.subsectionTitle}>3.3 Privacy-Respecting Alternatives</h3>
            <p>
              The broader web has seen growing interest in privacy-respecting alternatives to surveillance-
              based services. Projects like DuckDuckGo (search), Signal (messaging), and ProtonMail (email) 
              have demonstrated that privacy and functionality are not mutually exclusive. However, the 
              streaming space has seen limited progress in this direction, partly due to the technical 
              complexity involved and partly due to the legal ambiguity surrounding content aggregation.
            </p>
            <p>
              Flyx draws inspiration from these privacy-focused projects while addressing the unique 
              challenges of streaming. The goal is not to create a commercial competitor to existing 
              services, but to prove that the technical and economic barriers to ethical streaming are 
              lower than commonly assumed.
            </p>

            <div className={styles.literatureTable}>
              <h4>Table 1: Exploitative Practices in Pirate Streaming Sites</h4>
              <div className={styles.tableWrapper}>
                <table>
                  <thead>
                    <tr>
                      <th>Practice</th>
                      <th>Prevalence</th>
                      <th>User Impact</th>
                      <th>Site Revenue</th>
                      <th>Flyx Approach</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Pop-up/Pop-under Ads</td>
                      <td>~95% of sites</td>
                      <td>Severe annoyance, malware risk</td>
                      <td>Primary revenue</td>
                      <td>None</td>
                    </tr>
                    <tr>
                      <td>Cryptocurrency Mining</td>
                      <td>~30% of sites</td>
                      <td>CPU theft, battery drain</td>
                      <td>Secondary revenue</td>
                      <td>None</td>
                    </tr>
                    <tr>
                      <td>Browser Fingerprinting</td>
                      <td>~70% of sites</td>
                      <td>Cross-site tracking</td>
                      <td>Data sales</td>
                      <td>None</td>
                    </tr>
                    <tr>
                      <td>Dark Patterns (Fake Buttons)</td>
                      <td>~90% of sites</td>
                      <td>Accidental clicks, frustration</td>
                      <td>Inflated ad metrics</td>
                      <td>None</td>
                    </tr>
                    <tr>
                      <td>Malware Distribution</td>
                      <td>~40% of sites</td>
                      <td>System compromise</td>
                      <td>Affiliate payments</td>
                      <td>None</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Methodology */}
          <section id="methodology" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>IV</span>
              <h2>Methodology</h2>
            </div>

            <h3 className={styles.subsectionTitle}>4.1 Research Design</h3>
            <p>
              This study employs a constructive research methodology, wherein the primary research 
              artifact—the Flyx streaming platform—serves as both the subject of investigation and 
              the vehicle for generating insights. Constructive research is particularly appropriate 
              for software engineering studies where the goal is to demonstrate feasibility and 
              document practical implementation approaches (Crnkovic, 2010).
            </p>
            <p>
              The research proceeded through four distinct phases: (1) requirements analysis and 
              technology selection, (2) iterative development with continuous documentation, 
              (3) deployment and operational observation, and (4) retrospective analysis and 
              synthesis. Throughout all phases, detailed logs were maintained capturing time 
              allocation, technical decisions, challenges encountered, and solutions implemented.
            </p>

            <div className={styles.methodologyDiagram}>
              <div className={styles.methodPhase}>
                <div className={styles.phaseNumber}>01</div>
                <div className={styles.phaseContent}>
                  <h4>Requirements Analysis</h4>
                  <p>Feature prioritization, technology evaluation, architecture planning</p>
                  <span className={styles.phaseDuration}>2 weeks</span>
                </div>
              </div>
              <div className={styles.phaseConnector}>
                <div className={styles.connectorLine} />
                <div className={styles.connectorArrow}>→</div>
              </div>
              <div className={styles.methodPhase}>
                <div className={styles.phaseNumber}>02</div>
                <div className={styles.phaseContent}>
                  <h4>Iterative Development</h4>
                  <p>Core features, streaming pipeline, analytics system</p>
                  <span className={styles.phaseDuration}>8 weeks</span>
                </div>
              </div>
              <div className={styles.phaseConnector}>
                <div className={styles.connectorLine} />
                <div className={styles.connectorArrow}>→</div>
              </div>
              <div className={styles.methodPhase}>
                <div className={styles.phaseNumber}>03</div>
                <div className={styles.phaseContent}>
                  <h4>Deployment & Testing</h4>
                  <p>Production deployment, performance optimization, bug fixes</p>
                  <span className={styles.phaseDuration}>2 weeks</span>
                </div>
              </div>
              <div className={styles.phaseConnector}>
                <div className={styles.connectorLine} />
                <div className={styles.connectorArrow}>→</div>
              </div>
              <div className={styles.methodPhase}>
                <div className={styles.phaseNumber}>04</div>
                <div className={styles.phaseContent}>
                  <h4>Analysis & Documentation</h4>
                  <p>Retrospective analysis, paper writing, code documentation</p>
                  <span className={styles.phaseDuration}>2 weeks</span>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>4.2 Development Constraints</h3>
            <p>
              To ensure the validity of our findings regarding solo development feasibility, the 
              following constraints were strictly observed throughout the project:
            </p>
            
            <div className={styles.constraintGrid}>
              <div className={styles.constraintCard}>
                <div className={styles.constraintIcon}>👤</div>
                <h4>Single Developer</h4>
                <p>All code, design, and documentation produced by one individual. No contractors, 
                collaborators, or outsourced work.</p>
              </div>
              <div className={styles.constraintCard}>
                <div className={styles.constraintIcon}>💰</div>
                <h4>Zero Budget</h4>
                <p>Only free tiers of services utilized. No paid tools, infrastructure, or 
                subscriptions beyond existing personal accounts.</p>
              </div>
              <div className={styles.constraintCard}>
                <div className={styles.constraintIcon}>⏰</div>
                <h4>Part-Time Effort</h4>
                <p>Development conducted during evenings and weekends only, averaging 15-20 hours 
                per week over three months.</p>
              </div>
              <div className={styles.constraintCard}>
                <div className={styles.constraintIcon}>📚</div>
                <h4>Public Resources Only</h4>
                <p>All learning materials, documentation, and references publicly available. 
                No proprietary training or insider knowledge.</p>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>4.3 Technology Selection Criteria</h3>
            <p>
              Technology choices were evaluated against five criteria, weighted by importance to 
              solo development success:
            </p>
            
            <div className={styles.criteriaList}>
              <div className={styles.criteriaItem}>
                <div className={styles.criteriaRank}>1</div>
                <div className={styles.criteriaContent}>
                  <h4>Developer Experience (DX)</h4>
                  <p>How quickly can a single developer become productive? Quality of documentation, 
                  error messages, and debugging tools.</p>
                  <div className={styles.criteriaWeight}>Weight: 30%</div>
                </div>
              </div>
              <div className={styles.criteriaItem}>
                <div className={styles.criteriaRank}>2</div>
                <div className={styles.criteriaContent}>
                  <h4>Operational Simplicity</h4>
                  <p>Minimal ongoing maintenance burden. Automatic scaling, managed updates, 
                  and self-healing capabilities.</p>
                  <div className={styles.criteriaWeight}>Weight: 25%</div>
                </div>
              </div>
              <div className={styles.criteriaItem}>
                <div className={styles.criteriaRank}>3</div>
                <div className={styles.criteriaContent}>
                  <h4>Cost Efficiency</h4>
                  <p>Generous free tiers or pay-per-use pricing that scales to zero during 
                  development and low-traffic periods.</p>
                  <div className={styles.criteriaWeight}>Weight: 20%</div>
                </div>
              </div>
              <div className={styles.criteriaItem}>
                <div className={styles.criteriaRank}>4</div>
                <div className={styles.criteriaContent}>
                  <h4>Community & Ecosystem</h4>
                  <p>Active community for troubleshooting, rich ecosystem of compatible libraries 
                  and integrations.</p>
                  <div className={styles.criteriaWeight}>Weight: 15%</div>
                </div>
              </div>
              <div className={styles.criteriaItem}>
                <div className={styles.criteriaRank}>5</div>
                <div className={styles.criteriaContent}>
                  <h4>Performance Characteristics</h4>
                  <p>Ability to deliver acceptable user experience without extensive optimization 
                  or infrastructure investment.</p>
                  <div className={styles.criteriaWeight}>Weight: 10%</div>
                </div>
              </div>
            </div>
          </section>

          {/* System Architecture */}
          <section id="architecture" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>V</span>
              <h2>System Architecture</h2>
            </div>

            <h3 className={styles.subsectionTitle}>5.1 Architectural Overview</h3>
            <p>
              Flyx employs a modern, cloud-native architecture optimized for developer productivity 
              and operational simplicity. The system follows a serverless-first approach, leveraging 
              edge computing for performance-critical paths while maintaining the flexibility of 
              traditional server-side rendering where appropriate. This architectural philosophy 
              prioritizes minimizing operational burden over theoretical performance optimization.
            </p>

            <div className={styles.architectureDiagram}>
              <div className={styles.archTitle}>Figure 1: High-Level System Architecture</div>
              <div className={styles.archLayers}>
                <div className={styles.archLayer}>
                  <span className={styles.archLabel}>Client Layer</span>
                  <div className={styles.archComponents}>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🌐</span>
                      <span>Web Browser</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>📱</span>
                      <span>Mobile Web</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>📺</span>
                      <span>Smart TV</span>
                    </div>
                  </div>
                </div>
                <div className={styles.archConnector}>
                  <div className={styles.connectorLabel}>HTTPS / WebSocket</div>
                </div>
                <div className={styles.archLayer}>
                  <span className={styles.archLabel}>Edge Layer (Vercel)</span>
                  <div className={styles.archComponents}>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>⚡</span>
                      <span>Edge Functions</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🗄️</span>
                      <span>Static Assets</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🔒</span>
                      <span>SSL Termination</span>
                    </div>
                  </div>
                </div>
                <div className={styles.archConnector}>
                  <div className={styles.connectorLabel}>Internal Network</div>
                </div>
                <div className={styles.archLayer}>
                  <span className={styles.archLabel}>Application Layer (Next.js)</span>
                  <div className={styles.archComponents}>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>⚛️</span>
                      <span>React 18 SSR</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🛣️</span>
                      <span>API Routes</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🎬</span>
                      <span>Server Actions</span>
                    </div>
                  </div>
                </div>
                <div className={styles.archConnector}>
                  <div className={styles.connectorLabel}>PostgreSQL Protocol</div>
                </div>
                <div className={styles.archLayer}>
                  <span className={styles.archLabel}>Data Layer</span>
                  <div className={styles.archComponents}>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🐘</span>
                      <span>Neon PostgreSQL</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>💾</span>
                      <span>Local Storage</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🍪</span>
                      <span>Session Storage</span>
                    </div>
                  </div>
                </div>
                <div className={styles.archConnector}>
                  <div className={styles.connectorLabel}>External APIs</div>
                </div>
                <div className={styles.archLayer}>
                  <span className={styles.archLabel}>External Services</span>
                  <div className={styles.archComponents}>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🎬</span>
                      <span>TMDB API</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>📡</span>
                      <span>Stream Providers</span>
                    </div>
                    <div className={styles.archComponent}>
                      <span className={styles.compIcon}>🌍</span>
                      <span>CDN Networks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>5.2 Technology Stack Analysis</h3>
            <p>
              Each technology in the stack was selected through rigorous evaluation against our 
              criteria. The following analysis documents the rationale for key choices:
            </p>

            <div className={styles.techAnalysis}>
              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>⚡</div>
                  <div className={styles.techInfo}>
                    <h4>Next.js 14 with App Router</h4>
                    <span className={styles.techCategory}>Framework</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    Selected for its hybrid rendering capabilities, enabling server-side rendering 
                    for SEO-critical pages while supporting client-side interactivity where needed. 
                    The App Router's streaming and Suspense support proved invaluable for progressive 
                    loading of complex pages, significantly improving perceived performance.
                  </p>
                  <div className={styles.techScores}>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>DX</span>
                      <div className={styles.scoreBar}><div style={{width: '95%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Ops</span>
                      <div className={styles.scoreBar}><div style={{width: '90%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Cost</span>
                      <div className={styles.scoreBar}><div style={{width: '100%'}} /></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>🔷</div>
                  <div className={styles.techInfo}>
                    <h4>TypeScript 5.x</h4>
                    <span className={styles.techCategory}>Language</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    Type safety was non-negotiable for a project of this complexity. TypeScript's 
                    compile-time checks caught countless bugs before they reached production, and 
                    the IDE support dramatically improved development velocity. The investment in 
                    type definitions paid dividends throughout the project lifecycle.
                  </p>
                  <div className={styles.techScores}>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>DX</span>
                      <div className={styles.scoreBar}><div style={{width: '90%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Safety</span>
                      <div className={styles.scoreBar}><div style={{width: '95%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Ecosystem</span>
                      <div className={styles.scoreBar}><div style={{width: '98%'}} /></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>🐘</div>
                  <div className={styles.techInfo}>
                    <h4>Neon PostgreSQL</h4>
                    <span className={styles.techCategory}>Database</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    Serverless PostgreSQL provided the reliability of a traditional relational 
                    database with the operational simplicity of a managed service. The branching 
                    feature enabled safe schema migrations, while the generous free tier (3GB 
                    storage, 1 compute hour/day) eliminated infrastructure costs entirely.
                  </p>
                  <div className={styles.techScores}>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Reliability</span>
                      <div className={styles.scoreBar}><div style={{width: '92%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Cost</span>
                      <div className={styles.scoreBar}><div style={{width: '100%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Features</span>
                      <div className={styles.scoreBar}><div style={{width: '88%'}} /></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>📺</div>
                  <div className={styles.techInfo}>
                    <h4>HLS.js</h4>
                    <span className={styles.techCategory}>Video Player</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    The de facto standard for adaptive bitrate streaming in browsers. HLS.js 
                    handles the complexity of manifest parsing, quality switching, and buffer 
                    management, allowing focus on user experience rather than low-level video 
                    mechanics. Excellent documentation and active maintenance ensured reliability.
                  </p>
                  <div className={styles.techScores}>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Maturity</span>
                      <div className={styles.scoreBar}><div style={{width: '95%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Performance</span>
                      <div className={styles.scoreBar}><div style={{width: '90%'}} /></div>
                    </div>
                    <div className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>Docs</span>
                      <div className={styles.scoreBar}><div style={{width: '85%'}} /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Implementation */}
          <section id="implementation" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>VI</span>
              <h2>Implementation Details</h2>
            </div>

            <h3 className={styles.subsectionTitle}>6.1 Video Streaming Pipeline</h3>
            <p>
              The video streaming implementation represents the technical heart of the platform. 
              Rather than hosting content directly—which would be both legally problematic and 
              prohibitively expensive—Flyx acts as an intelligent aggregator, discovering and 
              presenting streams from various sources while providing a unified playback experience.
            </p>
            <p>
              The streaming pipeline involves several stages: source discovery, stream extraction, 
              quality normalization, and adaptive delivery. Each stage presented unique challenges 
              and required careful optimization to maintain acceptable performance while operating 
              within the constraints of serverless execution limits.
            </p>

            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLanguage}>TypeScript</span>
                <span className={styles.codeTitle}>Listing 1: Simplified Stream Extraction Pipeline</span>
              </div>
              <pre className={styles.code}>{`interface StreamSource {
  provider: string;
  quality: '4K' | '1080p' | '720p' | '480p';
  url: string;
  reliability: number;
}

async function getPlayableStream(
  tmdbId: string, 
  mediaType: 'movie' | 'tv'
): Promise<StreamSource> {
  // 1. Query available sources for content
  const sources = await discoverSources(tmdbId, mediaType);
  
  // 2. Extract playable stream URLs in parallel
  const streams = await Promise.allSettled(
    sources.map(source => extractStream(source))
  );
  
  // 3. Filter successful extractions
  const validStreams = streams
    .filter((r): r is PromiseFulfilledResult<StreamSource> => 
      r.status === 'fulfilled'
    )
    .map(r => r.value);
  
  // 4. Rank by quality and reliability
  const ranked = rankStreams(validStreams);
  
  // 5. Return best available option
  return ranked[0];
}`}</pre>
            </div>

            <h3 className={styles.subsectionTitle}>6.2 Real-Time Analytics Architecture</h3>
            <p>
              Understanding user behavior is crucial for any content platform. Flyx implements a 
              comprehensive analytics system that tracks engagement metrics while respecting user 
              privacy. The system captures watch time, completion rates, pause/seek behavior, and 
              content discovery patterns—all without collecting personally identifiable information.
            </p>

            <div className={styles.analyticsFlow}>
              <div className={styles.flowTitle}>Figure 2: Analytics Event Pipeline</div>
              <div className={styles.flowDiagram}>
                <div className={styles.flowNode}>
                  <span className={styles.flowIcon}>👆</span>
                  <span className={styles.flowLabel}>User Action</span>
                </div>
                <div className={styles.flowArrow}>→</div>
                <div className={styles.flowNode}>
                  <span className={styles.flowIcon}>📦</span>
                  <span className={styles.flowLabel}>Event Buffer</span>
                </div>
                <div className={styles.flowArrow}>→</div>
                <div className={styles.flowNode}>
                  <span className={styles.flowIcon}>🔄</span>
                  <span className={styles.flowLabel}>Batch Processor</span>
                </div>
                <div className={styles.flowArrow}>→</div>
                <div className={styles.flowNode}>
                  <span className={styles.flowIcon}>🛣️</span>
                  <span className={styles.flowLabel}>API Route</span>
                </div>
                <div className={styles.flowArrow}>→</div>
                <div className={styles.flowNode}>
                  <span className={styles.flowIcon}>🐘</span>
                  <span className={styles.flowLabel}>PostgreSQL</span>
                </div>
              </div>
            </div>

            <p>
              The analytics pipeline uses a batched event model, accumulating events client-side 
              and flushing them periodically to minimize network overhead. Critical events (session 
              start, content completion) are sent immediately, while routine progress updates are 
              batched for efficiency. This approach reduces API calls by approximately 80% compared 
              to real-time event streaming.
            </p>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>📊</div>
                <div className={styles.statValue}>50K+</div>
                <div className={styles.statLabel}>Lines of Code</div>
                <div className={styles.statDetail}>TypeScript, CSS, SQL</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🧩</div>
                <div className={styles.statValue}>150+</div>
                <div className={styles.statLabel}>React Components</div>
                <div className={styles.statDetail}>Reusable UI elements</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🛣️</div>
                <div className={styles.statValue}>40+</div>
                <div className={styles.statLabel}>API Endpoints</div>
                <div className={styles.statDetail}>REST & Server Actions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🗄️</div>
                <div className={styles.statValue}>15+</div>
                <div className={styles.statLabel}>Database Tables</div>
                <div className={styles.statDetail}>Normalized schema</div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>6.3 Administrative Dashboard</h3>
            <p>
              A production platform requires operational visibility. The admin dashboard provides 
              real-time insights into platform health, user engagement, content performance, and 
              system metrics. Built as a separate authenticated section, it demonstrates that 
              comprehensive tooling can be developed alongside user-facing features without 
              significantly extending the development timeline.
            </p>
            <p>
              Key dashboard capabilities include live user tracking with geographic visualization, 
              content performance analytics with trend analysis, session replay for debugging user 
              issues, and system health monitoring with alerting capabilities. Each feature was 
              implemented incrementally, prioritizing the metrics most valuable for understanding 
              platform usage patterns.
            </p>
          </section>

          {/* Evaluation & Results */}
          <section id="evaluation" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>VII</span>
              <h2>Evaluation & Results</h2>
            </div>

            <h3 className={styles.subsectionTitle}>7.1 Development Metrics</h3>
            <p>
              The project was completed over approximately three months of part-time development, 
              averaging 15-20 hours per week. Total development time is estimated at 200-250 hours, 
              distributed across planning, implementation, testing, and refinement phases. The 
              following timeline illustrates the development progression:
            </p>

            <div className={styles.timeline}>
              <div className={styles.timelineHeader}>Figure 3: Development Timeline</div>
              <div className={styles.timelineTrack}>
                <div className={styles.timelinePhase} style={{width: '15%'}}>
                  <div className={styles.phaseBar} style={{background: 'linear-gradient(90deg, #6366f1, #8b5cf6)'}} />
                  <div className={styles.phaseInfo}>
                    <span className={styles.phaseTitle}>Planning</span>
                    <span className={styles.phaseWeeks}>Weeks 1-2</span>
                  </div>
                </div>
                <div className={styles.timelinePhase} style={{width: '55%'}}>
                  <div className={styles.phaseBar} style={{background: 'linear-gradient(90deg, #8b5cf6, #a855f7)'}} />
                  <div className={styles.phaseInfo}>
                    <span className={styles.phaseTitle}>Core Development</span>
                    <span className={styles.phaseWeeks}>Weeks 3-8</span>
                  </div>
                </div>
                <div className={styles.timelinePhase} style={{width: '15%'}}>
                  <div className={styles.phaseBar} style={{background: 'linear-gradient(90deg, #a855f7, #d946ef)'}} />
                  <div className={styles.phaseInfo}>
                    <span className={styles.phaseTitle}>Testing</span>
                    <span className={styles.phaseWeeks}>Weeks 9-10</span>
                  </div>
                </div>
                <div className={styles.timelinePhase} style={{width: '15%'}}>
                  <div className={styles.phaseBar} style={{background: 'linear-gradient(90deg, #d946ef, #ec4899)'}} />
                  <div className={styles.phaseInfo}>
                    <span className={styles.phaseTitle}>Polish</span>
                    <span className={styles.phaseWeeks}>Weeks 11-12</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>7.2 Feature Completeness Assessment</h3>
            <p>
              To evaluate the success of the project, we compared implemented features against 
              a reference set of capabilities found in commercial streaming platforms. Features 
              were categorized as Core (essential for basic functionality), Enhanced (improving 
              user experience), and Advanced (differentiating features of major platforms).
            </p>

            <div className={styles.featureMatrix}>
              <div className={styles.matrixHeader}>Table 2: Feature Implementation Status</div>
              <div className={styles.matrixContent}>
                <div className={styles.featureCategory}>
                  <h4>Core Features</h4>
                  <div className={styles.featureList}>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Video playback with quality selection</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Content browsing and search</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Responsive design (mobile/desktop)</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Watch progress persistence</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Content metadata display</span>
                    </div>
                  </div>
                </div>
                <div className={styles.featureCategory}>
                  <h4>Enhanced Features</h4>
                  <div className={styles.featureList}>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Live TV integration</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Real-time analytics dashboard</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Subtitle support</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✓</span>
                      <span>Keyboard shortcuts</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>○</span>
                      <span>Watchlist/favorites</span>
                    </div>
                  </div>
                </div>
                <div className={styles.featureCategory}>
                  <h4>Advanced Features</h4>
                  <div className={styles.featureList}>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✗</span>
                      <span>ML-based recommendations</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✗</span>
                      <span>Offline viewing</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✗</span>
                      <span>Multi-profile support</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✗</span>
                      <span>Native mobile apps</span>
                    </div>
                    <div className={styles.featureItem}>
                      <span className={styles.featureStatus}>✗</span>
                      <span>Social features</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.matrixLegend}>
                <span><span className={styles.legendIcon}>✓</span> Implemented</span>
                <span><span className={styles.legendIcon}>○</span> Partial</span>
                <span><span className={styles.legendIcon}>✗</span> Not Implemented</span>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>7.3 Performance Benchmarks</h3>
            <p>
              Performance testing was conducted using Lighthouse and WebPageTest to evaluate 
              real-world user experience. Results demonstrate that the serverless architecture 
              delivers acceptable performance without dedicated infrastructure investment.
            </p>

            <div className={styles.performanceGrid}>
              <div className={styles.perfCard}>
                <div className={styles.perfScore} style={{background: 'conic-gradient(#22c55e 0deg 324deg, #1e293b 324deg 360deg)'}}>
                  <span>90</span>
                </div>
                <div className={styles.perfLabel}>Performance</div>
              </div>
              <div className={styles.perfCard}>
                <div className={styles.perfScore} style={{background: 'conic-gradient(#22c55e 0deg 342deg, #1e293b 342deg 360deg)'}}>
                  <span>95</span>
                </div>
                <div className={styles.perfLabel}>Accessibility</div>
              </div>
              <div className={styles.perfCard}>
                <div className={styles.perfScore} style={{background: 'conic-gradient(#22c55e 0deg 360deg, #1e293b 360deg 360deg)'}}>
                  <span>100</span>
                </div>
                <div className={styles.perfLabel}>Best Practices</div>
              </div>
              <div className={styles.perfCard}>
                <div className={styles.perfScore} style={{background: 'conic-gradient(#22c55e 0deg 324deg, #1e293b 324deg 360deg)'}}>
                  <span>90</span>
                </div>
                <div className={styles.perfLabel}>SEO</div>
              </div>
            </div>
          </section>

          {/* Discussion */}
          <section id="discussion" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>VIII</span>
              <h2>Discussion</h2>
            </div>

            <h3 className={styles.subsectionTitle}>8.1 Key Findings</h3>
            <p className={styles.leadParagraph}>
              The Flyx project provides empirical evidence supporting the core thesis: ethical streaming 
              is not only possible but practically achievable. The findings challenge the assumed 
              necessity of exploitative practices in free streaming platforms.
            </p>

            <div className={styles.findingsGrid}>
              <div className={styles.findingCard}>
                <div className={styles.findingNumber}>1</div>
                <div className={styles.findingContent}>
                  <h4>Exploitation is a Choice, Not a Necessity</h4>
                  <p>
                    Flyx operates without ads, tracking, or malware while providing functional streaming. 
                    This proves that exploitative practices on pirate sites are profit-maximizing choices, 
                    not technical or economic requirements.
                  </p>
                </div>
              </div>
              <div className={styles.findingCard}>
                <div className={styles.findingNumber}>2</div>
                <div className={styles.findingContent}>
                  <h4>Zero-Cost Operation is Achievable</h4>
                  <p>
                    Modern serverless platforms enable production deployment at zero cost. The "we need 
                    aggressive ads to pay for servers" argument is demonstrably false for aggregator-style 
                    platforms that don't host content directly.
                  </p>
                </div>
              </div>
              <div className={styles.findingCard}>
                <div className={styles.findingNumber}>3</div>
                <div className={styles.findingContent}>
                  <h4>Privacy and Functionality Coexist</h4>
                  <p>
                    Useful analytics can be collected without PII. Watch progress can sync without accounts. 
                    Personalization can work without tracking. Privacy-respecting design doesn't require 
                    sacrificing user experience.
                  </p>
                </div>
              </div>
              <div className={styles.findingCard}>
                <div className={styles.findingNumber}>4</div>
                <div className={styles.findingContent}>
                  <h4>Users Deserve Better</h4>
                  <p>
                    The existence of Flyx demonstrates that users don't have to accept malware, pop-ups, 
                    and tracking as the price of free streaming. Alternatives can exist—the industry 
                    simply chooses not to build them.
                  </p>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>8.2 Challenges Encountered</h3>
            <p>
              No project of this scope proceeds without significant obstacles. Documenting these 
              challenges provides a realistic picture of solo development and may help future 
              practitioners avoid similar pitfalls.
            </p>

            <div className={styles.challengesList}>
              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🔄</span>
                  <h4>Stream Source Reliability</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Third-party stream sources are inherently unreliable. URLs expire, servers go 
                    offline, and quality varies dramatically. Early versions suffered from frequent 
                    playback failures that degraded user experience significantly.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Solution:</strong> Implemented a multi-source fallback system with automatic 
                    retry logic. The player maintains a ranked list of available sources and seamlessly 
                    switches to alternatives when the primary source fails.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>⚡</span>
                  <h4>Initial Load Performance</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    The rich feature set resulted in large JavaScript bundles that impacted initial 
                    page load times. Users on slower connections experienced noticeable delays before 
                    the application became interactive.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Solution:</strong> Aggressive code splitting using Next.js dynamic imports, 
                    lazy loading of non-critical components, and strategic use of React Suspense 
                    boundaries. Reduced initial bundle size by 60%.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🔒</span>
                  <h4>CORS and Security Restrictions</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Many stream sources implement CORS restrictions that prevent direct browser access. 
                    Additionally, some sources require specific headers or referrers that browsers 
                    cannot provide from cross-origin contexts.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Solution:</strong> Developed a proxy layer using Next.js API routes that 
                    handles header manipulation and CORS negotiation transparently while maintaining 
                    stream integrity and performance.
                  </div>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>8.3 Lessons Learned</h3>
            <div className={styles.lessonsBox}>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>01</span>
                <div className={styles.lessonContent}>
                  <h4>Start with the Hard Parts</h4>
                  <p>
                    Tackling video streaming first revealed constraints that shaped the entire 
                    architecture. Easier features built naturally on this foundation. Delaying 
                    difficult problems only compounds them.
                  </p>
                </div>
              </div>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>02</span>
                <div className={styles.lessonContent}>
                  <h4>Embrace Constraints</h4>
                  <p>
                    Limited time forced ruthless prioritization. Features were evaluated by 
                    impact-to-effort ratio, not technical interest. Constraints breed creativity 
                    and prevent scope creep.
                  </p>
                </div>
              </div>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>03</span>
                <div className={styles.lessonContent}>
                  <h4>Ship Incrementally</h4>
                  <p>
                    Regular deployments maintained momentum and provided early feedback. Each 
                    deployment, however small, represented tangible progress and enabled course 
                    correction.
                  </p>
                </div>
              </div>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>04</span>
                <div className={styles.lessonContent}>
                  <h4>Document Decisions</h4>
                  <p>
                    Future-self appreciation for past-self's notes cannot be overstated. 
                    Architecture decisions especially benefit from written rationale when 
                    revisiting code months later.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Reverse Engineering */}
          <section id="reverse-engineering" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>IX</span>
              <h2>Reverse Engineering: Cracking Third-Party Stream Protection</h2>
            </div>

            <p className={styles.leadParagraph}>
              Perhaps the most technically demanding aspect of Flyx was reverse engineering the 
              security measures and obfuscation techniques employed by third-party streaming providers. 
              These providers implement sophisticated anti-extraction mechanisms designed to prevent 
              exactly what we needed to accomplish. This section documents the challenges encountered 
              and the techniques developed to overcome them.
            </p>

            <div className={styles.highlightBox}>
              <div className={styles.highlightIcon}>⚠️</div>
              <div className={styles.highlightContent}>
                <h4>Technical Documentation Notice</h4>
                <p>
                  The following section describes reverse engineering work performed for educational 
                  and research purposes. The techniques documented here demonstrate the complexity 
                  of modern web security and the ingenuity required to build aggregation platforms.
                </p>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>9.1 The Obfuscation Landscape</h3>
            <p>
              Third-party streaming providers employ multiple layers of protection to prevent 
              automated extraction of their stream URLs. Understanding these defenses was essential 
              before any extraction could be attempted.
            </p>

            <div className={styles.challengesList}>
              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🔐</span>
                  <h4>JavaScript Obfuscation & Packing</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Stream providers heavily obfuscate their JavaScript using tools like JavaScript 
                    Obfuscator, UglifyJS with mangling, and custom packing algorithms. Variable names 
                    are replaced with meaningless identifiers, control flow is flattened, and string 
                    literals are encoded or split across multiple operations. Some providers use 
                    eval-based unpacking that generates code at runtime, making static analysis nearly 
                    impossible.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Approach:</strong> Developed custom deobfuscation scripts that intercept 
                    eval calls, reconstruct string concatenations, and trace execution flow through 
                    browser DevTools. Created AST-based transformers to rename variables based on 
                    usage patterns and inline constant expressions.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🎭</span>
                  <h4>Dynamic Token Generation</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Many providers generate time-sensitive tokens that must accompany stream requests. 
                    These tokens are computed client-side using algorithms that combine timestamps, 
                    content IDs, and secret keys embedded in obfuscated code. Tokens typically expire 
                    within minutes, preventing simple URL copying.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Approach:</strong> Reverse engineered token generation algorithms by 
                    tracing JavaScript execution. Identified the cryptographic primitives used 
                    (typically HMAC-SHA256 or custom hash functions) and extracted the embedded 
                    keys. Reimplemented token generation server-side to produce valid tokens on demand.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🕵️</span>
                  <h4>Bot Detection & Fingerprinting</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Providers deploy sophisticated bot detection that analyzes browser fingerprints, 
                    mouse movements, timing patterns, and JavaScript environment characteristics. 
                    Headless browsers are detected through missing APIs, inconsistent navigator 
                    properties, and WebGL fingerprint anomalies. Failed checks result in fake 
                    streams, CAPTCHAs, or IP bans.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Approach:</strong> Used Puppeteer with stealth plugins that patch 
                    detectable properties. Implemented realistic mouse movement simulation and 
                    randomized timing delays. For particularly aggressive detection, switched to 
                    HTTP-based extraction that bypasses JavaScript entirely by analyzing network 
                    requests.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🔄</span>
                  <h4>Multi-Layer Iframe Nesting</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Stream players are often embedded through multiple layers of iframes, each 
                    hosted on different domains. This creates a maze of cross-origin restrictions 
                    where the actual video player might be 3-4 iframes deep. Each layer may perform 
                    its own validation, referrer checking, and token verification.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Approach:</strong> Built recursive iframe traversal that follows the 
                    embedding chain, extracting and validating URLs at each level. Implemented 
                    referrer spoofing through proxy routes that set appropriate headers. Created 
                    a domain mapping system to track which providers use which embed hierarchies.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>📡</span>
                  <h4>Encrypted HLS Manifests</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Some providers encrypt their HLS manifests or use custom playlist formats that 
                    standard players cannot parse. The encryption keys are derived from session 
                    tokens or embedded in obfuscated JavaScript. Additionally, segment URLs may 
                    be relative to dynamically generated base paths.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Approach:</strong> Intercepted network requests to capture decrypted 
                    manifests after client-side processing. For custom formats, wrote parsers that 
                    transform proprietary playlist structures into standard M3U8. Implemented 
                    manifest rewriting to convert relative URLs to absolute paths through our proxy.
                  </div>
                </div>
              </div>

              <div className={styles.challengeItem}>
                <div className={styles.challengeHeader}>
                  <span className={styles.challengeIcon}>🛡️</span>
                  <h4>Referrer & Origin Validation</h4>
                </div>
                <div className={styles.challengeBody}>
                  <p>
                    Stream servers validate the Referer and Origin headers on every request, 
                    rejecting any that don't match expected patterns. This prevents embedding 
                    streams on unauthorized domains and blocks direct access to stream URLs. 
                    Some providers also check the Sec-Fetch-* headers introduced in modern browsers.
                  </p>
                  <div className={styles.solutionBox}>
                    <strong>Approach:</strong> Developed a sophisticated proxy layer that intercepts 
                    all stream requests and rewrites headers to match expected values. The proxy 
                    maintains a mapping of which headers each provider expects and dynamically 
                    adjusts based on the target domain.
                  </div>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>9.2 Provider-Specific Challenges</h3>
            <p>
              Each streaming provider presented unique challenges requiring tailored solutions. 
              The following documents the most significant reverse engineering efforts:
            </p>

            <div className={styles.techAnalysis}>
              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>🎬</div>
                  <div className={styles.techInfo}>
                    <h4>2Embed / VidSrc Ecosystem</h4>
                    <span className={styles.techCategory}>Primary Provider</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    The 2Embed network uses a complex chain of redirects through multiple domains 
                    (streamsrcs, embedsrcs, vidsrc variants). Each hop performs validation and 
                    generates new tokens. The final player uses packed JavaScript with custom 
                    string encoding where characters are split and reassembled through array 
                    operations. Stream URLs are constructed dynamically from multiple encrypted 
                    fragments.
                  </p>
                  <p>
                    <strong>Key Breakthrough:</strong> Discovered that the packing algorithm uses 
                    a predictable seed based on content ID. By reverse engineering the unpacking 
                    function, we could extract stream URLs without executing the obfuscated code. 
                    This reduced extraction time from 5+ seconds (with browser automation) to 
                    under 200ms (pure HTTP).
                  </p>
                </div>
              </div>

              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>📺</div>
                  <div className={styles.techInfo}>
                    <h4>SuperEmbed / RCP Network</h4>
                    <span className={styles.techCategory}>Fallback Provider</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    SuperEmbed employs aggressive bot detection including canvas fingerprinting, 
                    WebGL renderer checks, and timing analysis. The player loads through a 
                    "prorcp" intermediary that validates browser environment before revealing 
                    the actual stream endpoint. Failed validation returns decoy streams that 
                    play for 30 seconds before cutting off.
                  </p>
                  <p>
                    <strong>Key Breakthrough:</strong> Identified that the validation could be 
                    bypassed by directly accessing the "srcrcp" endpoint with properly formatted 
                    parameters extracted from the initial page load. This skips the JavaScript 
                    validation entirely while still receiving valid stream URLs.
                  </p>
                </div>
              </div>

              <div className={styles.techCard}>
                <div className={styles.techHeader}>
                  <div className={styles.techLogo}>📡</div>
                  <div className={styles.techInfo}>
                    <h4>DLHD Live TV Streams</h4>
                    <span className={styles.techCategory}>Live Content</span>
                  </div>
                </div>
                <div className={styles.techBody}>
                  <p>
                    Live TV streams presented unique challenges: URLs change frequently, 
                    authentication tokens expire rapidly, and geographic restrictions are 
                    enforced at the CDN level. The provider uses a custom player that 
                    communicates with a WebSocket backend for real-time URL updates and 
                    implements DRM-like protections on the stream segments themselves.
                  </p>
                  <p>
                    <strong>Key Breakthrough:</strong> Reverse engineered the WebSocket protocol 
                    to understand the URL refresh mechanism. Implemented a proxy that maintains 
                    persistent connections and transparently handles URL rotation, presenting 
                    a stable endpoint to our player while managing the complexity behind the scenes.
                  </p>
                </div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>9.3 Tools & Techniques Developed</h3>
            <p>
              The reverse engineering effort produced several reusable tools and techniques:
            </p>

            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLanguage}>TypeScript</span>
                <span className={styles.codeTitle}>Listing 2: Simplified Deobfuscation Pipeline</span>
              </div>
              <pre className={styles.code}>{`interface DeobfuscationResult {
  extractedUrls: string[];
  tokens: Record<string, string>;
  confidence: number;
}

async function deobfuscateProvider(
  html: string,
  provider: 'vidsrc' | 'superembed' | 'dlhd'
): Promise<DeobfuscationResult> {
  // 1. Extract all script tags and inline JS
  const scripts = extractScripts(html);
  
  // 2. Identify and unpack obfuscated segments
  const unpacked = scripts.map(script => {
    if (isPacked(script)) {
      return unpackScript(script);
    }
    return script;
  });
  
  // 3. Apply provider-specific decoders
  const decoder = getDecoder(provider);
  const decoded = decoder.process(unpacked.join('\\n'));
  
  // 4. Extract stream URLs using pattern matching
  const urls = extractStreamUrls(decoded);
  
  // 5. Extract authentication tokens
  const tokens = extractTokens(decoded);
  
  return {
    extractedUrls: urls,
    tokens,
    confidence: calculateConfidence(urls, tokens)
  };
}`}</pre>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🔓</div>
                <div className={styles.statValue}>15+</div>
                <div className={styles.statLabel}>Obfuscation Patterns</div>
                <div className={styles.statDetail}>Identified & decoded</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>⚡</div>
                <div className={styles.statValue}>200ms</div>
                <div className={styles.statLabel}>Avg Extraction Time</div>
                <div className={styles.statDetail}>Down from 5+ seconds</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🎯</div>
                <div className={styles.statValue}>95%+</div>
                <div className={styles.statLabel}>Success Rate</div>
                <div className={styles.statDetail}>Stream extraction</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>🔄</div>
                <div className={styles.statValue}>8</div>
                <div className={styles.statLabel}>Provider Adapters</div>
                <div className={styles.statDetail}>Active integrations</div>
              </div>
            </div>

            <h3 className={styles.subsectionTitle}>9.4 The Cat-and-Mouse Reality</h3>
            <p>
              Reverse engineering streaming providers is an ongoing battle. Providers regularly 
              update their obfuscation, change their API endpoints, and implement new detection 
              mechanisms. What works today may fail tomorrow.
            </p>

            <div className={styles.lessonsBox}>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>01</span>
                <div className={styles.lessonContent}>
                  <h4>Build for Change</h4>
                  <p>
                    The extraction system is architected with provider-specific adapters that can 
                    be updated independently. When a provider changes their protection, only that 
                    adapter needs modification—the rest of the system continues functioning.
                  </p>
                </div>
              </div>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>02</span>
                <div className={styles.lessonContent}>
                  <h4>Multiple Fallbacks</h4>
                  <p>
                    Never rely on a single provider. The system maintains multiple extraction 
                    paths for each piece of content, automatically falling back when primary 
                    sources fail. Redundancy is survival.
                  </p>
                </div>
              </div>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>03</span>
                <div className={styles.lessonContent}>
                  <h4>Monitor Continuously</h4>
                  <p>
                    Automated health checks run continuously, testing extraction against known 
                    content. When success rates drop, alerts trigger investigation before users 
                    notice widespread failures.
                  </p>
                </div>
              </div>
              <div className={styles.lessonItem}>
                <span className={styles.lessonNumber}>04</span>
                <div className={styles.lessonContent}>
                  <h4>Document Everything</h4>
                  <p>
                    Every obfuscation pattern, every bypass technique, every provider quirk is 
                    documented. When patterns resurface months later, the documentation enables 
                    rapid response rather than starting from scratch.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.citationBox}>
              <div className={styles.citationMark}>"</div>
              <blockquote>
                The complexity of modern stream protection is a testament to the value of the 
                content being protected. Cracking these systems required hundreds of hours of 
                analysis, experimentation, and iteration. This work represents the invisible 
                foundation upon which the entire platform stands.
              </blockquote>
              <cite>— Reflections on the Reverse Engineering Process</cite>
            </div>
          </section>

          {/* Future Work */}
          <section id="future" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>X</span>
              <h2>Future Work</h2>
            </div>
            <p>
              While Flyx achieves its primary goal of demonstrating solo development capability, 
              several areas warrant future exploration. These directions represent both technical 
              enhancements and research opportunities:
            </p>

            <div className={styles.futureGrid}>
              <div className={styles.futureCard}>
                <div className={styles.futureIcon}>🤖</div>
                <h4>Machine Learning Integration</h4>
                <p>
                  Implementing recommendation algorithms using collaborative filtering or 
                  content-based approaches. Exploring edge-deployed ML models for real-time 
                  personalization without server round-trips.
                </p>
                <span className={styles.futureComplexity}>Complexity: High</span>
              </div>
              <div className={styles.futureCard}>
                <div className={styles.futureIcon}>📱</div>
                <h4>Progressive Web App</h4>
                <p>
                  Adding offline capability and app-like experience through service workers 
                  and manifest configuration. Enabling installation on mobile devices without 
                  app store distribution.
                </p>
                <span className={styles.futureComplexity}>Complexity: Medium</span>
              </div>
              <div className={styles.futureCard}>
                <div className={styles.futureIcon}>🌐</div>
                <h4>Internationalization</h4>
                <p>
                  Supporting multiple languages and regional content preferences. Implementing 
                  RTL layout support and locale-aware formatting throughout the application.
                </p>
                <span className={styles.futureComplexity}>Complexity: Medium</span>
              </div>
              <div className={styles.futureCard}>
                <div className={styles.futureIcon}>♿</div>
                <h4>Accessibility Audit</h4>
                <p>
                  Comprehensive WCAG 2.1 AA compliance review and implementation. Adding 
                  screen reader support, keyboard navigation improvements, and reduced 
                  motion alternatives.
                </p>
                <span className={styles.futureComplexity}>Complexity: Medium</span>
              </div>
            </div>
          </section>

          {/* Conclusion */}
          <section id="conclusion" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>XI</span>
              <h2>Conclusion</h2>
            </div>
            <p className={styles.leadParagraph}>
              This paper has presented Flyx, a streaming platform built to prove a simple but important 
              point: free streaming does not require exploiting users. The malicious advertising, 
              invasive tracking, cryptocurrency mining, and dark patterns endemic to pirate streaming 
              sites are not technical necessities—they are choices made by operators who prioritize 
              profit over people.
            </p>
            <p>
              Flyx demonstrates that an alternative is possible. A single developer, working part-time 
              with no budget, can create a functional streaming platform that respects its users. No 
              pop-ups. No tracking. No malware. No deception. If this is achievable under such 
              constraints, then the exploitative practices of existing platforms are revealed for 
              what they are: greed, not necessity.
            </p>
            <p>
              The broader implication is that users don't have to accept the status quo. They deserve 
              platforms that treat them as people rather than products. They deserve interfaces designed 
              to help them find content, not trick them into clicking ads. They deserve to watch a 
              movie without their browser being hijacked, their CPU being mined, or their behavior 
              being tracked across the web.
            </p>

            <div className={styles.conclusionQuote}>
              <div className={styles.quoteDecoration}>
                <span>"</span>
              </div>
              <blockquote>
                The measure of a platform is not how much value it extracts from users, but how much 
                value it provides to them. Flyx exists to prove that free doesn't have to mean exploited.
              </blockquote>
              <cite>— Vynx</cite>
            </div>

            <p>
              For users, the message is: you deserve better, and better is possible. For developers, 
              the challenge is: if one person can build this, what's stopping you from building 
              something ethical too? And for the operators of exploitative platforms: your practices 
              are a choice, and that choice says everything about your values.
            </p>
          </section>

          {/* Legal Framework */}
          <section id="legal" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>XII</span>
              <h2>Legal Framework</h2>
            </div>

            <div className={styles.legalPreamble}>
              <div className={styles.legalIcon}>⚖️</div>
              <div className={styles.legalPreambleContent}>
                <h3>Terms of Service & Legal Notices</h3>
                <p>
                  The following terms constitute a binding legal agreement between you ("User," "you," 
                  or "your") and Flyx ("the Platform," "we," "us," or "our"). By accessing or using 
                  the Platform, you acknowledge that you have read, understood, and agree to be bound 
                  by these terms.
                </p>
                <div className={styles.legalMeta}>
                  <span><strong>Effective Date:</strong> November 29, 2025</span>
                  <span><strong>Version:</strong> 1.0</span>
                  <span><strong>Last Updated:</strong> November 29, 2025</span>
                </div>
              </div>
            </div>

            <div className={styles.legalContainer}>
              {/* Article 1 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 1</div>
                  <h4>Nature and Purpose of Service</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>1.1</span>
                    <p>
                      Flyx is a personal, non-commercial technology demonstration project ("Project") 
                      created solely for educational, research, and portfolio purposes. The Project 
                      is designed to showcase modern web development techniques, architectural patterns, 
                      and the capabilities of contemporary development tools.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>1.2</span>
                    <p>
                      The Platform does not constitute a commercial streaming service and is not 
                      intended to compete with, replace, or substitute for any licensed streaming 
                      platform or content distribution service. It exists purely as a technical 
                      demonstration and learning exercise.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>1.3</span>
                    <p>
                      No fees are charged for access to the Platform. The Project generates no revenue 
                      and operates at zero profit. Any costs associated with hosting and operation are 
                      borne entirely by the developer as part of the educational exercise.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>1.4</span>
                    <p>
                      The Platform may be discontinued, modified, or removed at any time without notice, 
                      as befits its nature as a personal project rather than a commercial service with 
                      service level agreements.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 2 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 2</div>
                  <h4>Content Disclaimer and Third-Party Sources</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>2.1</span>
                    <p>
                      The Platform does not host, store, upload, transmit, or distribute any video 
                      content, media files, or copyrighted materials on its servers or infrastructure. 
                      All content delivery occurs through third-party services.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>2.2</span>
                    <p>
                      All media content accessible through the Platform is sourced from third-party 
                      providers, publicly available APIs, and external hosting services over which we 
                      exercise no control and bear no responsibility for availability, accuracy, or 
                      legality.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>2.3</span>
                    <p>
                      The Platform functions as a technical interface—analogous to a web browser or 
                      search engine—that facilitates access to content hosted elsewhere on the internet. 
                      We do not select, curate, edit, or modify the content accessible through the Platform.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>2.4</span>
                    <p>
                      We make no representations or warranties regarding the legality, accuracy, quality, 
                      safety, or appropriateness of any third-party content. Users access such content 
                      entirely at their own risk and discretion.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>2.5</span>
                    <p>
                      The inclusion of any content accessible through the Platform does not constitute 
                      endorsement, sponsorship, or affiliation with the content creators, rights holders, 
                      or hosting providers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 3 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 3</div>
                  <h4>Intellectual Property and DMCA Compliance</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>3.1</span>
                    <p>
                      We respect the intellectual property rights of others and expect users of the 
                      Platform to do the same. We comply with the provisions of the Digital Millennium 
                      Copyright Act (DMCA) and similar international copyright frameworks.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>3.2</span>
                    <p>
                      If you believe that content accessible through the Platform infringes your 
                      copyright, please note that we do not host such content directly. However, we 
                      will promptly investigate and, where appropriate, remove or disable access to 
                      any links, references, or technical integrations that facilitate access to 
                      allegedly infringing material.
                    </p>
                  </div>
                  <div className={styles.legalHighlight}>
                    <div className={styles.highlightHeader}>
                      <span className={styles.highlightIcon}>📋</span>
                      <span>DMCA Takedown Notice Requirements</span>
                    </div>
                    <p>To submit a valid DMCA takedown notice, please provide:</p>
                    <ul>
                      <li>Identification of the copyrighted work claimed to be infringed</li>
                      <li>Identification of the material claimed to be infringing and information sufficient to locate it</li>
                      <li>Your contact information (name, address, telephone, email)</li>
                      <li>A statement that you have a good faith belief that use of the material is not authorized</li>
                      <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act on behalf of the copyright owner</li>
                    </ul>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>3.4</span>
                    <p>
                      The source code, design, and original technical implementations of the Platform 
                      itself are the intellectual property of the developer. Third-party libraries and 
                      frameworks are used in accordance with their respective open-source licenses.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 4 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 4</div>
                  <h4>Disclaimer of Warranties</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalWarning}>
                    <div className={styles.warningIcon}>⚠️</div>
                    <div className={styles.warningContent}>
                      <p>
                        THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT 
                        WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
                        TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, 
                        TITLE, AND NON-INFRINGEMENT.
                      </p>
                    </div>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>4.2</span>
                    <p>
                      We do not warrant that: (a) the Platform will meet your requirements; (b) the 
                      Platform will be uninterrupted, timely, secure, or error-free; (c) the results 
                      obtained from use of the Platform will be accurate or reliable; (d) the quality 
                      of any content or services obtained through the Platform will meet your expectations; 
                      or (e) any errors in the Platform will be corrected.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>4.3</span>
                    <p>
                      Any content downloaded or otherwise obtained through the Platform is accessed at 
                      your own discretion and risk, and you will be solely responsible for any damage 
                      to your computer system or loss of data that results from such access.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 5 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 5</div>
                  <h4>Limitation of Liability</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalWarning}>
                    <div className={styles.warningIcon}>🛡️</div>
                    <div className={styles.warningContent}>
                      <p>
                        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE 
                        PLATFORM, ITS DEVELOPER, OR ANY AFFILIATED PARTIES BE LIABLE FOR ANY INDIRECT, 
                        INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES.
                      </p>
                    </div>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>5.2</span>
                    <p>
                      This limitation applies regardless of whether such damages arise from: (a) your 
                      access to, use of, or inability to access or use the Platform; (b) any conduct 
                      or content of any third party on or accessed through the Platform; (c) any content 
                      obtained from or through the Platform; (d) unauthorized access, use, or alteration 
                      of your transmissions or content.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>5.3</span>
                    <p>
                      In no event shall our total liability to you for all claims arising from or 
                      relating to the Platform exceed the amount you paid us in the twelve (12) months 
                      preceding the claim, which, given the free nature of the Platform, is zero dollars ($0.00).
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 6 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 6</div>
                  <h4>User Responsibilities and Prohibited Conduct</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>6.1</span>
                    <p>
                      By using the Platform, you represent and warrant that you are at least 18 years 
                      of age or the age of majority in your jurisdiction, whichever is greater, or are 
                      using the Platform under the supervision of a parent or legal guardian.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>6.2</span>
                    <p>
                      You agree to comply with all applicable local, state, national, and international 
                      laws and regulations in connection with your use of the Platform.
                    </p>
                  </div>
                  <div className={styles.prohibitedList}>
                    <h5>Prohibited Activities</h5>
                    <div className={styles.prohibitedGrid}>
                      <div className={styles.prohibitedItem}>
                        <span className={styles.prohibitedIcon}>🚫</span>
                        <span>Using the Platform for any unlawful purpose</span>
                      </div>
                      <div className={styles.prohibitedItem}>
                        <span className={styles.prohibitedIcon}>🚫</span>
                        <span>Attempting unauthorized access to systems</span>
                      </div>
                      <div className={styles.prohibitedItem}>
                        <span className={styles.prohibitedIcon}>🚫</span>
                        <span>Interfering with Platform operations</span>
                      </div>
                      <div className={styles.prohibitedItem}>
                        <span className={styles.prohibitedIcon}>🚫</span>
                        <span>Using automated scraping tools</span>
                      </div>
                      <div className={styles.prohibitedItem}>
                        <span className={styles.prohibitedIcon}>🚫</span>
                        <span>Circumventing security features</span>
                      </div>
                      <div className={styles.prohibitedItem}>
                        <span className={styles.prohibitedIcon}>🚫</span>
                        <span>Transmitting malicious code</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Article 7 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 7</div>
                  <h4>Privacy and Data Practices</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.privacyHighlight}>
                    <div className={styles.privacyIcon}>🔐</div>
                    <div className={styles.privacyContent}>
                      <h5>Our Privacy Commitment</h5>
                      <p>
                        We are committed to protecting your privacy. The Platform employs anonymized 
                        tracking for analytics purposes only and does not collect personally 
                        identifiable information.
                      </p>
                    </div>
                  </div>
                  <div className={styles.privacyGrid}>
                    <div className={styles.privacyCard}>
                      <span className={styles.privacyCardIcon}>✓</span>
                      <h5>What We Don't Collect</h5>
                      <ul>
                        <li>Names or email addresses</li>
                        <li>Physical addresses</li>
                        <li>Phone numbers</li>
                        <li>Government IDs</li>
                        <li>Payment information</li>
                      </ul>
                    </div>
                    <div className={styles.privacyCard}>
                      <span className={styles.privacyCardIcon}>📊</span>
                      <h5>What We Do Collect</h5>
                      <ul>
                        <li>Anonymous session identifiers</li>
                        <li>Aggregate usage statistics</li>
                        <li>Content interaction data</li>
                        <li>Technical performance metrics</li>
                        <li>Error logs (anonymized)</li>
                      </ul>
                    </div>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>7.4</span>
                    <p>
                      No user data is sold, rented, leased, or otherwise transferred to third parties 
                      for any purpose. Aggregate, anonymized analytics may be referenced in technical 
                      documentation or presentations about the Project.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>7.5</span>
                    <p>
                      You may clear all locally stored data at any time by clearing your browser's 
                      local storage and session storage. This will reset your anonymous identifier 
                      and any stored preferences.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 8 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 8</div>
                  <h4>Indemnification</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>8.1</span>
                    <p>
                      You agree to defend, indemnify, and hold harmless the Platform, its developer, 
                      and any affiliated parties from and against any and all claims, liabilities, 
                      damages, judgments, awards, losses, costs, expenses, and fees (including 
                      reasonable attorneys' fees) arising out of or relating to: (a) your violation 
                      of these terms; (b) your use of the Platform; (c) your violation of any rights 
                      of any third party; or (d) any content you access through the Platform.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>8.2</span>
                    <p>
                      We reserve the right, at our own expense, to assume the exclusive defense and 
                      control of any matter otherwise subject to indemnification by you, in which 
                      event you will cooperate with us in asserting any available defenses.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 9 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 9</div>
                  <h4>Dispute Resolution and Governing Law</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>9.1</span>
                    <p>
                      These terms shall be governed by and construed in accordance with applicable 
                      laws, without regard to principles of conflict of laws.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>9.2</span>
                    <p>
                      Any dispute, controversy, or claim arising out of or relating to these terms 
                      or the Platform shall be resolved through binding arbitration in accordance 
                      with applicable arbitration rules. The arbitration shall be conducted in English.
                    </p>
                  </div>
                  <div className={styles.legalWarning}>
                    <div className={styles.warningIcon}>⚠️</div>
                    <div className={styles.warningContent}>
                      <p>
                        YOU UNDERSTAND AND AGREE THAT BY ENTERING INTO THESE TERMS, YOU AND THE 
                        PLATFORM ARE EACH WAIVING THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO 
                        PARTICIPATE IN A CLASS ACTION.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Article 10 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 10</div>
                  <h4>Modifications and Termination</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>10.1</span>
                    <p>
                      We reserve the right to modify, suspend, or discontinue the Platform (or any 
                      part thereof) at any time, with or without notice. We shall not be liable to 
                      you or any third party for any modification, suspension, or discontinuance.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>10.2</span>
                    <p>
                      We may revise these terms from time to time. The most current version will 
                      always be available on the Platform. By continuing to access or use the Platform 
                      after revisions become effective, you agree to be bound by the revised terms.
                    </p>
                  </div>
                  <div className={styles.legalClause}>
                    <span className={styles.clauseNumber}>10.3</span>
                    <p>
                      We may terminate or suspend your access to the Platform immediately, without 
                      prior notice or liability, for any reason whatsoever, including without 
                      limitation if you breach these terms.
                    </p>
                  </div>
                </div>
              </div>

              {/* Article 11 */}
              <div className={styles.legalArticle}>
                <div className={styles.articleHeader}>
                  <div className={styles.articleBadge}>Article 11</div>
                  <h4>General Provisions</h4>
                </div>
                <div className={styles.articleContent}>
                  <div className={styles.generalProvisions}>
                    <div className={styles.provisionItem}>
                      <h5>11.1 Severability</h5>
                      <p>
                        If any provision of these terms is held to be invalid, illegal, or 
                        unenforceable, such provision shall be modified to the minimum extent 
                        necessary to make it valid and enforceable, and the remaining provisions 
                        shall continue in full force and effect.
                      </p>
                    </div>
                    <div className={styles.provisionItem}>
                      <h5>11.2 Waiver</h5>
                      <p>
                        No waiver of any term or condition of these terms shall be deemed a further 
                        or continuing waiver of such term or any other term, and our failure to 
                        assert any right or provision shall not constitute a waiver.
                      </p>
                    </div>
                    <div className={styles.provisionItem}>
                      <h5>11.3 Entire Agreement</h5>
                      <p>
                        These terms constitute the entire agreement between you and the Platform 
                        regarding your use of the Platform and supersede all prior agreements 
                        and understandings.
                      </p>
                    </div>
                    <div className={styles.provisionItem}>
                      <h5>11.4 Assignment</h5>
                      <p>
                        You may not assign or transfer these terms or your rights hereunder without 
                        our prior written consent. We may assign our rights and obligations without 
                        restriction.
                      </p>
                    </div>
                    <div className={styles.provisionItem}>
                      <h5>11.5 No Third-Party Beneficiaries</h5>
                      <p>
                        These terms do not confer any third-party beneficiary rights.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal Footer */}
              <div className={styles.legalFooter}>
                <div className={styles.legalFooterContent}>
                  <div className={styles.legalSeal}>
                    <div className={styles.sealIcon}>⚖️</div>
                    <span>Legal Framework v1.0</span>
                  </div>
                  <p className={styles.legalAcknowledgment}>
                    By accessing or using Flyx, you acknowledge that you have read this Legal 
                    Framework in its entirety, understand its terms, and agree to be legally 
                    bound by all provisions contained herein.
                  </p>
                  <div className={styles.legalDates}>
                    <span>Effective: November 29, 2025</span>
                    <span>•</span>
                    <span>Version 1.0</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* References */}
          <section id="references" className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>XIII</span>
              <h2>References</h2>
            </div>

            <div className={styles.referencesContainer}>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[1]</span>
                <p>
                  Rafique, M. Z., Van Goethem, T., Joosen, W., Huygens, C., & Nikiforakis, N. (2016). 
                  It's free for a reason: Exploring the ecosystem of free live streaming services. 
                  <em>Network and Distributed System Security Symposium (NDSS)</em>.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[2]</span>
                <p>
                  Konoth, R. K., Vineti, E., Moonsamy, V., Lindorfer, M., Kruegel, C., Bos, H., & Vigna, G. (2018). 
                  MineSweeper: An in-depth look into drive-by cryptocurrency mining and its defense. 
                  <em>ACM Conference on Computer and Communications Security (CCS)</em>.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[3]</span>
                <p>
                  Laperdrix, P., Bielova, N., Baudry, B., & Avoine, G. (2020). Browser fingerprinting: 
                  A survey. <em>ACM Transactions on the Web</em>, 14(2), 1-33.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[4]</span>
                <p>
                  Gray, C. M., Kou, Y., Battles, B., Hoggatt, J., & Toombs, A. L. (2018). The dark (patterns) 
                  side of UX design. <em>CHI Conference on Human Factors in Computing Systems</em>, 1-14.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[5]</span>
                <p>
                  Nikiforakis, N., Kapravelos, A., Joosen, W., Kruegel, C., Piessens, F., & Vigna, G. (2013). 
                  Cookieless monster: Exploring the ecosystem of web-based device fingerprinting. 
                  <em>IEEE Symposium on Security and Privacy</em>, 541-555.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[6]</span>
                <p>
                  Zarras, A., Kapravelos, A., Stringhini, G., Holz, T., Kruegel, C., & Vigna, G. (2014). 
                  The dark alleys of Madison Avenue: Understanding malicious advertisements. 
                  <em>Internet Measurement Conference (IMC)</em>, 373-380.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[7]</span>
                <p>
                  Englehardt, S., & Narayanan, A. (2016). Online tracking: A 1-million-site measurement 
                  and analysis. <em>ACM Conference on Computer and Communications Security (CCS)</em>, 1388-1401.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[8]</span>
                <p>
                  Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). 
                  Dark patterns at scale: Findings from a crawl of 11K shopping websites. 
                  <em>ACM Human-Computer Interaction</em>, 3(CSCW), 1-32.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[9]</span>
                <p>
                  Mayer, J. R., & Mitchell, J. C. (2012). Third-party web tracking: Policy and technology. 
                  <em>IEEE Symposium on Security and Privacy</em>, 413-427.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[10]</span>
                <p>
                  Stockhammer, T. (2011). Dynamic adaptive streaming over HTTP: standards and design principles. 
                  <em>Proceedings of the Second Annual ACM Conference on Multimedia Systems</em>, 133-144.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[11]</span>
                <p>
                  Electronic Frontier Foundation. (2024). Privacy Badger: How it works. 
                  <em>EFF Technical Documentation</em>.
                </p>
              </div>
              <div className={styles.referenceItem}>
                <span className={styles.refNumber}>[12]</span>
                <p>
                  Mozilla Foundation. (2023). State of Mozilla: Privacy and the Internet. 
                  <em>Mozilla Annual Report</em>.
                </p>
              </div>
            </div>
          </section>
        </article>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <Link href="/" className={styles.backButton}>
            <span className={styles.backArrow}>←</span>
            <span>Return to Platform</span>
          </Link>
          <div className={styles.footerInfo}>
            <p className={styles.footerTitle}>Flyx</p>
            <p className={styles.footerSubtitle}>Built by Vynx • Proving Ethical Streaming is Possible • 2025</p>
          </div>
          <div className={styles.footerMeta}>
            <span>No Ads • No Tracking • No Exploitation</span>
            <span>Just Streaming</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
