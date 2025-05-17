"use server";

import axios, { AxiosError } from "axios";

interface ErrorResponse {
  errorMessage: string;
  errorCode: string;
  response?: {
    data?: {
      errorCode?: string;
      errorMessage?: string;
    };
  };
  message?: string;
}

export const stkPushQuery = async (reqId: string) => {
  const mpesaEnv = process.env.MPESA_ENVIRONMENT;
  const MPESA_BASE_URL =
    mpesaEnv === "live"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const resp = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { authorization: `Basic ${auth}` } }
    );

    const token = resp.data.access_token;
    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: reqId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return { data: response.data };
  } catch (error) {
    // Use the ErrorResponse interface to type the error
    const apiError = error as AxiosError<ErrorResponse>;
    
    if (apiError.response) {
      // Return the structured error response
      return { 
        error: {
          response: {
            data: {
              errorCode: apiError.response.data?.errorCode,
              errorMessage: apiError.response.data?.errorMessage || apiError.message
            }
          },
          message: apiError.message
        }
      };
    }

    // For non-API errors
    return { 
      error: { 
        message: error instanceof Error ? error.message : "An unexpected error occurred" 
      } 
    };
  }
};