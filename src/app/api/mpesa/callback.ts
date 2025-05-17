import { NextRequest, NextResponse } from "next/server";

// Accept context to access params
export async function POST(request: NextRequest, context: { params: { securityKey: string } }) {
  const clientIp =
    request.headers.get("x-forwarded-for") || request.headers.get("remote-addr");

  const whitelist = [
    "196.201.214.200",
    "196.201.214.206",
    "196.201.213.114",
    "196.201.214.207",
    "196.201.214.208",
    "196.201.213.44",
    "196.201.212.127",
    "196.201.212.138",
    "196.201.212.129",
    "196.201.212.136",
    "196.201.212.74",
    "196.201.212.69",
  ];

  if (!clientIp || !whitelist.includes(clientIp)) {
    return NextResponse.json({ error: "IP not whitelisted" }, { status: 403 });
  }

  const data = await request.json();
  const { securityKey } = context.params;

  if (securityKey !== process.env.MPESA_CALLBACK_SECRET_KEY) {
    return NextResponse.json("ok saf");
  }

  if (!data.Body.stkCallback.CallbackMetadata) {
    console.log(data.Body.stkCallback.ResultDesc);
    return NextResponse.json("ok saf");
  }

  const body = data.Body.stkCallback.CallbackMetadata;

  const amountObj = body.Item.find((obj: any) => obj.Name === "Amount");
  const codeObj = body.Item.find((obj: any) => obj.Name === "MpesaReceiptNumber");
  const phoneNumberObj = body.Item.find((obj: any) => obj.Name === "PhoneNumber");

  const amount = amountObj?.Value;
  const mpesaCode = codeObj?.Value;
  const phoneNumber = phoneNumberObj?.Value?.toString();

  try {
    console.log({ amount, mpesaCode, phoneNumber });
    return NextResponse.json("ok", { status: 200 });
  } catch (error: any) {
    return NextResponse.json("ok");
  }
}
