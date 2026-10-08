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

const WIDGET_COPY = {
  en: {
    launcher: "Feedback",
    title: "Share an idea",
    close: "Close feedback form",
    ideaTitle: "What would you like to see?",
    details: "Add more detail (optional)",
    email: "Your email",
    emailHelp: "Your email lets the team follow up about this idea. It isn’t shown on the public board.",
    submit: "Share idea",
    sending: "Sending…",
    success: "Thanks — your idea has been shared.",
    error: "We couldn’t send your idea. Check your connection and try again.",
  },
  zh: {
    launcher: "反馈",
    title: "分享想法",
    close: "关闭反馈表单",
    ideaTitle: "你希望产品增加或改进什么？",
    details: "补充一些背景，帮助我们理解这个想法（选填）",
    email: "你的邮箱",
    emailHelp: "团队会通过邮箱跟进这个想法；邮箱不会显示在公开面板上。",
    submit: "提交想法",
    sending: "正在提交…",
    success: "感谢分享，想法已提交。",
    error: "想法提交失败，请检查网络后重试。",
  },
} as const;

export function mountWidget(
  config: WidgetConfig,
  onSubmit: (payload: FormSubmitPayload) => Promise<void>,
): MountedWidget {
  const copy = WIDGET_COPY[config.locale];
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
      .fh-helper { margin: -4px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }

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
      .fh-success {
        display: none; margin: 0; padding: 8px 10px; border-radius: 8px;
        background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 13px;
      }
      .fh-success.fh-visible { display: block; }

      /* 蜜罐字段：视觉隐藏但仍存在于 DOM/tab 顺序之外，正常用户看不到也填不到，
         简单脚本容易照单全收，见 docs/ARCHITECTURE.md 防刷三层设计 */
      .fh-hp {
        position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        .fh-button, .fh-panel, .fh-panel button[type="submit"] { transition: none !important; }
      }
    </style>
    <button class="fh-button" type="button" aria-expanded="false" aria-controls="feedbackport-widget-panel">💬 ${copy.launcher}</button>
    <form class="fh-panel" id="feedbackport-widget-panel">
      <div class="fh-header">
        <p class="fh-title">${copy.title}</p>
        <button class="fh-close" type="button" aria-label="${copy.close}">×</button>
      </div>
      <div class="fh-body">
        <input name="title" aria-label="${copy.ideaTitle}" placeholder="${copy.ideaTitle}" required maxlength="120" />
        <textarea name="body" aria-label="${copy.details}" placeholder="${copy.details}" maxlength="2000"></textarea>
        <input name="submitterEmail" type="email" aria-label="${copy.email}" aria-describedby="feedbackport-email-help" placeholder="${copy.email}" required />
        <p class="fh-helper" id="feedbackport-email-help">${copy.emailHelp}</p>
        <input class="fh-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="fh-turnstile"></div>
        <p class="fh-error" role="alert"></p>
        <p class="fh-success" role="status"></p>
        <button type="submit">${copy.submit}</button>
      </div>
    </form>
  `;

  const button = shadow.querySelector<HTMLButtonElement>(".fh-button")!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".fh-close")!;
  const panel = shadow.querySelector<HTMLFormElement>(".fh-panel")!;
  const submitButton = shadow.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const errorEl = shadow.querySelector<HTMLParagraphElement>(".fh-error")!;
  const successEl = shadow.querySelector<HTMLParagraphElement>(".fh-success")!;
  const turnstileContainer = shadow.querySelector<HTMLDivElement>(".fh-turnstile")!;
  const emailInput = shadow.querySelector<HTMLInputElement>('input[name="submitterEmail"]')!;
  emailInput.value = config.userEmail ?? "";
  let closeTimer: number | undefined;

  function openPanel() {
    window.clearTimeout(closeTimer);
    panel.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    // 先 display:block 再下一帧加 fh-visible，让 opacity/transform 过渡能触发
    requestAnimationFrame(() => panel.classList.add("fh-visible"));
  }

  function closePanel() {
    panel.classList.remove("fh-visible");
    button.setAttribute("aria-expanded", "false");
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
    successEl.classList.remove("fh-visible");
    submitButton.disabled = true;
    submitButton.textContent = copy.sending;

    const formData = new FormData(panel);
    void onSubmit({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      submitterEmail: String(formData.get("submitterEmail") ?? ""),
      honeypot: String(formData.get("website") ?? ""),
    })
      .then(() => {
        panel.reset();
        successEl.textContent = copy.success;
        successEl.classList.add("fh-visible");
      })
      .catch(() => {
        errorEl.textContent = copy.error;
        errorEl.classList.add("fh-visible");
      })
      .finally(() => {
        submitButton.disabled = false;
        submitButton.textContent = copy.submit;
      });
  });

  for (const field of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not(.fh-hp), textarea")) {
    field.addEventListener("input", () => successEl.classList.remove("fh-visible"));
  }

  return { turnstileContainer };
}
