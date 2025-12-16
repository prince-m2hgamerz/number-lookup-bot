// src/utils.ts
import * as qrcode from 'qrcode';

// DEFINITIVE FIX: Use a temporary variable to hold the module and then reliably
// extract the constructor, handling Vercel's transpilation quirks.
const StoreModule = require('json-file-store');
const Store = (StoreModule && StoreModule.default) ? StoreModule.default : StoreModule;

import { BotConfig } from './types';

// --- Configuration Constants ---
const BOT_TOKEN_VALUE = process.env.BOT_TOKEN;

// Defensive check
if (!BOT_TOKEN_VALUE || BOT_TOKEN_VALUE.trim() === '') {
    throw new Error("CRITICAL STARTUP ERROR: BOT_TOKEN environment variable is missing or empty.");
}

export const config: BotConfig = {
    BOT_TOKEN: BOT_TOKEN_VALUE,
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '8285886169',
    UPI_ID: process.env.UPI_ID || 'paytm.s1pvwh6@pty',
    API_KEY: process.env.API_KEY || 'subharansu-200',
    API_BASE_URL: 'https://numberinfo.m2hgamerz.workers.dev/',
    TOKEN_PRICE: 0.50, // Price per token in INR
};

// --- Token Management (Persistent DB) ---
// Line 64 where the error occurs:
const userStore = new Store({ file: './db/tokens.json', fallback: {} }); 

interface StoredUser {
    id: number;
    tokens: number;
}

// ... (rest of the functions remain the same) ...

export async function getUserTokens(userId: number): Promise<number> {
    const user: StoredUser | null = await userStore.load(userId);
    return user ? user.tokens : 0;
}

export async function setUserTokens(userId: number, tokens: number): Promise<void> {
    await userStore.save({ id: userId, tokens: tokens });
}

export async function removeAllUsers(): Promise<void> {
    await userStore.purge();
}

// ... (utility functions) ...
export function normalizeNumber(numberString: string): string {
    return numberString.replace(/[\s\-\(\)\+]/g, '');
}

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