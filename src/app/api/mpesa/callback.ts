import { NextRequest, NextResponse } from "next/server";

interface CallbackItem {
  Name: string;
  Value: string | number;
}

interface CallbackMetadata {
  Item: CallbackItem[];
}

interface StkCallback {
  CallbackMetadata?: CallbackMetadata;
  ResultDesc?: string;
}

interface CallbackData {
  Body: {
    stkCallback: StkCallback;
  };
}

export async function POST(
  request: NextRequest,
  context: { params: { securityKey: string } }
) {
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
    return NextResponse.json(
      { error: "IP not whitelisted" },
      { status: 403 }
    );
  }

  if (context.params.securityKey !== process.env.MPESA_CALLBACK_SECRET_KEY) {
    return NextResponse.json("Unauthorized", { status: 401 });
  }

  const data = (await request.json()) as CallbackData;

  if (!data.Body.stkCallback.CallbackMetadata) {
    console.log(data.Body.stkCallback.ResultDesc);
    return NextResponse.json("OK", { status: 200 });
  }

  const metadata = data.Body.stkCallback.CallbackMetadata;
  const amount = metadata.Item.find((item) => item.Name === "Amount")?.Value;
  const mpesaCode = metadata.Item.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
  const phoneNumber = metadata.Item.find((item) => item.Name === "PhoneNumber")?.Value?.toString();

  try {
    console.log({ amount, mpesaCode, phoneNumber });
    return NextResponse.json("OK", { status: 200 });
  } catch {
    return NextResponse.json("OK", { status: 200 });
  }
}