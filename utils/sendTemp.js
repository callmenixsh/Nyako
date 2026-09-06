/**
 * Schedule a message to delete itself after a few seconds.
 * Safe for both normal messages and ephemeral interaction replies.
 */
function scheduleDelete(message, seconds) {
  if (!message || typeof message.delete !== "function") return;

  const timer = setTimeout(() => {
    if (!message.deleted) message.delete().catch(() => {});
  }, seconds * 1000);

  if (typeof timer.unref === "function") timer.unref();
}

/**
 * Send a transient rejection via a ctx-ish object ({ sendMain }).
 * Payload may be a string or a full "send" object.
 */
async function sendTemp(ctx, payload, seconds = 6) {
  const normalized = typeof payload === "string" ? { content: payload } : payload;
  const message = await ctx.sendMain(normalized);
  scheduleDelete(message, seconds);
  return message;
}

/**
 * Send a transient rejection via a reply function, e.g.
 * replyTemp((p) => message.reply(p), "nope") or
 * replyTemp((p) => interaction.reply(p), { content, flags }).
 */
async function replyTemp(replyFn, payload, seconds = 6) {
  const normalized = typeof payload === "string" ? { content: payload } : payload;
  const message = await replyFn(normalized);
  scheduleDelete(message, seconds);
  return message;
}

module.exports = { sendTemp, replyTemp, scheduleDelete };