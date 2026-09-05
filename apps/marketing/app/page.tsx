import { CtaSection } from "@/components/marketing/cta-section"
import { FaqSection } from "@/components/marketing/faq-section"
import { HeroSection } from "@/components/marketing/hero-section"
import { IntegrationsSection } from "@/components/marketing/integrations-section"
import { ProcessSection } from "@/components/marketing/process-section"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { StartCodingSection } from "@/components/marketing/start-coding-section"

export default function HomePage() {
  return <main className="marketing-page"><section className="dark-section hero-section" id="top"><SiteHeader /><HeroSection /></section><ProcessSection /><StartCodingSection /><IntegrationsSection /><FaqSection /><section className="dark-section"><CtaSection /><SiteFooter /></section></main>
}
