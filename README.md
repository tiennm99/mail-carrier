# mail-carrier

Send Gmail messages to a Telegram chat. A Gmail filter labels the mail you
want, and a Google Apps Script sends each labelled message to your Telegram
bot every minute, then removes the label.

No server is needed: the script runs in your Google account for free.

## Setup

### 1. Create the Telegram bot

1. In Telegram, message **@BotFather**, send `/newbot`, and follow the
   prompts. Any display name works, such as `Mail Carrier`. The username must
   end in `bot` and be unique across Telegram.
2. Copy the **bot token** BotFather gives you.
3. Send any message to your new bot.
4. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy
   the number at `"chat":{"id": ...}`. That is your **chat ID**.

### 2. Create the Gmail filter

1. Click the sliders icon in the Gmail search bar and enter your conditions,
   for example From `@example.com`. Gmail has no wildcards; a domain alone
   matches every sender at that domain, and `@a.com OR @b.com` matches either.
2. Click **Create filter**.
3. Tick **Apply the label** and create a new label named `Telegram`, or any
   name you set in the `LABEL` property in step 4.
4. Click **Create filter**.

### 3. Add the script

Pick one of the two ways below.

**Copy and paste**

1. Go to [script.google.com](https://script.google.com) and create a
   **New project**. Name it `mail-carrier`.
2. Replace the contents of `Code.gs` with [`src/Code.js`](src/Code.js).

**With clasp**

1. Turn on the Apps Script API at
   [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. Create an empty project at script.google.com and copy its **Script ID**
   from **Project Settings**.
3. In this repo:

   ```sh
   npm install
   cp .clasp.json.example .clasp.json   # then paste the Script ID into it
   npx clasp login
   npm run push
   ```

   `npm run push` uploads `src/`, overwriting the project's files.

### 4. Configure and schedule it

1. In the Apps Script editor, open **Project Settings → Script Properties**
   and add:

   | Property | Value |
   | --- | --- |
   | `BOT_TOKEN` | Bot token from step 1 |
   | `CHAT_ID` | Chat ID from step 1 |
   | `LABEL` | Optional; Gmail label to watch, default `Telegram` |

2. Select `forwardToTelegram` in the toolbar, click **Run**, and allow the
   Gmail and external-request permissions it asks for.
3. Open **Triggers** (clock icon) → **Add Trigger**: function
   `forwardToTelegram`, event source **Time-driven**, **Minutes timer**,
   **Every minute** (or every 5 minutes).

Send yourself a test email that matches the filter; it should reach Telegram
within a minute.

## Deploy with GitHub Actions

The [deploy workflow](.github/workflows/deploy.yml) lints and type-checks every
push and pull request, and on `main` pushes `src/` to your Apps Script project.
Without the secrets below it skips the push, so forks stay green.

1. Do the clasp setup from step 3 once, so `npx clasp login` has created
   `~/.clasprc.json`.
2. In your fork, open **Settings → Secrets and variables → Actions** and add:

   | Secret | Value |
   | --- | --- |
   | `CLASPRC_JSON` | Contents of `~/.clasprc.json` |
   | `SCRIPT_ID` | Script ID from **Project Settings** |

3. Push to `main`, or run the workflow from the **Actions** tab.

The workflow only replaces the code. Script Properties and the trigger stay as
you set them in step 4.

`CLASPRC_JSON` holds a refresh token that can edit your Apps Script projects
and Drive files, so only add it to a repo where you trust everyone with write
access. GitHub does not pass secrets to pull requests from forks. The token
stops working if you change your Google password, revoke clasp's access, or
leave it unused for six months; run `npx clasp login` again and update the
secret.

## How it works

Each run reads up to 50 threads with the label (`Telegram` by default), sends every message
newer than the last one sent, oldest first, and removes the label. The
timestamp of the last sent message is kept in the `LAST_SENT` script property,
so a run that fails partway (for example on Telegram rate limiting) resumes on
the next trigger without sending duplicates. When a later reply matches the
filter, the thread is labelled again and only the new reply is sent.

Each Telegram message shows the subject in bold and the sender, followed by
the body as plain text inside a quote you tap to expand. Every link appears
as its label, such as **Sign in**, instead of the full tracking URL, and link
previews are turned off.

To change the message limit, edit `MAX_TEXT` at the top of `src/Code.js`.

## Limits

- Messages arrive up to one trigger interval late, not instantly.
- Long emails are cut at 4000 characters, and attachments are not sent.
- Mail older than `LAST_SENT` is skipped, so applying the filter to existing
  conversations sends nothing older than the newest message already sent.
  Delete `LAST_SENT` to resend everything currently labelled.
- Email contents are stored on Telegram, and bot chats are not end-to-end
  encrypted. Do not use this for sensitive mail.
- Some Google Workspace accounts block Apps Script or outside URL calls; the
  admin has to allow them.

## Development

```sh
npm install
npm run lint
npm run typecheck
```

The code is plain JavaScript with JSDoc types, checked by `tsc` against
`@types/google-apps-script`. `src/appsscript.json` is the Apps Script
manifest.

## License

[Apache-2.0](LICENSE)
