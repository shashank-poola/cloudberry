"use client"

import { useState } from "react"
import { BrandMark } from "./brand-mark"

const links = [["The box", "#box"], ["Workflow", "#workflow"], ["FAQ", "#faq"]]

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header shell">
      <BrandMark invert />
      <nav className={`header-nav${menuOpen ? " header-nav-open" : ""}`} aria-label="Primary navigation">
        {links.map(([label, href]) => <a href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
      </nav>
      <div className="header-actions"><a className="header-sign-in" href="#start">Sign in</a><a className="button button-light button-small" href="#start">Get started <span aria-hidden="true">↗</span></a></div>
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
    </header>
  )
}
