'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './about.module.css';

export default function AboutPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const stats = [
    { label: 'Lines of Code', value: '50,000+', icon: '💻' },
    { label: 'Development Time', value: '3 Months', icon: '⏱️' },
    { label: 'Coffee Consumed', value: '∞', icon: '☕' },
    { label: 'Sleep Lost', value: 'Too Much', icon: '😴' },
  ];

  const features = [
    { title: 'Modern Stack', description: 'Built with Next.js 14, React 18, TypeScript, and Tailwind CSS', icon: '⚡' },
    { title: 'Real-time Analytics', description: 'Comprehensive tracking of user engagement, watch time, and content performance', icon: '📊' },
    { title: 'Adaptive Streaming', description: 'HLS video delivery with automatic quality adjustment', icon: '🎬' },
    { title: 'Live TV Integration', description: 'Real-time streaming with EPG and channel management', icon: '📺' },
    { title: 'Responsive Design', description: 'Seamless experience across desktop, tablet, and mobile', icon: '📱' },
    { title: 'Privacy First', description: 'Anonymized tracking with no personal data collection', icon: '🔒' },
  ];

  const faqs = [
    {
      question: 'What is Flyx?',
      answer: 'Flyx is a demonstration streaming platform built to showcase modern web development capabilities. It serves as a proof of concept for what a single developer can accomplish with current technologies.'
    },
    {
      question: 'Is this a commercial service?',
      answer: 'No. Flyx is a personal project created for educational and demonstration purposes only. It is not intended for commercial use or profit.'
    },
    {
      question: 'Who built this?',
      answer: 'This entire platform was designed, developed, and deployed by a single developer in their spare time, proving that modern tools and frameworks enable individuals to create sophisticated applications.'
    },
    {
      question: 'What technologies are used?',
      answer: 'The platform uses Next.js 14 with App Router, React 18, TypeScript, Tailwind CSS, HLS.js for video streaming, Neon PostgreSQL for data storage, and is deployed on Vercel.'
    },
    {
      question: 'Does Flyx store personal data?',
      answer: 'No. All user tracking is completely anonymized. We generate random user IDs stored locally in your browser. No accounts, emails, or personal information is collected or stored.'
    },
  ];

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>
            About <span className={styles.gradient}>Flyx</span>
          </h1>
          <p className={styles.subtitle}>
            A modern streaming platform built by one person to prove a point
          </p>
        </div>
        <div className={styles.heroGlow} />
      </section>

      {/* Mission Section */}
      <section className={styles.section}>
        <div className={styles.missionCard}>
          <div className={styles.missionIcon}>🎯</div>
          <h2>Our Mission</h2>
          <p>
            Flyx exists to demonstrate that the barrier to building sophisticated web applications 
            has never been lower. With modern frameworks, cloud infrastructure, and open-source tools, 
            a single motivated developer can create experiences that rival those built by large teams.
          </p>
          <p>
            This project is a testament to the democratization of software development. What once 
            required millions in funding and dozens of engineers can now be accomplished by one person 
            with determination, curiosity, and a laptop.
          </p>
        </div>
      </section>


      {/* Stats Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>By The Numbers</h2>
        <div className={styles.statsGrid}>
          {stats.map((stat, index) => (
            <div key={index} className={styles.statCard}>
              <span className={styles.statIcon}>{stat.icon}</span>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Story Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The Story</h2>
        <div className={styles.storyContent}>
          <div className={styles.storyBlock}>
            <h3>🚀 The Beginning</h3>
            <p>
              It started as a simple question: "How hard could it be to build a streaming platform?" 
              The answer, as it turns out, is both "very hard" and "surprisingly achievable" depending 
              on your perspective and stubbornness level.
            </p>
          </div>
          <div className={styles.storyBlock}>
            <h3>💡 The Challenge</h3>
            <p>
              The goal was never to compete with Netflix or Disney+. It was to prove that the 
              fundamental architecture of a modern streaming service—video delivery, user tracking, 
              content discovery, live TV, analytics dashboards—could be built by a single developer 
              working evenings and weekends.
            </p>
          </div>
          <div className={styles.storyBlock}>
            <h3>🛠️ The Process</h3>
            <p>
              Every feature you see was researched, designed, implemented, tested, and deployed by 
              one person. From reverse-engineering video APIs to building real-time analytics, from 
              designing the UI to optimizing database queries—it was all a learning experience wrapped 
              in a passion project.
            </p>
          </div>
          <div className={styles.storyBlock}>
            <h3>🎉 The Result</h3>
            <p>
              What you're using now is the culmination of countless late nights, debugging sessions, 
              Stack Overflow visits, and moments of both frustration and triumph. It's not perfect, 
              but it works—and that's the whole point.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Technical Highlights</h2>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.featureCard}>
              <span className={styles.featureIcon}>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`${styles.faqItem} ${expandedFaq === index ? styles.expanded : ''}`}
              onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <div className={styles.faqQuestion}>
                <span>{faq.question}</span>
                <span className={styles.faqToggle}>{expandedFaq === index ? '−' : '+'}</span>
              </div>
              {expandedFaq === index && (
                <div className={styles.faqAnswer}>{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section className={styles.section}>
        <div className={styles.contactCard}>
          <h2>Get In Touch</h2>
          <p>
            Have questions, feedback, or just want to say hi? This project is open to discussion 
            and collaboration. While it's a personal project, the knowledge gained is meant to be shared.
          </p>
          <div className={styles.contactLinks}>
            <Link href="/" className={styles.contactButton}>
              Back to Home
            </Link>
          </div>
        </div>
      </section>


      {/* Legal Section */}
      <section className={styles.legalSection}>
        <h2 className={styles.legalTitle}>Legal Disclaimer & Terms</h2>
        
        <div className={styles.legalContent}>
          <div className={styles.legalBlock}>
            <h3>1. Nature of Service</h3>
            <p>
              Flyx ("the Platform," "we," "us," or "our") is a personal, non-commercial demonstration 
              project created solely for educational and portfolio purposes. The Platform is not a 
              commercial streaming service and does not charge users for access. This project exists 
              to demonstrate technical capabilities and is not intended to generate revenue or profit.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>2. No Ownership of Content</h3>
            <p>
              The Platform does not host, store, upload, or distribute any video content. All media 
              accessible through the Platform is sourced from third-party providers and publicly 
              available APIs. We do not claim ownership of any content displayed and act solely as 
              a technical interface to existing public resources. The Platform functions similarly 
              to a search engine or web browser, providing links and embeds to content hosted elsewhere.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>3. DMCA Compliance</h3>
            <p>
              We respect intellectual property rights and comply with the Digital Millennium Copyright 
              Act (DMCA). If you believe that content accessible through our Platform infringes your 
              copyright, please note that we do not host any content directly. However, we will 
              promptly remove any links or references to infringing content upon receiving a valid 
              DMCA takedown notice. To submit a notice, please include: (a) identification of the 
              copyrighted work, (b) identification of the infringing material, (c) your contact 
              information, (d) a statement of good faith belief, and (e) a statement of accuracy 
              under penalty of perjury.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>4. No Warranty</h3>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF 
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT 
              WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR 
              OTHER HARMFUL COMPONENTS. USE OF THE PLATFORM IS AT YOUR OWN RISK.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>5. Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE PLATFORM, 
              ITS CREATOR, OR ANY AFFILIATED PARTIES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, 
              USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (A) YOUR ACCESS TO OR USE OF 
              OR INABILITY TO ACCESS OR USE THE PLATFORM; (B) ANY CONDUCT OR CONTENT OF ANY THIRD 
              PARTY ON THE PLATFORM; (C) ANY CONTENT OBTAINED FROM THE PLATFORM; OR (D) UNAUTHORIZED 
              ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>6. User Responsibilities</h3>
            <p>
              By using the Platform, you agree to: (a) comply with all applicable local, state, 
              national, and international laws and regulations; (b) not use the Platform for any 
              unlawful purpose; (c) not attempt to gain unauthorized access to any portion of the 
              Platform; (d) not interfere with or disrupt the Platform or servers connected to it; 
              and (e) accept full responsibility for your use of the Platform and any content you 
              access through it.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>7. Privacy & Data Collection</h3>
            <p>
              The Platform uses anonymized tracking for analytics purposes only. We do not collect, 
              store, or process any personally identifiable information (PII). All user identifiers 
              are randomly generated and stored locally in your browser. We do not use cookies for 
              tracking purposes beyond session management. No data is sold, shared, or transferred 
              to third parties. You may clear all locally stored data at any time by clearing your 
              browser's local storage.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>8. Third-Party Services</h3>
            <p>
              The Platform may contain links to or integrate with third-party websites, services, 
              or content providers. We are not responsible for the content, privacy policies, or 
              practices of any third-party services. Your interactions with third-party services 
              are governed by their respective terms and policies.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>9. Indemnification</h3>
            <p>
              You agree to defend, indemnify, and hold harmless the Platform and its creator from 
              and against any claims, liabilities, damages, judgments, awards, losses, costs, 
              expenses, or fees (including reasonable attorneys' fees) arising out of or relating 
              to your violation of these terms or your use of the Platform.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>10. Modifications</h3>
            <p>
              We reserve the right to modify or discontinue the Platform at any time without notice. 
              We shall not be liable to you or any third party for any modification, suspension, or 
              discontinuance of the Platform. These terms may be updated from time to time, and 
              continued use of the Platform constitutes acceptance of any changes.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>11. Governing Law</h3>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws, 
              without regard to conflict of law principles. Any disputes arising from these terms 
              or your use of the Platform shall be resolved through binding arbitration in accordance 
              with applicable arbitration rules.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>12. Severability</h3>
            <p>
              If any provision of these terms is held to be invalid or unenforceable, such provision 
              shall be struck and the remaining provisions shall be enforced to the fullest extent 
              under law.
            </p>
          </div>

          <div className={styles.legalBlock}>
            <h3>13. Entire Agreement</h3>
            <p>
              These terms constitute the entire agreement between you and the Platform regarding 
              your use of the Platform and supersede all prior agreements and understandings.
            </p>
          </div>

          <div className={styles.legalFooter}>
            <p>Last Updated: November 2025</p>
            <p>
              By using Flyx, you acknowledge that you have read, understood, and agree to be bound 
              by these terms and conditions.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>Built with ❤️ and way too much caffeine</p>
        <p className={styles.footerNote}>© 2025 Flyx - A Personal Project</p>
      </footer>
    </div>
  );
}
