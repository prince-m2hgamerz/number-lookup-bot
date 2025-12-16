// src/utils.ts
import * as qrcode from 'qrcode';
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

// --- Store Management (Bypassing Static Import Error) ---
let userStoreInstance: any = null; // Use any type for the dynamic store

/**
 * Dynamically loads the Store constructor to bypass the "is not a constructor" error.
 * @returns The initialized Store instance.
 */
async function getStoreInstance(): Promise<any> {
    if (userStoreInstance) {
        return userStoreInstance;
    }
    
    // FIX: Dynamic import to avoid Vercel transpilation issues
    // We use a general import and rely on the CommonJS behavior.
    const StoreModule = await import('json-file-store');
    
    // Check for both .default and the root object for the constructor
    const Store = (StoreModule as any).default || StoreModule;

    // Line where the constructor error previously occurred, now safer due to dynamic import
    userStoreInstance = new Store({ file: './db/tokens.json', fallback: {} }); 
    return userStoreInstance;
}

interface StoredUser {
    id: number;
    tokens: number;
}

// --- Token Management Functions (Now await getStoreInstance() before use) ---

export async function getUserTokens(userId: number): Promise<number> {
    const store = await getStoreInstance();
    const user: StoredUser | null = await store.load(userId);
    return user ? user.tokens : 0;
}

export async function setUserTokens(userId: number, tokens: number): Promise<void> {
    const store = await getStoreInstance();
    await store.save({ id: userId, tokens: tokens });
}

export async function removeAllUsers(): Promise<void> {
    const store = await getStoreInstance();
    await store.purge();
}

// --- Utility Functions (Rest remains the same) ---

/**
 * Normalizes a phone number string for API lookup (e.g., removes +, spaces, dashes)
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
        // Return only the base64 part
        return qrBase64.replace(/^data:image\/png;base64,/, '');
    } catch (err) {
        console.error("QR Code generation error:", err);
        throw new Error("Failed to generate QR code.");
    }
}