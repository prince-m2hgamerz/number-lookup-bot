// src/utils.ts
import * as qrcode from 'qrcode';
import { UserTokens, BotConfig } from './types';

// --- Configuration Constants ---
const BOT_TOKEN_VALUE = process.env.BOT_TOKEN;

// FIX: Defensive check to prevent silent crashes if Vercel doesn't map the env var
if (!BOT_TOKEN_VALUE || BOT_TOKEN_VALUE.trim() === '') {
    // This message will appear prominently in Vercel logs if mapping failed.
    throw new Error("CRITICAL STARTUP ERROR: BOT_TOKEN environment variable is missing or empty.");
}

export const config: BotConfig = {
    BOT_TOKEN: BOT_TOKEN_VALUE,
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '8285886169',
    UPI_ID: process.env.UPI_ID || 'paytm.s1pvwh6@pty',
    API_KEY: process.env.API_KEY || 'subharansu-200',
    API_BASE_URL: 'https://numberinfo.m2hgamerz.workers.dev/',
    TOKEN_PRICE: 0.50,
};

// --- Token Management (Simulated DB) ---
// WARNING: This map will NOT persist between Vercel serverless function invocations.
const userTokens: UserTokens = {};

export function getUserTokens(userId: number): number {
    return userTokens[userId] || 0;
}

export function setUserTokens(userId: number, tokens: number): void {
    userTokens[userId] = tokens;
}

// --- UPI QR Code Generation ---
export async function generateUpiQr(amount: number, tokens: number, userId: number): Promise<string> {
    const transactionNote = `TGBOT-${userId}-BUY-${tokens}`;
    const upiUrl = `upi://pay?pa=${config.UPI_ID}&pn=NumberLookupBot&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    
    try {
        const qrBase64 = await qrcode.toDataURL(upiUrl, { type: 'image/png' });
        return qrBase64.replace(/^data:image\/png;base64,/, '');
    } catch (err) {
        console.error("QR Code generation error:", err);
        throw new Error("Failed to generate QR code.");
    }
}