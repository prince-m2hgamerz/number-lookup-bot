// src/utils.ts
import * as qrcode from 'qrcode';
import { UserTokens, BotConfig } from './types';

// --- Configuration Constants ---
export const config: BotConfig = {
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '8285886169',
    UPI_ID: process.env.UPI_ID || 'paytm.s1pvwh6@pty',
    API_KEY: process.env.API_KEY || 'subharansu-200',
    API_BASE_URL: 'https://numberinfo.m2hgamerz.workers.dev/',
    TOKEN_PRICE: 0.50,
};

// --- Token Management (Simulated DB) ---
// WARNING: This map will NOT persist between Vercel serverless function invocations.
// For production, replace this with a persistent solution (e.g., Redis, FaunaDB).
const userTokens: UserTokens = {};

export function getUserTokens(userId: number): number {
    return userTokens[userId] || 0;
}

export function setUserTokens(userId: number, tokens: number): void {
    userTokens[userId] = tokens;
}

// --- UPI QR Code Generation ---
/**
 * Generates a UPI deep-link URL and returns the QR code as a base64 encoded string.
 * @returns {Promise<string>} Base64 encoded PNG of the QR code.
 */
export async function generateUpiQr(amount: number, tokens: number, userId: number): Promise<string> {
    const transactionNote = `TGBOT-${userId}-BUY-${tokens}`;
    
    // UPI Intent format: upi://pay?pa=<UPI ID>&pn=<Payee Name>&am=<Amount>&cu=INR&tn=<Transaction Note>
    const upiUrl = `upi://pay?pa=${config.UPI_ID}&pn=NumberLookupBot&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
    // Generate QR code as a base64 data URL
    try {
        const qrBase64 = await qrcode.toDataURL(upiUrl, { type: 'image/png' });
        // Telegram requires the base64 part only, not the data URI prefix
        return qrBase64.replace(/^data:image\/png;base64,/, '');
    } catch (err) {
        console.error("QR Code generation error:", err);
        throw new Error("Failed to generate QR code.");
    }
}