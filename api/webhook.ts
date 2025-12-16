// api/webhook.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../src/utils';
import { registerCommandHandlers } from '../src/commands';

// --- Global Bot Instance & Handler Registration ---
// We create the bot instance outside the handler for reuse.
const bot = new TelegramBot(config.BOT_TOKEN);

// Flag to ensure handlers are only registered once on serverless cold start
let handlersRegistered = false;

if (!handlersRegistered) {
    registerCommandHandlers(bot);
    handlersRegistered = true;
    console.log('Telegram command handlers registered.');
}
// --- End Global Setup ---


export default async (request: VercelRequest, response: VercelResponse) => {
    // Only accept POST requests from Telegram
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const update = request.body;
        
        if (update) {
            // Process the update with the registered bot instance
            // This triggers the listeners defined in src/commands.ts
            await bot.processUpdate(update); 

            // CRITICAL: Respond immediately with 200 OK. 
            // The Telegram reply is sent via a separate request initiated by bot.processUpdate.
            return response.status(200).send('OK');
        } else {
            // No update payload, respond 200 OK
            return response.status(200).send('No Update Payload');
        }

    } catch (error) {
        // Log the error and still return 200 OK to prevent Telegram from retrying indefinitely
        console.error('Unhandled error processing update:', error);
        return response.status(200).send('Internal Error (Logged)');
    }
};