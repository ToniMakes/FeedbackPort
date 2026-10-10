/** An error whose message is safe to show to the model. Everything else is reported generically. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
