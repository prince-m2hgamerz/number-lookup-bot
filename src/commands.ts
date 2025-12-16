// src/commands.ts
import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import axios from 'axios';
import { config, getUserTokens, setUserTokens, generateUpiQr, normalizeNumber, removeAllUsers } from './utils';

// --- Command Handlers ---

export async function handleStart(bot: TelegramBot, msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const tokens = await getUserTokens(chatId);

    const message = `
📞 **Welcome to the Number Lookup Bot!**

This bot uses the *numberinfo* service to look up mobile number details.

💰 **Token System:**
• 1 Lookup = 1 Token
• Your current balance: **${tokens} Tokens**

➡️ **Available Commands:**
• /lookup <number>: Perform a lookup (e.g., \`/lookup 9818368263\`)
• /balance: Check your current token balance.
• /buy: See pricing and buy more tokens.
• /help: View this guide and all commands.

*To perform a lookup, ensure you have sufficient tokens.*
    `;
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

export async function handleHelp(bot: TelegramBot, msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const isAdmin = chatId.toString() === config.ADMIN_CHAT_ID;

    let helpText = `
📖 **Bot Commands Reference**

**User Commands:**
• /start: Show the welcome message and token balance.
• /lookup \`<number>\`: Performs a number lookup (e.g., \`/lookup 9818368263\`). *Costs 1 Token.*
• /balance: Check your current token balance.
• /buy: View token pricing and payment options.

`;
    
    if (isAdmin) {
        helpText += `
**⚙️ Admin Commands (For ${config.ADMIN_CHAT_ID}):**
• /addtokens \`<UserID>\` \`<Tokens>\`: Credit tokens to a user (e.g., \`/addtokens 12345678 10\`).
• /removeallusers: **DANGER!** Completely clear the entire token database.
`;
    }

    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

export async function handleBalance(bot: TelegramBot, msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const tokens = await getUserTokens(chatId);

    bot.sendMessage(chatId, `Your current token balance is: **${tokens} Tokens**.\n\nType \`/buy\` to add more tokens.`, { parse_mode: 'Markdown' });
}

export async function handleBuy(bot: TelegramBot, msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const price = config.TOKEN_PRICE.toFixed(2);
    
    const message = `
💳 **Buy Tokens**

The price for 1 token is **₹${price}** (INR).

Select a token package below to generate a UPI payment link and QR code. You will need to share the payment screenshot with the admin (${config.ADMIN_CHAT_ID}) after payment to receive your tokens.
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '5 Tokens (₹' + (5 * config.TOKEN_PRICE).toFixed(2) + ')', callback_data: 'buy_5' }],
            [{ text: '10 Tokens (₹' + (10 * config.TOKEN_PRICE).toFixed(2) + ')', callback_data: 'buy_10' }],
            [{ text: '20 Tokens (₹' + (20 * config.TOKEN_PRICE).toFixed(2) + ')', callback_data: 'buy_20' }],
        ]
    };

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
    });
}

// New: Handle adding tokens (Admin Only)
export async function handleAddTokens(bot: TelegramBot, msg: Message, targetUserId: number, tokensToAdd: number): Promise<void> {
    const chatId = msg.chat.id;

    // 1. Permission Check
    if (chatId.toString() !== config.ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, '❌ **Permission Denied.** This command is only for the bot administrator.', { parse_mode: 'Markdown' });
        return;
    }

    // 2. Logic Check
    if (tokensToAdd <= 0 || isNaN(targetUserId)) {
        bot.sendMessage(chatId, '❌ Usage: \`/addtokens <UserID> <Tokens>\` (Tokens must be > 0 and UserID must be a number).', { parse_mode: 'Markdown' });
        return;
    }

    try {
        // 3. Update Tokens
        const currentTokens = await getUserTokens(targetUserId);
        const newTokens = currentTokens + tokensToAdd;
        await setUserTokens(targetUserId, newTokens);

        // 4. Send Confirmation to Admin
        bot.sendMessage(chatId, 
            `✅ **Tokens Added Successfully!**\n\n` +
            `User ID: \`${targetUserId}\`\n` +
            `Tokens Added: **${tokensToAdd}**\n` +
            `New Balance: **${newTokens}**`, 
            { parse_mode: 'Markdown' }
        );
        
        // 5. Notify the User (best effort)
        bot.sendMessage(targetUserId, 
            `🎉 **Congratulations!**\n\n` +
            `Your account has been credited with **${tokensToAdd} Tokens** by the administrator.\n` +
            `Your new balance is: **${newTokens} Tokens**.\n\n` +
            `You can now use the \`/lookup <number>\` command.`,
            { parse_mode: 'Markdown' }
        ).catch(error => {
            // Log a warning if the user cannot be notified
            bot.sendMessage(chatId, `⚠️ **Warning:** Could not send a notification to user ID \`${targetUserId}\`. They may have blocked the bot.`, { parse_mode: 'Markdown' });
            console.warn(`Could not send notification to user ${targetUserId}:`, error.message);
        });

    } catch (error) {
        console.error('Error in handleAddTokens:', error);
        bot.sendMessage(chatId, '❌ An error occurred while trying to update tokens.', { parse_mode: 'Markdown' });
    }
}

// New: Handle removing all users (Admin Only)
export async function handleRemoveAllUsers(bot: TelegramBot, msg: Message): Promise<void> {
    const chatId = msg.chat.id;

    // 1. Permission Check
    if (chatId.toString() !== config.ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, '❌ **Permission Denied.** This command is only for the bot administrator.', { parse_mode: 'Markdown' });
        return;
    }

    try {
        await removeAllUsers();
        bot.sendMessage(chatId, '🔥 **DANGER: All user token data has been completely wiped from the database.**', { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in handleRemoveAllUsers:', error);
        bot.sendMessage(chatId, '❌ An error occurred while trying to clear the database.', { parse_mode: 'Markdown' });
    }
}

export async function handleLookup(bot: TelegramBot, msg: Message, numberString: string): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) {
        bot.sendMessage(chatId, '❌ Could not retrieve your user ID. Please try the /start command.');
        return;
    }
    
    // 1. Token Check
    const currentTokens = await getUserTokens(userId);
    if (currentTokens < 1) {
        bot.sendMessage(chatId, '🛑 **Insufficient Tokens!**\n\n1 lookup costs 1 token. Your current balance is 0.\n\nType \`/buy\` to add more tokens.', { parse_mode: 'Markdown' });
        return;
    }

    // 2. Normalize Number
    const lookupNumber = normalizeNumber(numberString);

    if (lookupNumber.length < 5 || lookupNumber.length > 15) {
        bot.sendMessage(chatId, '❌ Invalid number format. Please ensure the number is clean and reasonable length (e.g., `9818368263`).', { parse_mode: 'Markdown' });
        return;
    }

    try {
        // 3. Perform API Lookup
        const response = await axios.get(config.API_BASE_URL, {
            params: {
                key: config.API_KEY,
                number: lookupNumber
            },
            timeout: 10000 // 10 second timeout
        });

        // 4. Check for API success
        const apiData = response.data;
        
        let resultMessage: string;

        if (apiData.status === 'success' && apiData.data) {
            const data = apiData.data;
            resultMessage = `
✅ **Lookup Successful!** (1 Token Used)

📞 **Number:** \`${lookupNumber}\`
👤 **Name:** **${data.name || 'N/A'}**
📍 **Address:** ${data.address || 'N/A'}
🌐 **Operator/Provider:** ${data.operator || 'N/A'}
🌍 **State/Circle:** ${data.state || 'N/A'}
`;
            
            // 5. Deduct Token on Success
            await setUserTokens(userId, currentTokens - 1);

        } else if (apiData.status === 'error') {
            resultMessage = `❌ **Lookup Failed!**\n\nAPI Error: *${apiData.message || 'The API returned an unknown error.'}*\n\nYour token was **NOT** used.`;
        } else {
            resultMessage = `⚠️ **Lookup Status Unknown**\n\nCould not parse response from the API. Please try again later. Your token was **NOT** used.`;
        }

        bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("API Lookup Error:", error);
        bot.sendMessage(chatId, '❌ **Internal Error:** Could not connect to the lookup service. Please try again in a few moments. Your token was **NOT** used.', { parse_mode: 'Markdown' });
    }
}

export async function handleCallbackQuery(bot: TelegramBot, query: CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (!chatId || !data) return;

    await bot.answerCallbackQuery(query.id); // Acknowledge the button press

    if (data.startsWith('buy_')) {
        const tokens = parseInt(data.replace('buy_', ''));
        if (isNaN(tokens)) return;

        const amount = tokens * config.TOKEN_PRICE;

        try {
            const qrBase64 = await generateUpiQr(amount, tokens, userId);

            const caption = `
💰 **Payment Details for ${tokens} Tokens**

1. **Amount:** **₹${amount.toFixed(2)}** INR
2. **UPI ID:** \`${config.UPI_ID}\`
3. **Reference Note (important!):** \`TGBOT-${userId}-BUY-${tokens}\`

**ACTION REQUIRED:**
1. Scan the QR code or click the UPI link to pay **₹${amount.toFixed(2)}**.
2. **IMPORTANT:** After payment, forward the transaction screenshot (or send a message with the UTR/Reference ID) to the Admin: **${config.ADMIN_CHAT_ID}**
3. Your tokens will be manually credited shortly after verification.
            `;

            // Send the QR code image
            await bot.sendPhoto(chatId, Buffer.from(qrBase64, 'base64'), {
                caption: caption,
                parse_mode: 'Markdown',
            });
            
        } catch (error) {
            console.error('Error in handleCallbackQuery:', error);
            bot.sendMessage(chatId, '❌ Failed to generate payment details. Please try again later.', { parse_mode: 'Markdown' });
        }
    }
}