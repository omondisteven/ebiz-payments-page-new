"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendStkPush } from "@/actions/stkPush";
import { stkPushQuery } from "@/actions/stkPushQuery";
import PaymentSuccess from "./Success";
import STKPushQueryLoading from "./StkQueryLoading";
import { HiOutlineCreditCard, HiCalculator, HiX } from "react-icons/hi";
import toast from "react-hot-toast";
import Link from "next/link";

interface DataFromForm {
  mpesa_phone: string;
  name: string;
  amount: number;
}

const Calculator = ({ 
  onCalculate, 
  onClose, 
  onClear 
}: { 
  onCalculate: (result: string) => void, 
  onClose: () => void,
  onClear: () => void 
}) => {
  const [input, setInput] = useState('');
  const [liveResult, setLiveResult] = useState('0');

  useEffect(() => {
    try {
      if (input) {
        const sanitizedInput = input.replace(/[+\-*/]+$/, '');
        if (sanitizedInput) {
          // eslint-disable-next-line no-eval
          const result = eval(sanitizedInput);
          setLiveResult(result.toString());
        } else {
          setLiveResult('0');
        }
      } else {
        setLiveResult('0');
      }
    } catch (error) {
      setLiveResult('Error');
    }
  }, [input]);

  const handleButtonClick = (value: string) => {
    if (value === 'OK') {
      if (liveResult !== 'Error') {
        onCalculate(liveResult);
        onClose();
      }
    } else if (value === 'C') {
      setInput('');
      setLiveResult('0');
      onClear();
    } else if (value === '⌫') {
      setInput(input.slice(0, -1));
    } else {
      const lastChar = input.slice(-1);
      if (['+', '-', '*', '/'].includes(value) && ['+', '-', '*', '/'].includes(lastChar)) {
        setInput(input.slice(0, -1) + value);
      } else {
        setInput(input + value);
      }
    }
  };

  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    '0', '.', '⌫', '+',
    'C', 'OK'
  ];

  return (
    <div className="mt-2 bg-white rounded-lg shadow-md p-2 border border-gray-200 relative">
      <button 
        onClick={onClose}
        className="absolute top-1 right-1 text-gray-500 hover:text-gray-700"
      >
        <HiX className="h-4 w-4" />
      </button>
      
      <div className="mb-2 p-2 bg-gray-100 rounded">
        <div className="text-gray-600 text-sm h-5 text-right">{input || '0'}</div>
        <div className={`text-lg font-semibold text-right ${
          liveResult === 'Error' ? 'text-red-500' : 'text-gray-800'
        }`}>
          {liveResult}
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn}
            onClick={() => handleButtonClick(btn)}
            className={`p-2 rounded-md text-center font-medium 
              ${btn === 'OK' ? 'bg-green-500 text-white hover:bg-green-600' : 
                btn === 'C' ? 'bg-red-500 text-white hover:bg-red-600' : 
                btn === '⌫' ? 'bg-gray-500 text-white hover:bg-gray-600' : 
                'bg-gray-200 hover:bg-gray-300'}`}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
};

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dataFromForm, setDataFromForm] = useState<DataFromForm>({
    mpesa_phone: "",
    name: "",
    amount: 0,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [stkQueryLoading, setStkQueryLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [transactionType, setTransactionType] = useState("");
  const [qrData, setQrData] = useState<any>({});

  // QR code data processing
  useEffect(() => {
    const qrDataParam = searchParams.get('data');
    if (qrDataParam) {
      try {
        let decodedData;
        
        try {
          decodedData = decodeURIComponent(escape(atob(qrDataParam)));
        } catch (base64Err) {
          console.warn("Base64 decode failed, trying URI decode");
          decodedData = decodeURIComponent(qrDataParam);
        }

        let parsedData = JSON.parse(decodedData);
        if (!parsedData.TransactionType) {
          toast.error("Missing transaction type in QR data");
          return;
        }

        setTransactionType(parsedData.TransactionType);
        setQrData(parsedData);
        setDataFromForm(prev => ({
          ...prev,
          amount: parsedData.Amount || 0
        }));

      } catch (e) {
        console.error("Error processing QR code data:", e);
        toast.error("Failed to process QR code");
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const formData = {
      mpesa_number: dataFromForm.mpesa_phone.trim(),
      name: dataFromForm.name.trim(),
      amount: dataFromForm.amount,
    };

    const kenyanPhoneNumberRegex =
      /^(07\d{8}|01\d{8}|2547\d{8}|2541\d{8}|\+2547\d{8}|\+2541\d{8})$/;

    if (!kenyanPhoneNumberRegex.test(formData.mpesa_number)) {
      setLoading(false);
      return alert("Invalid Mpesa number format.");
    }

    const { data: stkData, error: stkError } = await sendStkPush(formData);

    if (stkError) {
      setLoading(false);
      return alert(stkError);
    }

    const checkoutRequestId = stkData.CheckoutRequestID;

    setStkQueryLoading(true);
    stkPushQueryWithIntervals(checkoutRequestId);
  };

  const stkPushQueryWithIntervals = (CheckoutRequestID: string) => {
    let reqcount = 0;

    const timer = setInterval(async () => {
      reqcount += 1;

      if (reqcount === 15) {
        clearInterval(timer);
        setStkQueryLoading(false);
        setLoading(false);
        setErrorMessage("You took too long to complete the payment.");
        alert("You took too long to complete the payment.");
        return;
      }

      try {
        const { data, error } = await stkPushQuery(CheckoutRequestID);

        if (error) {
          // Type assertion for the error object
          const apiError = error as {
            response?: {
              data?: {
                errorCode?: string;
                errorMessage?: string;
              };
            };
            message?: string;
          };

          const errCode = apiError?.response?.data?.errorCode;
          const errMsg = apiError?.response?.data?.errorMessage || 
                        apiError?.message || 
                        "An error occurred";

          if (errCode && errCode !== "500.001.1001") {
            clearInterval(timer);
            setStkQueryLoading(false);
            setLoading(false);
            setErrorMessage(errMsg);
            alert(errMsg);
          }
          return;
        }

        if (data) {
          if (data.ResultCode === "0") {
            clearInterval(timer);
            setStkQueryLoading(false);
            setLoading(false);
            setSuccess(true);
          } else {
            clearInterval(timer);
            setStkQueryLoading(false);
            setLoading(false);
            setErrorMessage(data?.ResultDesc || "Payment failed.");
            alert(data?.ResultDesc || "Payment failed.");
          }
        }
      } catch (untypedError) {
        const error = untypedError as { message?: string };
        clearInterval(timer);
        setStkQueryLoading(false);
        setLoading(false);
        setErrorMessage(error?.message || "An unexpected error occurred");
        alert(error?.message || "An unexpected error occurred");
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 items-center">
      <div className="w-full md:w-full lg:w-full xl:w-full 2xl:w-full flex flex-col flex-grow max-w-2xl">
        
        <div className="p-4 border-b border-gray-200 bg-white shadow-sm rounded-t-lg w-full px-4 mt-2">
          <h2 className="text-xl font-bold text-center" style={{ color: "#3CB371" }}>
            M-PESA PAYMENT PROMPT
          </h2>
        </div>

        <div className="flex-1 p-4 overflow-auto w-full px-4">
          {stkQueryLoading ? (
            <STKPushQueryLoading number={dataFromForm.mpesa_phone} />
          ) : success ? (
            <PaymentSuccess />
          ) : (
            <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-4 mb-4 border border-gray-200 w-full">
              <div className="text-center">
                <p className="text-lg mb-4 text-center">
                  {transactionType ? (
                    <>You are about to perform a <strong>{transactionType}</strong> transaction.</>
                  ) : (
                    <>Provide your details to process the payment.</>
                  )}
                </p>
              </div>
              <hr />
              <br />

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold">Name</label>
                  <input
                    type="text"
                    required
                    name="name"
                    value={dataFromForm.name}
                    onChange={(e) =>
                      setDataFromForm({ ...dataFromForm, name: e.target.value })
                    }
                    placeholder="John Doe"
                    className="block w-full rounded-md border border-gray-200 bg-white px-4 py-4 text-black placeholder-gray-500 caret-orange-500 transition-all duration-200 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold">Mpesa Number</label>
                  <input
                    type="text"
                    name="mpesa_phone"
                    required
                    value={dataFromForm.mpesa_phone}
                    onChange={(e) =>
                      setDataFromForm({ ...dataFromForm, mpesa_phone: e.target.value })
                    }
                    placeholder="07XXXXXXXX"
                    className="block w-full rounded-md border border-gray-200 bg-white px-4 py-4 text-black placeholder-gray-500 caret-orange-500 transition-all duration-200 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      name="amount"
                      min={1}
                      value={dataFromForm.amount || ""}
                      onChange={(e) =>
                        setDataFromForm({ ...dataFromForm, amount: Number(e.target.value) })
                      }
                      placeholder="Enter amount"
                      className="block w-full rounded-md border border-gray-200 bg-white px-4 py-4 text-black placeholder-gray-500 caret-orange-500 transition-all duration-200 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    />
                    <button 
                      onClick={() => setShowCalculator(true)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    >
                      <HiCalculator className="h-5 w-5" />
                    </button>
                  </div>
                  {showCalculator && (
                    <Calculator 
                      onCalculate={(result) => setDataFromForm({ ...dataFromForm, amount: Number(result) })} 
                      onClose={() => setShowCalculator(false)}
                      onClear={() => setDataFromForm({ ...dataFromForm, amount: 0 })}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-4 text-base font-semibold text-white transition-all duration-200 hover:bg-green-700 focus:bg-green-700 focus:outline-none"
                >
                  <HiOutlineCreditCard className="mr-2" />
                  {loading ? "Processing..." : "Proceed With Payment"}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white shadow-sm rounded-b-lg w-full px-4 mb-2">
          <button
            className="font-bold w-full bg-gray-700 text-white py-3 rounded-md shadow-md flex items-center justify-center"
            onClick={() => window.location.href = "/"}
          >
            <HiX className="mr-2" />
            Cancel
          </button>
        </div>

        <div className="py-4 text-center text-sm text-gray-500 w-full">
          Powered by{' '}
          <Link 
            href="https://www.bltasolutions.co.ke" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-800 hover:underline"
          >
            BLTA Solutions
          </Link>
        </div>
      </div>
    </div>
  );

}

export default PaymentForm;