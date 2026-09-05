const steps = [
  { number: "01", title: "Spin up a box", body: "One command gives every agent a clean, reproducible workspace.", tone: "blue" },
  { number: "02", title: "Keep context close", body: "Files, dependencies, and ports stay ready while you move fast.", tone: "amber" },
  { number: "03", title: "Let it run", body: "Long jobs keep working even after you close your laptop.", tone: "pink" },
  { number: "04", title: "Ship with confidence", body: "Review the work, merge cleanly, and keep the loop moving.", tone: "orange" },
]

function BrowserMockup() {
  return (
    <div className="browser-mockup">
      <div className="browser-sidebar"><div className="mock-brand"><span className="mini-mark" /> <b>berry</b></div><span className="mock-label">WORKSPACE</span><span className="mock-link mock-link-active">⌘ Overview</span><span className="mock-link">◈ Projects</span><span className="mock-link">◌ Activity</span><span className="mock-link">⚙ Settings</span><div className="mock-sidebar-spacer" /><span className="mock-link">? Help center</span></div>
      <div className="browser-main"><div className="mock-topbar"><span>Overview</span><span className="mock-avatar">S</span></div><div className="mock-heading"><div><span className="mock-kicker">MONDAY, SEPTEMBER 08</span><b>Your workspace</b></div><span className="mock-new">+ New box</span></div><div className="mock-metrics"><div><span>Active boxes</span><b>04</b></div><div><span>Agent hours</span><b>128.4</b></div><div><span>Build health</span><b className="green-text">98%</b></div></div><div className="mock-terminal"><div className="terminal-header"><span className="terminal-dot red" /><span className="terminal-dot yellow" /><span className="terminal-dot green" /><span>agent-runner / cloudberry</span></div><p><span className="green-text">✓</span> Preparing environment...</p><p><span className="green-text">✓</span> Syncing project files <span className="muted-text">12.4 MB</span></p><p><span className="blue-text">→</span> Agent is ready on <span className="purple-text">localhost:5000</span><span className="cursor" /></p></div></div>
    </div>
  )
}

export function ProcessSection() {
  return (
    <section className="light-section process-section" id="workflow">
      <div className="shell process-intro"><div><div className="eyebrow">THE CLOUD BERRY WAY</div><h2>A process tuned<br /><em>for momentum.</em></h2></div><p>Design, build, polish, and stay in sync.<br />Nothing gets lost in the handoff.</p></div>
      <div className="shell bento-frame"><div className="bento-visual"><BrowserMockup /></div><div className="bento-visual bento-visual-terminal"><div className="floating-terminal"><span className="terminal-prompt">$</span><span>cloudberry create --name<br /><b>my-agent-box</b></span><span className="terminal-check">✓</span></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="orbit-label">ready in 12s</span></div>{steps.map((step) => <div className="step-card" key={step.number}><span className={`step-number step-${step.tone}`}>{step.number}</span><p><b>{step.title}</b><br /><span>{step.body}</span></p></div>)}</div>
    </section>
  )
}
