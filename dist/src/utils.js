"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.getUserTokens = getUserTokens;
exports.setUserTokens = setUserTokens;
exports.generateUpiQr = generateUpiQr;
// src/utils.ts
const qrcode = __importStar(require("qrcode"));
// --- Configuration Constants ---
exports.config = {
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
const userTokens = {};
function getUserTokens(userId) {
    return userTokens[userId] || 0;
}
function setUserTokens(userId, tokens) {
    userTokens[userId] = tokens;
}
// --- UPI QR Code Generation ---
/**
 * Generates a UPI deep-link URL and returns the QR code as a base64 encoded string.
 * @returns {Promise<string>} Base64 encoded PNG of the QR code.
 */
async function generateUpiQr(amount, tokens, userId) {
    const transactionNote = `TGBOT-${userId}-BUY-${tokens}`;
    // UPI Intent format: upi://pay?pa=<UPI ID>&pn=<Payee Name>&am=<Amount>&cu=INR&tn=<Transaction Note>
    const upiUrl = `upi://pay?pa=${exports.config.UPI_ID}&pn=NumberLookupBot&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    // Generate QR code as a base64 data URL
    try {
        const qrBase64 = await qrcode.toDataURL(upiUrl, { type: 'image/png' });
        // Telegram requires the base64 part only, not the data URI prefix
        return qrBase64.replace(/^data:image\/png;base64,/, '');
    }
    catch (err) {
        console.error("QR Code generation error:", err);
        throw new Error("Failed to generate QR code.");
    }
}
