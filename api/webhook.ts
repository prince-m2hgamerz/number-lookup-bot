// api/webhook.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../src/utils';
import { handleStart, handleBalance, handleBuy, handleLookup, handleCallbackQuery } from '../src/commands';

// Initialize the bot instance
// Note: We use the 'none' polling option as updates come via Webhook
const bot = new TelegramBot(config.BOT_TOKEN, { polling: false });

// Register command listeners once
// Since Vercel reloads the function on every call, we process the update directly.

// Vercel Serverless Function Handler
export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST' || !req.body) {
        res.status(405).send('Method Not Allowed or Missing Body');
        return;
    }

    try {
        const update = req.body as TelegramBot.Update;
        
        // 1. Handle Messages (Commands)
        if (update.message) {
            const msg = update.message;
            const text = msg.text || '';
            const chatId = msg.chat.id;

            if (text.startsWith('/start')) {
                await handleStart(bot, msg);
            } else if (text.startsWith('/balance')) {
                await handleBalance(bot, msg);
            } else if (text.startsWith('/buy')) {
                await handleBuy(bot, msg);
            } else if (text.startsWith('/lookup')) {
                const parts = text.split(/\s+/);
                if (parts.length === 2) {
                    await handleLookup(bot, msg, parts[1]);
                } else {
                    await bot.sendMessage(chatId, "❌ Invalid lookup format. Use: `/lookup <number>`", { parse_mode: 'Markdown' });
                }
            } else {
                 // Optionally handle generic messages
            }
        }
        
        // 2. Handle Callback Queries (Inline Buttons)
        if (update.callback_query) {
            await handleCallbackQuery(bot, update.callback_query);
        }

        // Must respond quickly to Telegram to acknowledge the update
        res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal Server Error');
    }
};