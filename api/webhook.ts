// api/webhook.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../src/utils'; // Imports the config object
import { handleStart, handleBalance, handleBuy, handleLookup, handleCallbackQuery } from '../src/commands';

// Initialize the bot instance using the validated token from config
// FIX: This line will crash if the token is missing, but src/utils now throws a clearer error.
const bot = new TelegramBot(config.BOT_TOKEN, { polling: false });

// Vercel Serverless Function Handler
export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST' || !req.body) {
        // Must allow GET for Vercel health checks, but reject non-POST requests for logic
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
                if (parts.length === 2 && !isNaN(Number(parts[1]))) { // Simple number validation
                    await handleLookup(bot, msg, parts[1]);
                } else {
                    await bot.sendMessage(chatId, "❌ Invalid lookup format. Use: `/lookup <number>`", { parse_mode: 'Markdown' });
                }
            }
        }
        
        // 2. Handle Callback Queries
        if (update.callback_query) {
            await handleCallbackQuery(bot, update.callback_query);
        }

        // Acknowledge Telegram update quickly
        res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook processing error:', error);
        // Send a 500 error to signal a problem without detailed exposure
        res.status(500).send('Internal Server Error');
    }
};