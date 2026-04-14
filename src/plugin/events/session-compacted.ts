export async function handleSessionCompacted(
  owlDir: string,
  sessionId: string,
  output: { context: string[] }
): Promise<void> {
  output.context.push(
    "OpenOwl is active. Project knowledge (DNR, conventions, file index, bugs) is injected automatically each turn."
  );
}
