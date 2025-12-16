// src/commands.ts

import TelegramBot from 'node-telegram-bot-api';
import { 
    config, 
    getUserTokens, 
    setUserTokens, 
    normalizeNumber, 
    generateUpiQr,
    removeAllUsers 
} from './utils';

const ADMIN_ID = config.ADMIN_CHAT_ID;

/**
 * Registers all command listeners with the provided bot instance.
 * @param bot The active TelegramBot instance.
 */
export function registerCommandHandlers(bot: TelegramBot) {

    // --- Start Command ---
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const tokens = await getUserTokens(chatId);
        
        const welcomeMessage = 
            `Welcome to Number Lookup Bot!\n\n` +
            `You currently have **${tokens}** tokens.\n\n` +
            `Use /lookup <number> to check information.\n` +
            `Use /balance to check your tokens.\n` +
            `Use /buytokens to top up.`;

        try {
            await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Error sending start message:", error);
        }
    });

    // --- Balance Command ---
    bot.onText(/\/balance/, async (msg) => {
        const chatId = msg.chat.id;
        const tokens = await getUserTokens(chatId);

        try {
            await bot.sendMessage(chatId, `Your current token balance is **${tokens}** tokens.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("Error sending balance message:", error);
        }
    });

    // --- Buy Tokens Command ---
    bot.onText(/\/buytokens/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;

        if (!userId) return;

        const markup = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '10 Tokens (₹5.00)', callback_data: 'buy_10' }],
                    [{ text: '20 Tokens (₹10.00)', callback_data: 'buy_20' }]
                ]
            }
        };

        try {
            await bot.sendMessage(chatId, 'Select the token package you wish to purchase:', markup);
        } catch (error) {
            console.error("Error sending buytokens message:", error);
        }
    });

    // --- Callback Query Handler (for Buy Tokens) ---
    bot.on('callback_query', async (query) => {
        const chatId = query.message?.chat.id;
        const userId = query.from.id;
        const data = query.data;

        if (!chatId || !data) return;

        const match = data.match(/^buy_(\d+)$/);
        if (match) {
            const tokensToBuy = parseInt(match[1]);
            const amount = tokensToBuy * config.TOKEN_PRICE;

            const qrBase64 = await generateUpiQr(amount, tokensToBuy, userId);

            try {
                // Send the payment information
                await bot.sendPhoto(chatId, Buffer.from(qrBase64, 'base64'), {
                    caption: 
                        `Send **₹${amount.toFixed(2)}** to the UPI ID: \`${config.UPI_ID}\`\n\n` +
                        `**Tokens:** ${tokensToBuy}\n` +
                        `**User ID:** ${userId}\n\n` +
                        `*After payment, contact the admin to receive your tokens.*`,
                    parse_mode: 'Markdown'
                });

                // Dismiss the loading state on the button
                await bot.answerCallbackQuery(query.id, { text: 'Payment details sent!' });

            } catch (error) {
                console.error("Error sending payment info:", error);
                await bot.answerCallbackQuery(query.id, { text: 'Failed to generate payment details.' });
            }
        }
    });

    // --- Lookup Command ---
    bot.onText(/\/lookup (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        const rawNumber = match![1];
        
        if (!userId) return;

        let tokens = await getUserTokens(userId);

        if (tokens < 1) {
            try {
                await bot.sendMessage(chatId, "You need at least 1 token for a lookup. Please use /buytokens to top up.");
            } catch (error) {
                console.error("Error sending low tokens message:", error);
            }
            return;
        }

        const number = normalizeNumber(rawNumber);
        
        try {
            // 1. Fetch data from the API
            const response = await fetch(`${config.API_BASE_URL}?key=${config.API_KEY}&number=${number}`);
            const data = await response.json();

            // Check API response for success and send result
            let replyText = 'Lookup failed or data not available.';
            if (data.status === 'success' && data.data) {
                replyText = 
                    `✅ **Lookup Successful**\n` +
                    `---\n` +
                    `**Number:** ${data.data.number}\n` +
                    `**Carrier:** ${data.data.carrier}\n` +
                    `**Circle:** ${data.data.circle}\n` +
                    `**Service:** ${data.data.service}\n` +
                    `**Ported:** ${data.data.ported ? 'Yes' : 'No'}`;
                
                // 2. Decrement token count ONLY on success
                tokens--;
                await setUserTokens(userId, tokens);
                
                // 3. Append new balance to reply
                replyText += `\n---\n💰 **New Balance:** ${tokens} tokens.`;
            } else {
                replyText = `❌ Lookup Error: ${data.message || 'Unknown API error.'}`;
            }

            await bot.sendMessage(chatId, replyText, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error("Error during API lookup or token update:", error);
            await bot.sendMessage(chatId, "An internal error occurred while performing the lookup.");
        }
    });
    
    // --- Admin Commands ---

    // Admin: Add Tokens
    bot.onText(/\/addtokens (\d+) (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const adminId = msg.from?.id;

        if (adminId?.toString() !== ADMIN_ID) {
            await bot.sendMessage(chatId, "🚫 Access denied. Only the administrator can use this command.");
            return;
        }

        const targetUserId = parseInt(match![1]);
        const tokensToAdd = parseInt(match![2]);

        try {
            const currentTokens = await getUserTokens(targetUserId);
            const newTokens = currentTokens + tokensToAdd;
            await setUserTokens(targetUserId, newTokens);

            await bot.sendMessage(chatId, 
                `✅ Added **${tokensToAdd}** tokens to user \`${targetUserId}\`.\n` +
                `New balance: **${newTokens}** tokens.`, 
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error("Error processing admin addtokens:", error);
            await bot.sendMessage(chatId, "An error occurred while adding tokens.");
        }
    });

    // Admin: Clear All Tokens (for testing/maintenance)
    bot.onText(/\/clearall/, async (msg) => {
        const chatId = msg.chat.id;
        const adminId = msg.from?.id;

        if (adminId?.toString() !== ADMIN_ID) {
            await bot.sendMessage(chatId, "🚫 Access denied. Only the administrator can use this command.");
            return;
        }
        
        try {
            await removeAllUsers();
            await bot.sendMessage(chatId, "⚠️ All user token data has been wiped from the database.");
        } catch (error) {
            console.error("Error clearing all tokens:", error);
            await bot.sendMessage(chatId, "An error occurred while clearing all tokens.");
        }
    });
}