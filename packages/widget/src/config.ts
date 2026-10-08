/**
 * 从当前 <script> 标签的 data-* 属性解析初始化参数，见 docs/API.md 的 "Widget 初始化参数"。
 */
export interface WidgetConfig {
  productSlug: string;
  userEmail?: string;
  apiBase: string;
  turnstileSiteKey: string;
}

export class WidgetConfigError extends Error {}

export function readConfig(script: HTMLOrSVGScriptElement | null): WidgetConfig {
  if (!script || !("dataset" in script)) {
    throw new WidgetConfigError(
      "无法定位加载 widget.js 的 <script> 标签，请确认脚本未被异步搬运或克隆",
    );
  }

  const productSlug = (script as HTMLScriptElement).dataset.product;
  if (!productSlug) {
    throw new WidgetConfigError("缺少必填的 data-product 属性，见 docs/INTEGRATION.md");
  }

  const turnstileSiteKey = (script as HTMLScriptElement).dataset.turnstileSiteKey;
  if (!turnstileSiteKey) {
    throw new WidgetConfigError("缺少必填的 data-turnstile-site-key 属性，见 docs/INTEGRATION.md");
  }

  const scriptElement = script as HTMLScriptElement;
  const configuredApiBase = scriptElement.dataset.apiBase?.trim();
  const scriptOrigin = new URL(scriptElement.src || window.location.href, window.location.href).origin;

  return {
    productSlug,
    userEmail: scriptElement.dataset.userEmail || undefined,
    apiBase: (configuredApiBase || (scriptOrigin === "null" ? "" : scriptOrigin)).replace(/\/$/, ""),
    turnstileSiteKey,
  };
}
