import { BrandMark } from "./brand-mark"

const footerLinks = ["The box", "Dashboard", "Compare", "FAQ", "Docs", "Pricing"]

export function SiteFooter() {
  return <footer className="site-footer shell"><div className="footer-main"><div><BrandMark invert={false} label={false} /><p>The dev box that feels like localhost.</p></div><nav aria-label="Footer navigation">{footerLinks.map((link) => <a href={link === "FAQ" ? "#faq" : link === "The box" ? "#box" : link === "Pricing" ? "#pricing" : "#top"} key={link}>{link}</a>)}<a href="mailto:hello@cloudberry.dev" className="button button-light button-small">Email us</a></nav></div><div className="footer-bottom"><span>© 2026 Cloudberry</span><a href="mailto:founders@cloudberry.dev">founders@cloudberry.dev</a><div className="social-links"><a href="#top" aria-label="X">𝕏</a><a href="#top" aria-label="LinkedIn">in</a></div></div></footer>
}
