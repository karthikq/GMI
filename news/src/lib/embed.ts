// Raw embed snippets (X blockquotes, Instagram, TikTok, any provider's embed
// code) travel through the editor as base64 in a data-embed-html attribute so
// quotes and angle brackets never corrupt the stored story HTML.

export function encodeEmbedHtml(html: string): string {
  const bytes = new TextEncoder().encode(html);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeEmbedHtml(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Injects raw embed markup into a container and re-creates every <script> as
// a fresh element — script tags placed via innerHTML never execute, but newly
// created ones do, which is what lets widgets.js/embed.js upgrade the markup
// (X blockquote → tweet card, etc.). Browser only.
export function injectEmbedHtml(container: HTMLElement, html: string): void {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const script of tpl.content.querySelectorAll("script")) {
    const live = document.createElement("script");
    for (const attr of Array.from(script.attributes)) {
      live.setAttribute(attr.name, attr.value);
    }
    if (!script.src) live.textContent = script.textContent;
    script.replaceWith(live);
  }
  container.replaceChildren(tpl.content);
}
