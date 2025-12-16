"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStart = handleStart;
exports.handleBalance = handleBalance;
exports.handleBuy = handleBuy;
exports.handleCallbackQuery = handleCallbackQuery;
exports.handleLookup = handleLookup;
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("./utils");
// Helper function to send an image from base64 string
const sendPhotoFromBase64 = (bot, chatId, base64, caption, options) => {
    const buffer = Buffer.from(base64, 'base64');
    // The Telegram Bot API handles Buffer uploads correctly
    // The options argument should include parse_mode if needed.
    return bot.sendPhoto(chatId, buffer, { caption: caption, ...options });
};
async function handleStart(bot, msg) {
    const userId = msg.from.id;
    const tokens = (0, utils_1.getUserTokens)(userId);
    const welcomeMessage = ("👋 **Welcome to the Number Lookup Bot!**\n\n"
        + "This bot uses the *numberinfo* service to look up mobile number details.\n\n"
        + "✨ **Token System:**\n"
        + "• **1 Lookup = 1 Token**\n"
        + `• Your current balance: **${tokens} Tokens**\n\n`
        + "**Available Commands:**\n"
        + "• `/lookup <number>`: Perform a lookup (e.g., `/lookup 9818368263`)\n"
        + "• `/balance`: Check your current token balance.\n"
        + "• `/buy`: See pricing and buy more tokens.");
    await bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
}
async function handleBalance(bot, msg) {
    const userId = msg.from.id;
    const tokens = (0, utils_1.getUserTokens)(userId);
    await bot.sendMessage(msg.chat.id, `💰 Your current token balance is: **${tokens} Tokens**.`);
}
async function handleBuy(bot, msg) {
    const prices = {
        10: 10 * utils_1.config.TOKEN_PRICE, // 5.00 INR
        50: 50 * utils_1.config.TOKEN_PRICE, // 25.00 INR
        100: 100 * utils_1.config.TOKEN_PRICE, // 50.00 INR
    };
    // FIX: Using Object.entries().map() to correctly construct the inline keyboard array
    const keyboard = Object.entries(prices).map(([tokens, price]) => ([
        {
            text: `${tokens} Tokens for ₹${price.toFixed(2)}`,
            callback_data: `buy_${tokens}_${price.toFixed(2)}`
        }
    ]));
    const message = ("🪙 **Buy Tokens**\n\n"
        + `**Pricing:** 1 Token = ₹${utils_1.config.TOKEN_PRICE.toFixed(2)}\n`
        + "Select the number of tokens you wish to purchase:");
    await bot.sendMessage(msg.chat.id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}
async function handleCallbackQuery(bot, query) {
    const data = query.data;
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    if (!data || !chatId) {
        return;
    }
    if (data.startsWith('buy_')) {
        const parts = data.split('_');
        const tokensToBuy = parseInt(parts[1], 10);
        const amount = parseFloat(parts[2]);
        try {
            const qrBase64 = await (0, utils_1.generateUpiQr)(amount, tokensToBuy, userId);
            const caption = (`💳 **Payment Required: ${tokensToBuy} Tokens**\n\n`
                + `**Amount:** ₹${amount.toFixed(2)}\n`
                + `**Pay to UPI ID:** \`${utils_1.config.UPI_ID}\`\n\n`
                + "**Steps to Pay:**\n"
                + "1. Scan the QR code above.\n"
                + `2. Ensure the amount is **₹${amount.toFixed(2)}**.\n`
                + "3. **IMPORTANT:** After payment, send the screenshot to the admin. Tokens will be credited manually.\n");
            // FIX: Ensure correct arguments are passed to sendPhotoFromBase64
            await sendPhotoFromBase64(bot, chatId, qrBase64, caption, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(query.id, { text: 'Payment details sent!' });
            // Notify Admin
            const adminMessage = (`🚨 **New Token Purchase Request** 🚨\n` +
                `**User ID:** \`${userId}\`\n` +
                `**Username:** @${query.from.username || 'N/A'}\n` +
                `**Tokens:** ${tokensToBuy}\n` +
                `**Amount:** ₹${amount.toFixed(2)}\n`);
            await bot.sendMessage(utils_1.config.ADMIN_CHAT_ID, adminMessage, { parse_mode: 'Markdown' });
        }
        catch (error) {
            console.error(error);
            bot.answerCallbackQuery(query.id, { text: 'Failed to generate payment info.', show_alert: true });
        }
    }
}
async function handleLookup(bot, msg, number) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    let tokens = (0, utils_1.getUserTokens)(userId);
    if (tokens < 1) {
        await bot.sendMessage(chatId, "🛑 **Insufficient Tokens!**\n"
            + "You need **1 Token** for a lookup. Please use `/buy` to purchase more tokens.", { parse_mode: 'Markdown' });
        return;
    }
    // 1. Deduct Token
    const newTokens = tokens - 1;
    (0, utils_1.setUserTokens)(userId, newTokens);
    await bot.sendMessage(chatId, `🔍 Looking up **${number}**...\n*1 Token deducted. Balance: ${newTokens} Tokens.*`, { parse_mode: 'Markdown' });
    // 2. Call the API
    const fullApiUrl = `${utils_1.config.API_BASE_URL}?key=${utils_1.config.API_KEY}&num=${number}`;
    let resultMessage = '';
    try {
        // ... (API call logic is mostly fine)
        const response = await axios_1.default.get(fullApiUrl);
        const data = response.data;
        // 3. Format and Send Result
        if (data.status === "success" && data.data) {
            const info = data.data;
            resultMessage = (`✅ **Lookup Result for ${number}**\n\n` +
                `**Name:** \`${info.name || 'N/A'}\`\n` +
                `**Operator:** \`${info.operator || 'N/A'}\`\n` +
                `**City:** \`${info.city || 'N/A'}\`\n` +
                `**State:** \`${info.state || 'N/A'}\`\n` +
                `**Source:** \`${info.source || 'N/A'}\``);
        }
        else {
            resultMessage = `⚠️ **Lookup Failed!**\nError: \`${data.message || 'API returned an unknown error.'}\``;
        }
    }
    catch (error) {
        // Revert token on API error or connection failure
        (0, utils_1.setUserTokens)(userId, tokens);
        console.error('API Error:', error.message);
        resultMessage = `❌ **API Error.**\nCould not complete lookup. Your token has been *reverted*. Details: \`${error.message}\``;
    }
    await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
}
