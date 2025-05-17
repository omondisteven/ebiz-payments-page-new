"use server";

import axios from "axios";

interface Params {
  mpesa_number: string;
  amount: number;
}

export const sendStkPush = async (body: Params) => {
  const mpesaEnv = process.env.MPESA_ENVIRONMENT;
  const MPESA_BASE_URL =
    mpesaEnv === "live"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const { mpesa_number: phoneNumber, amount } = body;

  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const resp = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { authorization: `Basic ${auth}` } }
    );

    const token = resp.data.access_token;
    const cleanedNumber = phoneNumber.replace(/\D/g, "");
    const formattedPhone = `254${cleanedNumber.slice(-9)}`;

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
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: "https://mydomain.com/callback-url-path",
        AccountReference: phoneNumber,
        TransactionDesc: "Payment",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return { data: response.data };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "An unexpected error occurred" };
  }
};