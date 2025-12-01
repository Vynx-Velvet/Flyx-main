import React from 'react';
import "./Footer.css"

const Footer = () => {
	return (
		<footer className="footer">
			<div className="footer-content">
				<div className="footer-main">
					<div className="footer-logo">
						<div className="footer-logo-container">
							<div className="footer-logo-icon">
								<svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="footer-logo-svg">
									<defs>
										<linearGradient id="footerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
											<stop offset="0%" stopColor="#6366f1" />
											<stop offset="50%" stopColor="#8b5cf6" />
											<stop offset="100%" stopColor="#06b6d4" />
										</linearGradient>
									</defs>
									<path d="M4 8L16 2L28 8V24L16 30L4 24V8Z" stroke="url(#footerLogoGradient)" strokeWidth="2" fill="rgba(99, 102, 241, 0.1)" />
									<circle cx="16" cy="16" r="6" fill="url(#footerLogoGradient)" />
									<path d="M12 16L15 19L20 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</div>
							<div className="footer-logo-text-container">
								<span className="footer-logo-text">FLYX</span>
								<div className="footer-logo-tagline">Stream Beyond Limits</div>
							</div>
						</div>
						<div className="footer-logo-glow"></div>
					</div>
					
					<div className="footer-links">
						<a href="/about" className="footer-link">About</a>
						<a href="#" className="footer-link">Privacy</a>
						<a href="#" className="footer-link">Terms</a>
						<a href="#" className="footer-link">Contact</a>
						<a href="#" className="footer-link">Support</a>
					</div>
					
					<div className="footer-social">
						<a href="#" className="social-icon" title="Twitter" aria-label="Follow us on Twitter">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
							</svg>
						</a>
						<a href="#" className="social-icon" title="Discord" aria-label="Join our Discord">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
							</svg>
						</a>
						<a href="https://github.com/Vynx-Velvet/Flyx-main" target="_blank" rel="noopener noreferrer" className="social-icon" title="GitHub" aria-label="View our GitHub">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
							</svg>
						</a>
						<a href="#" className="social-icon" title="Telegram" aria-label="Join our Telegram">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
							</svg>
						</a>
					</div>
				</div>
				
				<div className="footer-bottom">
					<div className="footer-left">
						<div className="footer-copyright">
							© 2024 Flyx • Made with <span className="heart">♥</span> by Vynx
						</div>
						<div className="footer-disclaimer">
							Educational purposes only • Not affiliated with any streaming service
						</div>
					</div>
					
					<div className="footer-right">
						<div className="tech-stack">
							<span className="tech-badge">Next.js 14</span>
							<span className="tech-badge">React</span>
							<span className="tech-badge">TMDB API</span>
							<span className="tech-badge">Node.js</span>
						</div>
						<div className="footer-status">
							<span className="status-indicator"></span>
							<span className="status-text">All systems operational</span>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
