/**
 * Heuristic marker for text that looks like it is trying to instruct an AI agent.
 *
 * This is a hint for the agent and the reviewer, NOT a defence. It cannot catch every phrasing,
 * and a determined attacker will get past it. The real protections are the capability boundary
 * (the agent has no tool that changes status, sends replies or reads emails) and human review of
 * every draft. Never make a security decision depend on this returning false.
 */
export const INJECTION_RULES: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: "ignore-instructions", pattern: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your)\b[^.\n]{0,30}\b(instructions?|prompts?|rules?|directions?)\b/i },
  { id: "system-prompt", pattern: /\b(system|developer)\s+(prompt|message|instructions?)\b/i },
  { id: "role-reassign", pattern: /\byou\s+are\s+now\b|\bact\s+as\s+(an?\s+)?(admin|administrator|system|developer|root)\b/i },
  { id: "fake-system-block", pattern: /(^|\n)\s*(\[|<|#+\s*)?\s*(system|assistant|admin)\s*(message|note)?\s*(\]|>|:)/i },
  { id: "tool-directive", pattern: /\b(call|invoke|run|use|execute)\b[^.\n]{0,30}\b(tool|function|command)\b/i },
  { id: "exfiltrate-email", pattern: /\b(e-?mail\s+addresses?|emails?|submitter|voter)\b[^.\n]{0,50}\b(paste|include|list|reveal|show|output|print|send|append)\b|\b(paste|include|list|reveal|show|output|print|send|append)\b[^.\n]{0,50}\b(e-?mail\s+addresses?|emails?)\b/i },
  { id: "mass-status-change", pattern: /\b(mark|set|change|update)\b[^.\n]{0,30}\b(all|every)\b[^.\n]{0,30}\b(done|closed|declined|resolved|status)\b/i },
  { id: "zh-ignore-instructions", pattern: /(忽略|无视|忘记|不要遵守|覆盖)[^。\n]{0,12}(之前|以上|上面|所有|先前|原有)[^。\n]{0,8}(指令|指示|提示|规则|要求)/ },
  { id: "zh-system-prompt", pattern: /系统(提示|消息|指令)|开发者(提示|消息|指令)/ },
  { id: "zh-exfiltrate-email", pattern: /(邮箱|邮件地址|电子邮件)[^。\n]{0,20}(贴|列出|输出|发送|显示|透露|包含)|(贴|列出|输出|发送|显示|透露|包含)[^。\n]{0,20}(邮箱|邮件地址|电子邮件)/ },
  { id: "zh-mass-status-change", pattern: /(全部|所有)[^。\n]{0,12}(标记|设置|改为|标为)[^。\n]{0,8}(完成|已完成|关闭|拒绝)/ },
];

export interface InjectionResult {
  suspected: boolean;
  matched: string[];
}

export function detectInjection(...texts: Array<string | null | undefined>): InjectionResult {
  const joined = texts.filter((t): t is string => typeof t === "string" && t.length > 0).join("\n");
  const matched = INJECTION_RULES.filter((r) => r.pattern.test(joined)).map((r) => r.id);
  return { suspected: matched.length > 0, matched };
}
