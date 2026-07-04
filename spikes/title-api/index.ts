import type {
  ExtensionAPI,
  ExtensionContext,
} from "@oh-my-pi/pi-coding-agent/extensibility/extensions";

function readBaseTitle(ctx: ExtensionContext): string {
  const maybeTitle = ctx.sessionManager.getSessionName();
  if (typeof maybeTitle === "string" && maybeTitle.trim().length > 0) {
    return maybeTitle;
  }

  const cwdBase = ctx.cwd.split("/").filter(Boolean).pop() ?? "omp";
  return `π: ${cwdBase}`;
}

export default function titleApiSpike(pi: ExtensionAPI): void {
  const run = (ctx: ExtensionContext): void => {
    const baseTitle = readBaseTitle(ctx);
    const isIdle = ctx.isIdle();
    ctx.ui.setTitle("omp-otty-bridge-smoke");
    pi.logger.info("omp-otty-bridge title API spike", {
      baseTitle,
      cwd: ctx.cwd,
      isIdle,
    });
  };

  pi.on("session_start", (_event, ctx) => {
    run(ctx);
  });

  pi.registerCommand("otty-title-spike", {
    description: "Run the Otty title API compatibility spike",
    handler: async (_args, ctx) => {
      run(ctx);
      ctx.ui.notify(
        `Otty title spike ran. Base title: ${readBaseTitle(ctx)}. idle=${ctx.isIdle()}`,
        "info",
      );
    },
  });
}
