// api/webhook.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { 
    handleStart, 
    handleLookup, 
    handleBalance, 
    handleBuy, 
    handleCallbackQuery, 
    handleHelp,
    handleAddTokens,
    handleRemoveAllUsers,
} from '../src/commands';
import { config } from '../src/utils';

// Initialize the bot with the correct token
const bot = new TelegramBot(config.BOT_TOKEN, { polling: false });

// --- Register Command Handlers ---
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/help/, (msg) => handleHelp(bot, msg)); // New
bot.onText(/\/balance/, (msg) => handleBalance(bot, msg));
bot.onText(/\/buy/, (msg) => handleBuy(bot, msg));

// Lookup command
bot.onText(/\/lookup (.+)/, (msg, match) => {
    if (match && match[1]) {
        handleLookup(bot, msg, match[1].trim());
    }
});

// Admin commands (New)
bot.onText(/\/addtokens (\d+) (\d+)/, (msg, match) => {
    if (match && match[1] && match[2]) {
        // match[1] is the target user ID, match[2] is the tokens count
        handleAddTokens(bot, msg, parseInt(match[1]), parseInt(match[2]));
    }
});

bot.onText(/\/removeallusers/, (msg) => handleRemoveAllUsers(bot, msg)); // New

// Handle inline keyboard button clicks
bot.on('callback_query', (query) => handleCallbackQuery(bot, query));


// The Vercel Serverless function handler
export default async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
        if (req.method === 'POST') {
            // Process the Telegram update
            await bot.processUpdate(req.body as TelegramBot.Update);
            // Must respond with 200 OK immediately
            res.status(200).send('OK');
        } else if (req.method === 'GET') {
            // Optional: for checking if the endpoint is alive
            res.status(200).send('Telegram Bot Webhook is running.');
        } else {
            res.status(405).send('Method Not Allowed');
        }
    } catch (error) {
        console.error('Webhook error:', error);
        // Respond with 500 but still send 200 to Telegram to stop retries if possible
        res.status(200).send('Error');
    }
};