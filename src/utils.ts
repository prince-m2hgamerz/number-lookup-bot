// src/utils.ts (Vercel KV Version)
import * as qrcode from 'qrcode';
import { BotConfig } from './types';
import { createClient } from '@vercel/kv';

// --- Configuration Constants ---
const BOT_TOKEN_VALUE = process.env.BOT_TOKEN;

if (!BOT_TOKEN_VALUE || BOT_TOKEN_VALUE.trim() === '') {
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

// --- KV Store Initialization ---
// Vercel KV client is automatically configured using VERCEL_KV_* environment variables
const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const KV_NAMESPACE = 'tokens';

// --- Token Management Functions (Vercel KV) ---

export async function getUserTokens(userId: number): Promise<number> {
    const key = `${KV_NAMESPACE}:${userId}`;
    const tokens = await kv.get<number>(key);
    return tokens || 0; // Returns 0 if key is not found
}

export async function setUserTokens(userId: number, tokens: number): Promise<void> {
    const key = `${KV_NAMESPACE}:${userId}`;
    await kv.set(key, tokens);
}

export async function removeAllUsers(): Promise<void> {
    // WARNING: This clears all keys with the "tokens:" prefix.
    const keys = await kv.keys(`${KV_NAMESPACE}:*`);
    if (keys.length > 0) {
        await Promise.all(keys.map(key => kv.del(key)));
    }
}

// --- Utility Functions (Rest remains the same) ---

/**
 * Normalizes a phone number string for API lookup
 */
export function normalizeNumber(numberString: string): string {
    return numberString.replace(/[\s\-\(\)\+]/g, '');
}

/**
 * Generates the UPI QR code base64 string.
 */
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