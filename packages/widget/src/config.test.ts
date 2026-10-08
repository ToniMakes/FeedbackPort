import { describe, expect, it } from "vitest";
import { readConfig, WidgetConfigError } from "./config";

function makeScript(dataset: Record<string, string>): HTMLScriptElement {
  const script = document.createElement("script");
  for (const [key, value] of Object.entries(dataset)) {
    script.dataset[key] = value;
  }
  return script;
}

describe("readConfig", () => {
  it("parses the required productSlug and turnstileSiteKey", () => {
    const config = readConfig(makeScript({ product: "cardwhisper", turnstileSiteKey: "1x00000000000000000000AA" }));
    expect(config.productSlug).toBe("cardwhisper");
    expect(config.turnstileSiteKey).toBe("1x00000000000000000000AA");
    expect(config.userEmail).toBeUndefined();
  });

  it("parses the optional userEmail and apiBase", () => {
    const config = readConfig(
      makeScript({
        product: "cardwhisper",
        turnstileSiteKey: "1x00000000000000000000AA",
        userEmail: "a@b.com",
        apiBase: "https://api.example.com",
      }),
    );
    expect(config.userEmail).toBe("a@b.com");
    expect(config.apiBase).toBe("https://api.example.com");
  });

  it("throws WidgetConfigError when data-product is missing", () => {
    expect(() => readConfig(makeScript({ turnstileSiteKey: "1x00000000000000000000AA" }))).toThrow(
      WidgetConfigError,
    );
  });

  it("throws WidgetConfigError when data-turnstile-site-key is missing", () => {
    expect(() => readConfig(makeScript({ product: "cardwhisper" }))).toThrow(WidgetConfigError);
  });

  it("throws WidgetConfigError when script is null", () => {
    expect(() => readConfig(null)).toThrow(WidgetConfigError);
  });
});
