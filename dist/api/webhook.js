"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const utils_1 = require("../src/utils");
const commands_1 = require("../src/commands");
// Initialize the bot instance
// Note: We use the 'none' polling option as updates come via Webhook
const bot = new node_telegram_bot_api_1.default(utils_1.config.BOT_TOKEN, { polling: false });
// Register command listeners once
// Since Vercel reloads the function on every call, we process the update directly.
// Vercel Serverless Function Handler
exports.default = async (req, res) => {
    if (req.method !== 'POST' || !req.body) {
        res.status(405).send('Method Not Allowed or Missing Body');
        return;
    }
    try {
        const update = req.body;
        // 1. Handle Messages (Commands)
        if (update.message) {
            const msg = update.message;
            const text = msg.text || '';
            const chatId = msg.chat.id;
            if (text.startsWith('/start')) {
                await (0, commands_1.handleStart)(bot, msg);
            }
            else if (text.startsWith('/balance')) {
                await (0, commands_1.handleBalance)(bot, msg);
            }
            else if (text.startsWith('/buy')) {
                await (0, commands_1.handleBuy)(bot, msg);
            }
            else if (text.startsWith('/lookup')) {
                const parts = text.split(/\s+/);
                if (parts.length === 2) {
                    await (0, commands_1.handleLookup)(bot, msg, parts[1]);
                }
                else {
                    await bot.sendMessage(chatId, "❌ Invalid lookup format. Use: `/lookup <number>`", { parse_mode: 'Markdown' });
                }
            }
            else {
                // Optionally handle generic messages
            }
        }
        // 2. Handle Callback Queries (Inline Buttons)
        if (update.callback_query) {
            await (0, commands_1.handleCallbackQuery)(bot, update.callback_query);
        }
        // Must respond quickly to Telegram to acknowledge the update
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal Server Error');
    }
};
