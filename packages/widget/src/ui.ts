import type { WidgetConfig } from "./config";

export interface FormSubmitPayload {
  title: string;
  body: string;
  submitterEmail: string;
  honeypot: string;
}

/**
 * 挂载到 Shadow DOM，避免样式和宿主页面冲突（见 docs/decisions/0002-tech-stack.md）。
 * 目前只是最小可用骨架：一个悬浮按钮 + 一个内联表单，没有做过渡动画/多步骤 UI，
 * 后续迭代（见 docs/ROADMAP.md）在此基础上扩展。
 */
export interface MountedWidget {
  turnstileContainer: HTMLElement;
}

export function mountWidget(
  config: WidgetConfig,
  onSubmit: (payload: FormSubmitPayload) => Promise<void>,
): MountedWidget {
  const host = document.createElement("div");
  host.id = "feedbackport-widget-root";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      }
      * { box-sizing: border-box; }

      .fh-button {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 11px 18px; border-radius: 999px; border: none; cursor: pointer;
        background: #5946d2; color: white; font: 600 14px inherit;
        box-shadow: 0 2px 8px rgba(32, 33, 38, 0.16);
        transition: transform 150ms cubic-bezier(0.2, 0.75, 0.25, 1), box-shadow 150ms ease, background 150ms ease;
      }
      .fh-button:hover { background: #4937bb; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(32, 33, 38, 0.2); }
      .fh-button:active { transform: translateY(0); }

      .fh-panel {
        position: fixed; right: 20px; bottom: 76px; z-index: 2147483647;
        width: 300px; max-width: calc(100vw - 40px);
        border-radius: 12px; background: white; color: #202126;
        box-shadow: 0 10px 28px rgba(32, 33, 38, 0.14);
        border: 1px solid #e8e8e6;
        font: 14px inherit;
        display: none;
        opacity: 0; transform: translateY(5px) scale(0.99);
        transition: opacity 210ms cubic-bezier(0.2, 0.75, 0.25, 1), transform 210ms cubic-bezier(0.2, 0.75, 0.25, 1);
      }
      .fh-panel.open { display: block; }
      .fh-panel.open.fh-visible { opacity: 1; transform: translateY(0) scale(1); }

      .fh-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
      }
      .fh-title { margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; }
      .fh-close {
        border: none; background: transparent; cursor: pointer; color: #94a3b8;
        font-size: 18px; line-height: 1; padding: 2px 4px; border-radius: 6px;
      }
      .fh-close:hover { background: #f1f5f9; color: #475569; }

      .fh-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; }

      .fh-panel input, .fh-panel textarea {
        width: 100%; padding: 9px 10px;
        border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; color: #0f172a;
        outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .fh-panel input::placeholder, .fh-panel textarea::placeholder { color: #94a3b8; }
      .fh-panel input:focus, .fh-panel textarea:focus {
        border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
      }
      .fh-panel textarea { min-height: 64px; resize: vertical; }

      .fh-panel button[type="submit"] {
        width: 100%; padding: 9px; border: none; border-radius: 8px;
        background: #4f46e5; color: white; font: 600 14px inherit; cursor: pointer;
        transition: background 0.15s ease;
      }
      .fh-panel button[type="submit"]:hover { background: #4338ca; }
      .fh-panel button[type="submit"]:disabled { background: #a5b4fc; cursor: not-allowed; }

      .fh-error {
        display: none; margin: 0; padding: 8px 10px; border-radius: 8px;
        background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 13px;
      }
      .fh-error.fh-visible { display: block; }

      /* 蜜罐字段：视觉隐藏但仍存在于 DOM/tab 顺序之外，正常用户看不到也填不到，
         简单脚本容易照单全收，见 docs/ARCHITECTURE.md 防刷三层设计 */
      .fh-hp {
        position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        .fh-button, .fh-panel, .fh-panel button[type="submit"] { transition: none !important; }
      }
    </style>
    <button class="fh-button" type="button">💬 Feedback</button>
    <form class="fh-panel">
      <div class="fh-header">
        <p class="fh-title">Share your feedback</p>
        <button class="fh-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="fh-body">
        <input name="title" placeholder="Summarize your idea" required maxlength="120" />
        <textarea name="body" placeholder="More details (optional)" maxlength="2000"></textarea>
        <input name="submitterEmail" type="email" placeholder="Your email" required value="${config.userEmail ?? ""}" />
        <input class="fh-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="fh-turnstile"></div>
        <p class="fh-error"></p>
        <button type="submit">Submit feedback</button>
      </div>
    </form>
  `;

  const button = shadow.querySelector<HTMLButtonElement>(".fh-button")!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".fh-close")!;
  const panel = shadow.querySelector<HTMLFormElement>(".fh-panel")!;
  const submitButton = shadow.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const errorEl = shadow.querySelector<HTMLParagraphElement>(".fh-error")!;
  const turnstileContainer = shadow.querySelector<HTMLDivElement>(".fh-turnstile")!;
  let closeTimer: number | undefined;

  function openPanel() {
    window.clearTimeout(closeTimer);
    panel.classList.add("open");
    // 先 display:block 再下一帧加 fh-visible，让 opacity/transform 过渡能触发
    requestAnimationFrame(() => panel.classList.add("fh-visible"));
  }

  function closePanel() {
    panel.classList.remove("fh-visible");
    window.clearTimeout(closeTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.classList.remove("open");
      return;
    }
    closeTimer = window.setTimeout(() => panel.classList.remove("open"), 220);
  }

  button.addEventListener("click", () => {
    if (panel.classList.contains("open")) closePanel();
    else openPanel();
  });
  closeButton.addEventListener("click", () => closePanel());

  panel.addEventListener("submit", (event) => {
    event.preventDefault();
    errorEl.classList.remove("fh-visible");
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";

    const formData = new FormData(panel);
    void onSubmit({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      submitterEmail: String(formData.get("submitterEmail") ?? ""),
      honeypot: String(formData.get("website") ?? ""),
    })
      .then(() => {
        closePanel();
        panel.reset();
      })
      .catch(() => {
        errorEl.textContent = "Submission failed. Please try again.";
        errorEl.classList.add("fh-visible");
      })
      .finally(() => {
        submitButton.disabled = false;
        submitButton.textContent = "Submit feedback";
      });
  });

  return { turnstileContainer };
}
