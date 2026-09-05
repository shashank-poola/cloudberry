function CodeWindow() {
  return (
    <div className="code-scene">
      <div className="code-window code-window-top">
        <div className="code-window-title">
          <span>{"// CREATE A BOX"}</span>
          <i>⌁</i>
        </div>
        <div className="code-title">
          cloudberry <strong>agent-box</strong>
          <span className="verified">✓</span>
        </div>
      </div>

      <div className="code-window code-window-main">
        <div className="code-window-title">
          <span>{"// CONNECT FROM LOCALHOST"}</span>
          <i>+</i>
        </div>
        <pre>
          <span className="syntax-green">cloudberry</span>{" "}
          connect{" "}
          <span className="syntax-purple">agent-box</span>
          {"\n"}
          <span className="syntax-muted">↳ syncing files</span>
          {"\n"}
          <span className="syntax-blue">↳ forwarding port 5000</span>
          {"\n"}
          <span className="syntax-muted">↳ agent is running</span>
        </pre>
      </div>

      <div className="code-window code-window-bottom">
        <div className="code-window-title">
          <span>{"// STATUS"}</span>
          <i>+</i>
        </div>
      </div>

      <div className="code-glow" />
    </div>
  )
}

const promises = [
  ["Built for agents", "Persistent machines for long-running work."],
  ["Your localhost, in the cloud", "Ports, files, and tooling feel familiar."],
  ["Works while you sleep", "Close the lid. The work keeps moving."],
  ["No infra homework", "Start from a clean box in one command."],
]

export function StartCodingSection() {
  return (
    <section className="dark-section start-section" id="box">
      <div className="shell start-grid">
        <div className="start-copy">
          <div className="eyebrow eyebrow-light">THE BOX</div>
          <h2>
            Start building
            <br />
            <em>today.</em>
          </h2>
          <p className="section-lede">
            Give your agents a real workspace with the familiar feel of localhost
            and the endurance of the cloud.
          </p>
          <div className="promise-list">
            {promises.map(([title, body]) => (
              <div className="promise" key={title}>
                <span className="promise-check">✓</span>
                <p>
                  <b>{title}</b>
                  <span>{body}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="inline-actions">
            <a className="button button-light" href="#start">
              Try for free <span aria-hidden="true">→</span>
            </a>
            <a className="button button-dark" href="#faq">
              Read the FAQ
            </a>
          </div>
        </div>
        <CodeWindow />
      </div>
    </section>
  )
}
