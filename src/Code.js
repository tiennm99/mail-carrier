/* exported forwardToTelegram */

// Gmail label that marks threads to send, unless the LABEL property is set.
const DEFAULT_LABEL = 'Telegram';
// Telegram caps a message at 4096 visible characters; leave room for the marker.
const MAX_TEXT = 4000;

/**
 * Sends each new message in labelled threads to Telegram, oldest first, then
 * removes the label. Run it from a time-driven trigger.
 *
 * Script properties: BOT_TOKEN and CHAT_ID are set by hand, and LABEL and
 * ENABLED optionally; ENABLED=false pauses the script without removing its
 * trigger. LAST_SENT is the timestamp of the last message sent, so a failed
 * run resumes where it stopped.
 * @returns {void}
 */
function forwardToTelegram() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ENABLED') === 'false') return;
  const token = props.getProperty('BOT_TOKEN');
  const chatId = props.getProperty('CHAT_ID');
  if (!token || !chatId) {
    throw new Error('Set BOT_TOKEN and CHAT_ID in Script Properties');
  }
  const label = GmailApp.getUserLabelByName(
    props.getProperty('LABEL') || DEFAULT_LABEL,
  );
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
 * Renders the message as Telegram HTML: a bold subject, the sender, and the
 * body folded into an expandable quote, with each link shown as its label.
 * @param {GoogleAppsScript.Gmail.GmailMessage} msg
 * @returns {string}
 */
function formatMessage(msg) {
  const subject = msg.getSubject() || '(no subject)';
  const from = `From: ${msg.getFrom()}`;
  const html = msg.getBody();
  const body = /<[a-z][\s\S]*>/i.test(html) ? htmlToText(html) : { text: msg.getPlainBody(), links: [] };
  // Telegram counts the limit in visible characters, so tags and URLs are free.
  const budget = MAX_TEXT - subject.length - from.length;
  return `<b>${escapeHtml(subject)}</b>\n${escapeHtml(from)}\n<blockquote expandable>${renderBody(body, budget)}</blockquote>`;
}

/**
 * Flattens an HTML body to text. Each link becomes \uE000index\uE001label\uE002
 * in the text, with its URL at that index in links.
 * @param {string} html
 * @returns {{text: string, links: string[]}}
 */
function htmlToText(html) {
  /** @type {string[]} */
  const links = [];
  const text = html
    .replace(/<(head|style|script)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, _q, href, label) =>
      `\uE000${links.push(decodeEntities(href.trim())) - 1}\uE001${label}\uE002`,
    )
    .replace(/<br\s*\/?>|<\/?(p|div|tr|li|h[1-6]|table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return {
    text: decodeEntities(text)
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    links,
  };
}

/**
 * Escapes the text for Telegram HTML, turns link markers into <a> tags, and
 * cuts it to budget visible characters.
 * @param {{text: string, links: string[]}} body
 * @param {number} budget
 * @returns {string}
 */
function renderBody({ text, links }, budget) {
  let out = '';
  let left = budget;
  for (const part of text.split(/(\uE000\d+\uE001[^\uE002]*\uE002)/)) {
    const link = part.match(/^\uE000(\d+)\uE001([^\uE002]*)\uE002$/);
    const label = link ? link[2].trim() : part.replace(/[\uE000-\uE002]/g, '');
    if (!label) continue;
    if (label.length > left) return `${out}${escapeHtml(label.slice(0, left))}\n[truncated]`;
    left -= label.length;
    const href = link ? links[Number(link[1])] : '';
    out += /^(https?|mailto|tel):/i.test(href)
      ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
      : escapeHtml(label);
  }
  return out;
}

/**
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
  /** @type {Record<string, string>} */
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    payload: {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: JSON.stringify({ is_disabled: true }),
    },
  });
}
