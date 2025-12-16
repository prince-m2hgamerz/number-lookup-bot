// src/types.ts

// Structure for the API response
export interface NumberLookupData {
    name: string;
    operator: string;
    city: string;
    state: string;
    source: string;
}

export interface LookupApiResponse {
    status: 'success' | 'error';
    message?: string;
    data?: NumberLookupData;
}

// User token storage
export interface UserTokens {
    [userId: number]: number;
}

// Configuration constants
export interface BotConfig {
    BOT_TOKEN: string;
    ADMIN_CHAT_ID: string;
    UPI_ID: string;
    API_BASE_URL: string;
    API_KEY: string;
    TOKEN_PRICE: number; // 0.50 Rupee
}