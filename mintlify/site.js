const NAVIGATION = [
  {
    group: "Get started",
    icon: "play",
    pages: [{ path: "introduction", title: "Introduction", source: "introduction.mdx", icon: "book-open" }],
  },
  {
    group: "Core concepts",
    icon: "layers",
    pages: [
      { path: "core-concepts/company-brain", title: "Company brain", source: "core-concepts/company-brain.mdx", icon: "brain" },
      { path: "core-concepts/knowledge-base", title: "Knowledge base", source: "core-concepts/knowledge-base.mdx", icon: "database" },
      { path: "core-concepts/cloudpedia", title: "Cloudpedia", source: "core-concepts/cloudpedia.mdx", icon: "sparkles" },
      { path: "core-concepts/organizations", title: "Workspaces", source: "core-concepts/organizations.mdx", icon: "users" },
    ],
  },
  {
    group: "Guides",
    icon: "book-open",
    pages: [
      { path: "guides/getting-started", title: "Getting started", source: "guides/getting-started.mdx", icon: "rocket" },
      { path: "guides/using-chat", title: "Using Chat", source: "guides/using-chat.mdx", icon: "message-circle" },
      { path: "guides/managing-your-workspace", title: "Manage workspace", source: "guides/managing-your-workspace.mdx", icon: "settings" },
      { path: "guides/troubleshooting", title: "Troubleshooting", source: "guides/troubleshooting.mdx", icon: "circle-help" },
    ],
  },
  {
    group: "Integrations",
    icon: "plug",
    pages: [
      { path: "integrations/overview", title: "Integrations", source: "integrations/overview.mdx", icon: "plug" },
      { path: "integrations/slack", title: "Slack", source: "integrations/slack.mdx", icon: "hash" },
      { path: "integrations/linear", title: "Linear", source: "integrations/linear.mdx", icon: "circle-dot" },
      { path: "integrations/github", title: "GitHub", source: "integrations/github.mdx", icon: "github" },
      { path: "integrations/codex", title: "Codex", source: "integrations/codex.mdx", icon: "bot" },
    ],
  },
  {
    group: "Computer",
    icon: "monitor",
    pages: [
      { path: "computer/overview", title: "Computer", source: "computer/overview.mdx", icon: "monitor" },
      { path: "computer/provisioning", title: "Provision computer", source: "computer/provisioning.mdx", icon: "plus-square" },
    ],
  },
  {
    group: "API reference",
    icon: "code",
    pages: [
      { path: "api-reference/overview", title: "API overview", source: "api-reference/overview.mdx", icon: "code" },
      { path: "api-reference/authentication", title: "Authentication", source: "api-reference/authentication.mdx", icon: "lock" },
      { path: "api-reference/chat", title: "Chat API", source: "api-reference/chat.mdx", icon: "message-square" },
      { path: "api-reference/integrations", title: "Integrations API", source: "api-reference/integrations.mdx", icon: "plug" },
      { path: "api-reference/computer", title: "Computer API", source: "api-reference/computer.mdx", icon: "monitor" },
    ],
  },
  {
    group: "Snippets",
    icon: "braces",
    pages: [{ path: "snippets/authenticated-request", title: "Authenticated request", source: "snippets/authenticated-request.mdx", icon: "file-code" }],
  },
];

const PAGES = NAVIGATION.flatMap((section) => section.pages);
const PAGE_BY_PATH = new Map(PAGES.map((page) => [page.path, page]));
const ICON_PATHS = {
  play: '<path d="m8 5 10 7-10 7V5Z"></path>',
  layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"></path><path d="m4 12 8 4.5 8-4.5"></path><path d="m4 16.5 8 4.5 8-4.5"></path>',
  "book-open": '<path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h5v16H6a2.5 2.5 0 0 0-2.5 2.5v-16Z"></path><path d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-7v16h7a2.5 2.5 0 0 1 2.5 2.5v-16Z"></path>',
  brain: '<path d="M9.5 4.5A3 3 0 0 0 4 6.2a3.2 3.2 0 0 0 .5 5.8A3.5 3.5 0 0 0 8 17.5c.7 0 1.3-.2 1.8-.5"></path><path d="M14.5 4.5A3 3 0 0 1 20 6.2a3.2 3.2 0 0 1-.5 5.8 3.5 3.5 0 0 1-3.5 5.5c-.7 0-1.3-.2-1.8-.5"></path><path d="M9.5 4.5v15M14.5 4.5v15M5 9h4.5M14.5 9H19M7.5 14h2M14.5 14h2"></path>',
  database: '<ellipse cx="12" cy="5" rx="7.5" ry="3"></ellipse><path d="M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"></path><path d="M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7"></path>',
  sparkles: '<path d="m12 3-1.3 4.2L7 8.5l3.7 1.3L12 14l1.3-4.2L17 8.5l-3.7-1.3L12 3Z"></path><path d="m19 14-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7L19 14ZM5 14l-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Z"></path>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"></path><circle cx="9.5" cy="7" r="3.5"></circle><path d="M17 11a3.5 3.5 0 1 0-1.2-6.8M21 20v-1.5a4 4 0 0 0-2.8-3.8"></path>',
  rocket: '<path d="M14 4c2-2 5.5-2 6-2-.1.5 0 4-2 6l-5.5 5.5-4-4L14 4Z"></path><path d="m8.5 9.5-4 1.5-2 4 5-1M14.5 15.5l-1.5 4-4 2 1-5"></path><circle cx="16.5" cy="5.5" r="1.5"></circle>',
  "message-circle": '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.2 8.2 0 0 1-3.4-.7L4 20l1.7-4.2A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"></path>',
  settings: '<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"></path><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.7 12 2 2 0 1 1 5.7 12a2 2 0 0 0-1.3-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 10.6 4V3.8a2 2 0 1 1 4 0V4A2 2 0 0 0 18 5.8l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 22 12a2 2 0 0 1-2.6 3Z"></path>',
  "circle-help": '<circle cx="12" cy="12" r="9"></circle><path d="M9.7 9a2.4 2.4 0 1 1 3.8 1.9c-.9.6-1.5 1.1-1.5 2.6"></path><path d="M12 17h.01"></path>',
  plug: '<path d="M9 7V3M15 7V3M7 7h10v3a5 5 0 0 1-10 0V7ZM12 15v6"></path>',
  hash: '<path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"></path>',
  "circle-dot": '<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="2"></circle>',
  github: '<path d="M15 22v-3.2c0-1.1-.4-1.9-1-2.3 3.3-.4 6.8-1.6 6.8-7.2 0-1.6-.6-2.9-1.6-3.9.2-.4.7-1.9-.2-3.9 0 0-1.3-.4-4.1 1.5a14.2 14.2 0 0 0-7.5 0C4.6 1.2 3.3 1.6 3.3 1.6c-.9 2-.4 3.5-.2 3.9-1 1-1.6 2.3-1.6 3.9 0 5.6 3.5 6.8 6.8 7.2-.6.5-1 1.3-1 2.6V22"></path><path d="M6 18c-3 .9-3-1.5-4.2-1.8"></path>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="3"></rect><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"></path>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
  "plus-square": '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M12 8v8M8 12h8"></path>',
  code: '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"></path>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
  "message-square": '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-1-2V5Z"></path>',
  braces: '<path d="M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2"></path>',
  "file-code": '<path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path><path d="M14 3v5h5M9 14l-2 2 2 2M15 14l2 2-2 2"></path>',
  chevron: '<path d="m9 5 6 7-6 7"></path>',
};

function icon(name, className = "") {
  return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" focusable="false">${ICON_PATHS[name] || ICON_PATHS["file-code"]}</svg>`;
}

const docsApp = document.getElementById("docs-app");
const docsSidebar = document.getElementById("docs-sidebar");
const docsNav = document.getElementById("docs-nav");
const docsSearch = document.getElementById("docs-search");
const searchTrigger = document.getElementById("search-trigger");
const searchDialogBackdrop = document.getElementById("search-dialog-backdrop");
const docsArticle = document.getElementById("docs-article");
const docsToc = document.getElementById("docs-toc");
const tocLinks = document.getElementById("toc-links");
const mobileMenuButton = document.getElementById("mobile-menu-button");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarExpand = document.getElementById("sidebar-expand");
const collapsedSearchToggle = document.getElementById("collapsed-search-toggle");
let tocObserver;
let activePath = "introduction";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(value) {
  const href = String(value).trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  return "#";
}

function internalPathFromHref(value) {
  const href = String(value).trim();
  if (!href.startsWith("/")) return null;
  const path = href.replace(/^\/+/, "").replace(/\/$/, "");
  return PAGE_BY_PATH.has(path) ? path : null;
}

function renderInline(value) {
  const tokens = [];
  const stash = (html) => {
    const token = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };
  let output = escapeHtml(value);

  output = output.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${code}</code>`));
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
    const path = internalPathFromHref(href);
    if (path) {
      return stash(`<a href="#${escapeHtml(path)}" data-doc-path="${escapeHtml(path)}">${label}</a>`);
    }
    const externalHref = safeHref(href);
    return stash(`<a href="${escapeHtml(externalHref)}" target="_blank" rel="noreferrer">${label}</a>`);
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  output = output.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");

  return output.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

function slugify(value) {
  const slug = value
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || "section";
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function isListLine(line) {
  return /^(?:[-*]\s+|\d+\.\s+)/.test(line);
}

function isBlockStart(line, nextLine = "") {
  return /^#{1,6}\s+/.test(line) || /^```/.test(line) || /^>\s?/.test(line) || isListLine(line) || /^\|/.test(line) || /^---+$/.test(line) || (/^\|/.test(nextLine) && isTableSeparator(line));
}

function parseFrontmatter(source, fallbackTitle) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const metadata = { title: fallbackTitle, description: "" };
  if (!match) return { metadata, body: source };

  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "title") metadata.title = value;
    if (key === "description") metadata.description = value;
  }
  return { metadata, body: source.slice(match[0].length) };
}

function renderMarkdown(source) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const headings = [];
  const usedIds = new Map();
  let html = "";
  let index = 0;

  const headingId = (text) => {
    const base = slugify(text);
    const count = usedIds.get(base) || 0;
    usedIds.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
      html += `<pre><code${language}>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1) {
        index += 1;
        continue;
      }
      const id = headingId(text);
      if (level === 2 || level === 3) headings.push({ id, level, text: text.replace(/[`*_]/g, "") });
      html += `<h${level} id="${id}">${renderInline(text)}</h${level}>`;
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      html += "<hr>";
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      html += `<blockquote>${quoteLines.map((quote) => `<p>${renderInline(quote)}</p>`).join("")}</blockquote>`;
      continue;
    }

    if (/^\|/.test(line) && isTableSeparator(lines[index + 1] || "")) {
      const headerCells = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|/.test(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      html += `<table><thead><tr>${headerCells.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headerCells.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      continue;
    }

    if (isListLine(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const itemPattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/;
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(itemPattern);
        if (!item) break;
        items.push(`<li>${renderInline(item[1])}</li>`);
        index += 1;
      }
      html += `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index], lines[index + 1] || "")) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    html += `<p>${renderInline(paragraphLines.join(" "))}</p>`;
  }

  return { html, headings };
}

function renderNavigation(query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  docsNav.innerHTML = NAVIGATION.map((section) => {
    const visiblePages = section.pages.filter((page) => !normalizedQuery || `${section.group} ${page.title}`.toLowerCase().includes(normalizedQuery));
    if (!visiblePages.length) return "";
    const links = visiblePages
      .map((page) => `<a class="nav-link${page.path === activePath ? " is-active" : ""}" href="#${page.path}" data-doc-path="${page.path}">${icon(page.icon)}<span>${escapeHtml(page.title)}</span></a>`)
      .join("");
    return `<section class="nav-group" data-nav-group="${escapeHtml(section.group)}"><button class="nav-group-heading" type="button" aria-expanded="true">${icon(section.icon)}<span>${escapeHtml(section.group)}</span>${icon("chevron", "nav-chevron")}</button><div class="nav-link-list">${links}</div></section>`;
  }).join("");

  docsNav.querySelectorAll(".nav-group-heading").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest(".nav-group");
      const collapsed = group.classList.toggle("is-collapsed");
      button.setAttribute("aria-expanded", String(!collapsed));
    });
  });
}

function renderToc(headings) {
  if (!headings.length) {
    docsToc.classList.add("is-empty");
    tocLinks.innerHTML = "";
    return;
  }
  docsToc.classList.remove("is-empty");

  let section = -1;
  tocLinks.innerHTML = headings.map((heading, index) => {
    const isSectionStart = heading.level === 2 || index === 0;
    if (heading.level === 2) section += 1;
    return `<a class="toc-link level-${heading.level}${isSectionStart ? " is-section-start" : ""}" href="#${heading.id}" data-toc-id="${heading.id}" data-toc-section="${section}">${escapeHtml(heading.text)}</a>`;
  }).join("");

  const updateActive = (id) => {
    const activeLink = [...tocLinks.querySelectorAll(".toc-link")].find((link) => link.dataset.tocId === id);
    const activeSection = activeLink?.dataset.tocSection;
    tocLinks.querySelectorAll(".toc-link").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.tocId === id);
      link.classList.toggle("is-section-active", activeSection !== undefined && link.dataset.tocSection === activeSection);
    });
  };

  tocLinks.querySelectorAll(".toc-link").forEach((link) => {
    link.addEventListener("click", () => updateActive(link.dataset.tocId));
  });
  updateActive(headings[0].id);

  if (tocObserver) tocObserver.disconnect();
  if (typeof IntersectionObserver === "undefined") return;
  tocObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) updateActive(visible.target.id);
  }, { rootMargin: "-58px 0px -70% 0px", threshold: [0, 1] });
  headings.forEach((heading) => {
    const element = document.getElementById(heading.id);
    if (element) tocObserver.observe(element);
  });
}

function pageActionsMarkup() {
  return `<div class="page-actions" aria-label="Page actions"><button class="page-action" id="copy-markdown" type="button"><span class="action-code" aria-hidden="true">&lt;/&gt;</span><span data-action-label>Copy Markdown</span></button><button class="page-action" id="open-source" type="button"><span data-action-label>Open in</span><span class="action-arrow" aria-hidden="true">↓</span></button></div>`;
}

async function copyMarkdown(page, source) {
  let markdown = source;
  if (!markdown) {
    const response = await fetch(page.source, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${page.source}`);
    markdown = await response.text();
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(markdown);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = markdown;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access was denied");
}

function attachPageActions(page, source) {
  const copyButton = document.getElementById("copy-markdown");
  const openButton = document.getElementById("open-source");
  if (!copyButton || !openButton) return;

  copyButton.addEventListener("click", async () => {
    const label = copyButton.querySelector("[data-action-label]");
    try {
      await copyMarkdown(page, source);
      if (label) label.textContent = "Copied";
      window.setTimeout(() => {
        if (label) label.textContent = "Copy Markdown";
      }, 1600);
    } catch (error) {
      if (label) label.textContent = "Copy failed";
      window.setTimeout(() => {
        if (label) label.textContent = "Copy Markdown";
      }, 1600);
    }
  });

  openButton.addEventListener("click", () => {
    window.open(page.source, "_blank", "noopener,noreferrer");
  });
}

function renderArticle(page, metadata, body, source) {
  const rendered = renderMarkdown(body);
  const firstSectionIndex = rendered.html.search(/<h2\b/);
  const content = firstSectionIndex < 0
    ? `${rendered.html}${pageActionsMarkup()}`
    : `${rendered.html.slice(0, firstSectionIndex)}${pageActionsMarkup()}${rendered.html.slice(firstSectionIndex)}`;
  docsArticle.innerHTML = `<header class="article-header"><h1>${escapeHtml(metadata.title || page.title)}</h1></header>${content}`;
  docsArticle.dataset.initialPage = "";
  document.title = `${metadata.title || page.title} · Cloudberry docs`;
  attachPageActions(page, source);
  renderToc(rendered.headings);
}

function showLoadError(page) {
  docsArticle.innerHTML = `<header class="article-header"><h1>${escapeHtml(page.title)}</h1></header><div class="load-error">This page could not be loaded in the browser. Serve the <code>mintlify</code> directory over HTTP to load its MDX source.</div>`;
  renderToc([]);
}

async function loadPage(path, options = {}) {
  const page = PAGE_BY_PATH.get(path) || PAGE_BY_PATH.get("introduction");
  activePath = page.path;
  renderNavigation(docsSearch.value);
  closeMobileNavigation();

  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "auto" });

  try {
    const response = await fetch(page.source, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${page.source}`);
    const source = await response.text();
    const parsed = parseFrontmatter(source, page.title);
    renderArticle(page, parsed.metadata, parsed.body, source);
  } catch (error) {
    if (page.path !== "introduction" || !docsArticle.querySelector("h1")) showLoadError(page);
    else renderToc([...docsArticle.querySelectorAll("h2, h3")].map((heading) => ({ id: heading.id, level: Number(heading.tagName.slice(1)), text: heading.textContent })));
  }
}

function currentPath() {
  const path = decodeURIComponent(window.location.hash.slice(1)).replace(/^\//, "").replace(/\/$/, "");
  return PAGE_BY_PATH.has(path) ? path : "introduction";
}

function closeMobileNavigation() {
  docsSidebar.classList.remove("is-open");
  mobileMenuButton?.setAttribute("aria-expanded", "false");
}

let searchReturnTarget = searchTrigger;

function openSearch(opener = searchTrigger) {
  if (!searchDialogBackdrop || !docsSearch) return;
  searchReturnTarget = opener || searchTrigger;
  searchDialogBackdrop.hidden = false;
  document.body.classList.add("search-open");
  searchTrigger?.setAttribute("aria-expanded", "true");
  docsSearch.focus();
  docsSearch.select();
}

function closeSearch(restoreFocus = true) {
  if (!searchDialogBackdrop || searchDialogBackdrop.hidden) return;
  searchDialogBackdrop.hidden = true;
  document.body.classList.remove("search-open");
  searchTrigger?.setAttribute("aria-expanded", "false");
  if (restoreFocus) searchReturnTarget?.focus();
}

searchTrigger?.addEventListener("click", () => openSearch(searchTrigger));
searchDialogBackdrop?.addEventListener("click", (event) => {
  if (event.target === searchDialogBackdrop) closeSearch();
});

docsNav.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-doc-path]");
  if (!link) return;
  event.preventDefault();
  closeSearch(false);
  window.location.hash = link.dataset.docPath;
});

docsArticle.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-doc-path]");
  if (!link) return;
  event.preventDefault();
  window.location.hash = link.dataset.docPath;
});

docsSearch.addEventListener("input", () => renderNavigation(docsSearch.value));

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch(event.target instanceof HTMLElement ? event.target : searchTrigger);
    return;
  }

  if (event.key === "Escape" && searchDialogBackdrop && !searchDialogBackdrop.hidden) {
    event.preventDefault();
    closeSearch();
  }
});

function setSidebarCollapsed(collapsed) {
  docsApp.classList.toggle("sidebar-collapsed", collapsed);
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
}

sidebarToggle.addEventListener("click", () => setSidebarCollapsed(true));
sidebarExpand?.addEventListener("click", () => setSidebarCollapsed(false));
collapsedSearchToggle?.addEventListener("click", () => openSearch(collapsedSearchToggle));

mobileMenuButton?.addEventListener("click", () => {
  const open = docsSidebar.classList.toggle("is-open");
  mobileMenuButton.setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", () => {
  const hashPath = currentPath();
  if (hashPath !== activePath) loadPage(hashPath);
});

renderNavigation();
renderToc([...docsArticle.querySelectorAll("h2, h3")].map((heading) => ({ id: heading.id, level: Number(heading.tagName.slice(1)), text: heading.textContent })));
attachPageActions(PAGE_BY_PATH.get("introduction"), "");
loadPage(currentPath(), { keepScroll: true });
