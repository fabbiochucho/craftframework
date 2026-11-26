# Telegram channel

CRAFT's low-bandwidth channel (`netlify/functions/telegram.mts`, `src/lib/telegramBot.ts`). People link a chat from
**Settings → Security → Telegram**, then can:

- receive the notices CRAFT already emails (validation reminders, debrief opened, …) — email stays the record;
- `/ask` a question: approved Copilot templates that cover it are named, otherwise it joins the expert queue
  (Admin → Copilot) and the expert's answer is sent back to the chat;
- `/screen` the quick pre-award screen with buttons (self-reported; not saved as a record);
- `/status` open capacity assessments and expert answers; `/stop` to unlink.

No model is called from Telegram: answers come from approved templates or a person.

## Setting it up

1. In Telegram, message **@BotFather**, send `/newbot`, choose a name and a username ending in `bot`. Keep the token.
2. In Netlify (site settings → environment variables) set:
   - `TELEGRAM_BOT_TOKEN` — the token from BotFather (secret)
   - `TELEGRAM_BOT_USERNAME` — the bot's username, without `@`
   - `TELEGRAM_WEBHOOK_SECRET` — a long random string (letters, digits, `_` and `-` only), e.g. `openssl rand -hex 32`
3. Deploy, then as the super admin call `POST /api/telegram/setup` once (from the browser console while signed in:
   `fetch('/api/telegram/setup', { method: 'POST' }).then(r => r.json())`). It points the bot at this site.
4. Optional: in BotFather, `/setcommands` with
   ```
   ask - Ask a question
   screen - Quick pre-award screen
   status - What is waiting for you
   stop - Unlink this chat
   ```

Unset `TELEGRAM_BOT_TOKEN` to switch the channel off; nothing is sent and the Settings card disappears.

**Data:** a linked chat stores the Telegram chat id and the CRAFT email (`telegram_links`); link codes are stored
hashed and expire after 15 minutes. Messages pass through Telegram's servers, so CRAFT never sends scores, evidence or
answers to assessments over Telegram, only notices, guidance titles and expert answers to questions the person asked
there. Add Telegram as a processor in the privacy notice before switching it on.
