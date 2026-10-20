/* exported forwardToTelegram */

// Gmail label that marks threads to send; a Gmail filter applies it.
const LABEL = 'to-telegram';
// Telegram caps a message at 4096 characters; leave room for the marker.
const MAX_TEXT = 4000;

/**
 * Sends each new message in labelled threads to Telegram, oldest first, then
 * removes the label. Run it from a time-driven trigger.
 *
 * Script properties: BOT_TOKEN and CHAT_ID are set by hand; LAST_SENT is the
 * timestamp of the last message sent, so a failed run resumes where it stopped.
 * @returns {void}
 */
function forwardToTelegram() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BOT_TOKEN');
  const chatId = props.getProperty('CHAT_ID');
  if (!token || !chatId) {
    throw new Error('Set BOT_TOKEN and CHAT_ID in Script Properties');
  }
  const label = GmailApp.getUserLabelByName(LABEL);
  if (!label) return;

  const since = Number(props.getProperty('LAST_SENT') || 0);
  const threads = label.getThreads(0, 50);
  const messages = threads
    .flatMap((thread) => thread.getMessages())
    .filter((msg) => msg.getDate().getTime() > since)
    .sort((a, b) => a.getDate().getTime() - b.getDate().getTime());

  for (const msg of messages) {
    sendMessage(token, chatId, formatMessage(msg));
    props.setProperty('LAST_SENT', String(msg.getDate().getTime()));
  }
  for (const thread of threads) thread.removeLabel(label);
}

/**
 * @param {GoogleAppsScript.Gmail.GmailMessage} msg
 * @returns {string}
 */
function formatMessage(msg) {
  const text = `From: ${msg.getFrom()}\nSubject: ${msg.getSubject()}\n\n${msg.getPlainBody()}`;
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n[truncated]` : text;
}

/**
 * Throws on a non-2xx reply, such as a bad token or Telegram rate limiting.
 * @param {string} token
 * @param {string} chatId
 * @param {string} text
 * @returns {void}
 */
function sendMessage(token, chatId, text) {
  UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'post',
    payload: { chat_id: chatId, text },
  });
}
