// src/utils.ts (SQLite Implementation)
import * as qrcode from 'qrcode';
import { BotConfig } from './types';
import Database from 'better-sqlite3';

// --- Configuration Constants ---
const BOT_TOKEN_VALUE = process.env.BOT_TOKEN;
const DB_PATH = './db/tokens.sqlite';

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

// --- SQLite Database Initialization ---
let db: Database.Database | null = null;

function initializeDatabase(): Database.Database {
    if (db) {
        return db;
    }
    
    try {
        // We set the database object to be read/write and potentially create it if missing
        db = new Database(DB_PATH, { verbose: console.log });
        
        // Create the tokens table if it does not exist
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_tokens (
                user_id INTEGER PRIMARY KEY,
                tokens INTEGER NOT NULL DEFAULT 0
            )
        `).run();

        console.log('SQLite database initialized successfully.');
        return db;
    } catch (error) {
        console.error('CRITICAL: Failed to initialize SQLite database:', error);
        throw new Error('Database initialization failed.');
    }
}

// Initialize the database connection when the module loads
const database = initializeDatabase();

// --- Token Management Functions (SQLite) ---

export async function getUserTokens(userId: number): Promise<number> {
    const stmt = database.prepare('SELECT tokens FROM user_tokens WHERE user_id = ?');
    const row: { tokens: number } | undefined = stmt.get(userId) as any;
    return row ? row.tokens : 0;
}

export async function setUserTokens(userId: number, tokens: number): Promise<void> {
    const stmt = database.prepare(`
        INSERT INTO user_tokens (user_id, tokens) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET tokens=excluded.tokens
    `);
    stmt.run(userId, tokens);
}

export async function removeAllUsers(): Promise<void> {
    // WARNING: This clears ALL user token data.
    database.prepare('DELETE FROM user_tokens').run();
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