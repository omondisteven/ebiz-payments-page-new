// /src/actions/stkPush.ts
"use server";

import axios from "axios";

interface Params {
  mpesa_number: string;
  amount: number;
}

const MPESA_BASE_URL = process.env.MPESA_ENVIRONMENT === "live"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

// Helper function to format phone numbers
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return cleaned;
  }
  if (cleaned.length === 9) {
    return `254${cleaned}`;
  }
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `254${cleaned.substring(1)}`;
  }
  
  throw new Error('Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX');
};

// Helper function to generate timestamp
const getTimestamp = (): string => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
};

const getAuthToken = async (): Promise<string> => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 5000
      }
    );

    if (!response.data.access_token) {
      throw new Error("No access token received");
    }

    return response.data.access_token;
  } catch (error: unknown) {
    let errorMessage = "Failed to authenticate with M-Pesa API";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message;
    }
    console.error("Auth error:", errorMessage);
    throw new Error(errorMessage);
  }
};

export const sendStkPush = async (body: Params): Promise<{
  data?: any;
  error?: string;
}> => {
  try {
    // Validate environment variables
    const requiredEnvVars = [
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET',
      'MPESA_SHORTCODE',
      'MPESA_PASSKEY',
      'MPESA_CALLBACK_URL'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Validate input
    if (!body.mpesa_number || !body.amount || body.amount <= 0) {
      throw new Error("Invalid request parameters");
    }

    // Get auth token
    const token = await getAuthToken();

    // Format phone number
    const formattedPhone = formatPhoneNumber(body.mpesa_number);

    // Generate timestamp and password
    const timestamp = getTimestamp();
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    // Make STK push request
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: body.amount,
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: "Payment",
        TransactionDesc: "Payment"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    return { data: response.data };
  } catch (error: unknown) {
    let errorMessage = "Failed to initiate payment";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.errorMessage || 
                   error.response?.data?.error ||
                   error.message;
    }
    
    console.error("STK Push Error:", errorMessage);
    return { error: errorMessage };
  }
};