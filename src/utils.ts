// src/utils.ts (PostgreSQL/Neon Implementation)
import * as qrcode from 'qrcode';
import { BotConfig } from './types';
import { Client } from 'pg'; // PostgreSQL client

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

// --- PostgreSQL Database Initialization ---

// Initialize a single database client instance (Best practice for Serverless)
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Necessary for some cloud connections like Neon
});

// Function to ensure the database connection is established and table exists
async function ensureDbConnected(): Promise<void> {
    if (client.host === undefined) {
        console.error("CRITICAL: DATABASE_URL is not set.");
        throw new Error("Database configuration error.");
    }
    
    // Connect client (only connects if not already connected)
    if (!client.host) { // A crude check to see if we need to connect
        await client.connect();
        console.log('PostgreSQL database connected.');
    }

    // Ensure table exists (Idempotent operation)
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_tokens (
            user_id BIGINT PRIMARY KEY,
            tokens INTEGER NOT NULL DEFAULT 0
        );
    `);
}

// --- Token Management Functions (PostgreSQL) ---

export async function getUserTokens(userId: number): Promise<number> {
    await ensureDbConnected();
    const result = await client.query('SELECT tokens FROM user_tokens WHERE user_id = $1', [userId]);
    
    // Return tokens if row exists, otherwise 0
    return result.rows.length > 0 ? result.rows[0].tokens : 0;
}

export async function setUserTokens(userId: number, tokens: number): Promise<void> {
    await ensureDbConnected();
    // INSERT or UPDATE (UPSERT)
    const query = `
        INSERT INTO user_tokens (user_id, tokens) 
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE 
        SET tokens = $2;
    `;
    await client.query(query, [userId, tokens]);
}

export async function removeAllUsers(): Promise<void> {
    await ensureDbConnected();
    // WARNING: This clears ALL user token data.
    await client.query('DELETE FROM user_tokens');
}

// --- Utility Functions (Rest remains the same) ---

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