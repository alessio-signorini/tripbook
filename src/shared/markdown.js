import { Marked } from 'marked';

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeHref = (href) => /^(https?:|mailto:|\/|#)/i.test(href || '');

const marked = new Marked({
  gfm: false,
  breaks: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      if (!safeHref(href)) return inner;
      return `<a href="${escapeHtml(href)}" rel="noopener">${inner}</a>`;
    },
    image: ({ text }) => escapeHtml(text || ''),
    heading(token) {
      return `<p><strong>${this.parser.parseInline(token.tokens)}</strong></p>\n`;
    },
    hr: () => '',
  },
});

export function renderMarkdown(text) {
  if (!text || !String(text).trim()) return '';
  return marked.parse(String(text));
}

/** Plain text version (links keep their label), for descriptions and JSON-LD. */
export function stripMarkdown(text, max) {
  const plain = String(text || '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return max && plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain;
}
