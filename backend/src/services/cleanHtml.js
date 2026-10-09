// src/services/cleanHtml.js
// Cleans the HTML that mammoth makes from a Word file, for the preview.
// (Replaces sanitize-html, which crashes on Vercel.)

const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "td", "th",
  "img", "blockquote", "pre", "code",
]);

const SAFE_IMG = /^data:image\/(png|jpe?g|gif|bmp|webp);base64,[a-z0-9+/=\s]+$/i;

export function cleanHtml(html) {
  return String(html || "").replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (tag, rawName, attrs) => {
    const name = rawName.toLowerCase();
    const closing = tag.startsWith("</");
    if (!ALLOWED.has(name)) return "";
    if (closing) return `</${name}>`;

    if (name === "img") {
      const src = (attrs.match(/\ssrc\s*=\s*"([^"]*)"/i) || [])[1] || "";
      return SAFE_IMG.test(src) ? `<img src="${src}" alt="">` : "";
    }
    if (name === "td" || name === "th") {
      const keep = [];
      for (const a of ["colspan", "rowspan"]) {
        const v = (attrs.match(new RegExp(`\\s${a}\\s*=\\s*"(\\d{1,3})"`, "i")) || [])[1];
        if (v) keep.push(`${a}="${v}"`);
      }
      return `<${name}${keep.length ? " " + keep.join(" ") : ""}>`;
    }
    return `<${name}>`;
  });
}