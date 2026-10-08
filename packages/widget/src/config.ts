/**
 * Parse init parameters from the current <script> tag's data-* attributes; see "Widget init parameters" in docs/API.md.
 */
export interface WidgetConfig {
  productSlug: string;
  userEmail?: string;
  apiBase: string;
  turnstileSiteKey: string;
  locale: "en" | "zh";
}

export class WidgetConfigError extends Error {}

export function readConfig(script: HTMLOrSVGScriptElement | null): WidgetConfig {
  if (!script || !("dataset" in script)) {
    throw new WidgetConfigError(
      "Could not locate the <script> tag that loaded widget.js; make sure the script wasn't moved or cloned asynchronously",
    );
  }

  const productSlug = (script as HTMLScriptElement).dataset.product;
  if (!productSlug) {
    throw new WidgetConfigError("Missing required data-product attribute; see docs/INTEGRATION.md");
  }

  const turnstileSiteKey = (script as HTMLScriptElement).dataset.turnstileSiteKey;
  if (!turnstileSiteKey) {
    throw new WidgetConfigError("Missing required data-turnstile-site-key attribute; see docs/INTEGRATION.md");
  }

  const scriptElement = script as HTMLScriptElement;
  const configuredApiBase = scriptElement.dataset.apiBase?.trim();
  const scriptOrigin = new URL(scriptElement.src || window.location.href, window.location.href).origin;
  const configuredLocale = scriptElement.dataset.lang?.trim().toLowerCase();
  const locale: "en" | "zh" = configuredLocale === "zh" || configuredLocale === "en"
    ? configuredLocale
    : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";

  return {
    productSlug,
    userEmail: scriptElement.dataset.userEmail || undefined,
    apiBase: (configuredApiBase || (scriptOrigin === "null" ? "" : scriptOrigin)).replace(/\/$/, ""),
    turnstileSiteKey,
    locale,
  };
}
