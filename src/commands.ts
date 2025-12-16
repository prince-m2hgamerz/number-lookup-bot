// src/commands.ts
import TelegramBot, { Message } from 'node-telegram-bot-api';
import axios from 'axios';
import { getUserTokens, setUserTokens, generateUpiQr, config } from './utils';
import { LookupApiResponse } from './types';

// Helper function to send an image from base64 string
const sendPhotoFromBase64 = (bot: TelegramBot, chatId: number, base64: string, caption: string, options?: any) => {
    const buffer = Buffer.from(base64, 'base64');
    // FIX: sendPhoto needs a Buffer for base64 data, as implemented here.
    return bot.sendPhoto(chatId, buffer, { caption: caption, ...options });
};

export async function handleStart(bot: TelegramBot, msg: Message): Promise<void> {
    const userId = msg.from!.id;
    const tokens = getUserTokens(userId);
    
    // FIX: Using template literals correctly (using backticks `) for multiline strings
    const welcomeMessage = `
👋 **Welcome to the Number Lookup Bot!**

This bot uses the *numberinfo* service to look up mobile number details.

✨ **Token System:**
• **1 Lookup = 1 Token**
• Your current balance: **${tokens} Tokens**

**Available Commands:**
• \`/lookup <number>\`: Perform a lookup (e.g., \`/lookup 9818368263\`)
• \`/balance\`: Check your current token balance.
• \`/buy\`: See pricing and buy more tokens.
`;
    await bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
}

export async function handleBalance(bot: TelegramBot, msg: Message): Promise<void> {
    const userId = msg.from!.id;
    const tokens = getUserTokens(userId);
    // FIX: Simple message string is fine here
    await bot.sendMessage(msg.chat.id, `💰 Your current token balance is: **${tokens} Tokens**.`);
}

export async function handleBuy(bot: TelegramBot, msg: Message): Promise<void> {
    const prices = {
        10: 10 * config.TOKEN_PRICE,
        50: 50 * config.TOKEN_PRICE,
        100: 100 * config.TOKEN_PRICE,
    };

    const keyboard = Object.entries(prices).map(([tokens, price]) => ([
        { 
            text: `${tokens} Tokens for ₹${price.toFixed(2)}`, 
            callback_data: `buy_${tokens}_${price.toFixed(2)}` 
        }
    ]));

    const message = `
🪙 **Buy Tokens**

**Pricing:** 1 Token = ₹${config.TOKEN_PRICE.toFixed(2)}
Select the number of tokens you wish to purchase:
`;

    await bot.sendMessage(msg.chat.id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}

export async function handleCallbackQuery(bot: TelegramBot, query: TelegramBot.CallbackQuery): Promise<void> {
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
            const qrBase64 = await generateUpiQr(amount, tokensToBuy, userId);
            
            const caption = `
💳 **Payment Required: ${tokensToBuy} Tokens**

**Amount:** ₹${amount.toFixed(2)}
**Pay to UPI ID:** \`${config.UPI_ID}\`

**Steps to Pay:**
1. Scan the QR code above.
2. Ensure the amount is **₹${amount.toFixed(2)}**.
3. **IMPORTANT:** After payment, send the screenshot to the admin. Tokens will be credited manually.
`;
            
            await sendPhotoFromBase64(bot, chatId, qrBase64, caption, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(query.id, { text: 'Payment details sent!' });

            // Notify Admin
            const adminMessage = `
🚨 **New Token Purchase Request** 🚨
**User ID:** \`${userId}\`
**Username:** @${query.from.username || 'N/A'}
**Tokens:** ${tokensToBuy}
**Amount:** ₹${amount.toFixed(2)}
`;
            // FIX: Using config.ADMIN_CHAT_ID directly. Ensure this is a string chat ID.
            await bot.sendMessage(config.ADMIN_CHAT_ID, adminMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error(error);
            bot.answerCallbackQuery(query.id, { text: 'Failed to generate payment info.', show_alert: true });
        }
    }
}


export async function handleLookup(bot: TelegramBot, msg: Message, number: string): Promise<void> {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    let tokens = getUserTokens(userId);

    if (tokens < 1) {
        await bot.sendMessage(chatId, 
            "🛑 **Insufficient Tokens!**\nYou need **1 Token** for a lookup. Please use `/buy` to purchase more tokens.",
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // 1. Deduct Token
    const newTokens = tokens - 1;
    setUserTokens(userId, newTokens);
    
    await bot.sendMessage(chatId, 
        `🔍 Looking up **${number}**...\n*1 Token deducted. Balance: ${newTokens} Tokens.*`, 
        { parse_mode: 'Markdown' }
    );
    
    // 2. Call the API
    const fullApiUrl = `${config.API_BASE_URL}?key=${config.API_KEY}&num=${number}`;
    let resultMessage = '';

    try {
        const response = await axios.get<LookupApiResponse>(fullApiUrl);
        const data = response.data;
        
        // 3. Format and Send Result
        if (data.status === "success" && data.data) {
            const info = data.data;
            resultMessage = `
✅ **Lookup Result for ${number}**

**Name:** \`${info.name || 'N/A'}\`
**Operator:** \`${info.operator || 'N/A'}\`
**City:** \`${info.city || 'N/A'}\`
**State:** \`${info.state || 'N/A'}\`
**Source:** \`${info.source || 'N/A'}\`
`; // FIX: Closing template literal
        } else {
            // Revert token if API lookup fails or returns error status
             setUserTokens(userId, tokens);
            resultMessage = `⚠️ **Lookup Failed!**\nError: \`${data.message || 'API returned an unknown error.'}\`\n*Your token has been reverted.*`;
        }

    } catch (error: any) {
        // Revert token on connection failure or Axios error
        setUserTokens(userId, tokens); 
        console.error('API Error:', error.message);
        resultMessage = `❌ **API Error.**\nCould not complete lookup. Your token has been *reverted*. Details: \`${error.message}\``;
    }
    
    await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
}