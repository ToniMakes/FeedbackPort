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
        background: #4f46e5; color: white; font: 600 14px inherit;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      }
      .fh-button:hover { background: #4338ca; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(79, 70, 229, 0.4); }
      .fh-button:active { transform: translateY(0); }

      .fh-panel {
        position: fixed; right: 20px; bottom: 76px; z-index: 2147483647;
        width: 300px; max-width: calc(100vw - 40px);
        border-radius: 16px; background: white; color: #0f172a;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
        border: 1px solid #e2e8f0;
        font: 14px inherit;
        display: none;
        opacity: 0; transform: translateY(6px) scale(0.98);
        transition: opacity 0.15s ease, transform 0.15s ease;
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
    </style>
    <button class="fh-button" type="button">💬 反馈</button>
    <form class="fh-panel">
      <div class="fh-header">
        <p class="fh-title">有想法？说给我们听</p>
        <button class="fh-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="fh-body">
        <input name="title" placeholder="一句话描述你的想法" required maxlength="120" />
        <textarea name="body" placeholder="更多细节（选填）" maxlength="2000"></textarea>
        <input name="submitterEmail" type="email" placeholder="你的邮箱" required value="${config.userEmail ?? ""}" />
        <input class="fh-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="fh-turnstile"></div>
        <p class="fh-error"></p>
        <button type="submit">提交</button>
      </div>
    </form>
  `;

  const button = shadow.querySelector<HTMLButtonElement>(".fh-button")!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".fh-close")!;
  const panel = shadow.querySelector<HTMLFormElement>(".fh-panel")!;
  const submitButton = shadow.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const errorEl = shadow.querySelector<HTMLParagraphElement>(".fh-error")!;
  const turnstileContainer = shadow.querySelector<HTMLDivElement>(".fh-turnstile")!;

  function openPanel() {
    panel.classList.add("open");
    // 先 display:block 再下一帧加 fh-visible，让 opacity/transform 过渡能触发
    requestAnimationFrame(() => panel.classList.add("fh-visible"));
  }

  function closePanel() {
    panel.classList.remove("fh-visible");
    panel.classList.remove("open");
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
    submitButton.textContent = "提交中…";

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
        errorEl.textContent = "提交失败，请重试";
        errorEl.classList.add("fh-visible");
      })
      .finally(() => {
        submitButton.disabled = false;
        submitButton.textContent = "提交";
      });
  });

  return { turnstileContainer };
}
