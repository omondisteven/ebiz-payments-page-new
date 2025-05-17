"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

interface QrData {
  TransactionType: string;
  Amount?: number;
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
          const result = eval(sanitizedInput);
          setLiveResult(result.toString());
        } else {
          setLiveResult('0');
        }
      } else {
        setLiveResult('0');
      }
    } catch {
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
  const [dataFromForm, setDataFromForm] = useState<DataFromForm>({
    mpesa_phone: "",
    name: "",
    amount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [stkQueryLoading, setStkQueryLoading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [transactionType, setTransactionType] = useState("");

  useEffect(() => {
    const qrDataParam = searchParams.get('data');
    if (qrDataParam) {
      try {
        let decodedData;
        
        try {
          decodedData = decodeURIComponent(escape(atob(qrDataParam)));
        } catch {
          decodedData = decodeURIComponent(qrDataParam);
        }

        const parsedData: QrData = JSON.parse(decodedData);
        if (!parsedData.TransactionType) {
          toast.error("Missing transaction type in QR data");
          return;
        }

        setTransactionType(parsedData.TransactionType);
        setDataFromForm(prev => ({
          ...prev,
          amount: parsedData.Amount || 0
        }));
      } catch {
        toast.error("Failed to process QR code");
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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

    const { data: stkData, error: stkError } = await sendStkPush({
      mpesa_number: formData.mpesa_number,
      amount: formData.amount
    });

    if (stkError) {
      setLoading(false);
      return alert(stkError);
    }

    setStkQueryLoading(true);
    stkPushQueryWithIntervals(stkData.CheckoutRequestID);
  };

  const stkPushQueryWithIntervals = (checkoutRequestId: string) => {
    let reqCount = 0;
    const timer = setInterval(async () => {
      reqCount += 1;

      if (reqCount === 15) {
        clearInterval(timer);
        setStkQueryLoading(false);
        setLoading(false);
        alert("Payment timed out");
        return;
      }

      try {
        const { data, error } = await stkPushQuery(checkoutRequestId);

        if (error) {
          clearInterval(timer);
          setStkQueryLoading(false);
          setLoading(false);
          alert(error.message || "Payment failed");
          return;
        }

        if (data?.ResultCode === "0") {
          clearInterval(timer);
          setStkQueryLoading(false);
          setLoading(false);
          setSuccess(true);
        } else {
          clearInterval(timer);
          setStkQueryLoading(false);
          setLoading(false);
          alert(data?.ResultDesc || "Payment failed");
        }
      } catch {
        clearInterval(timer);
        setStkQueryLoading(false);
        setLoading(false);
        alert("An unexpected error occurred");
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 items-center">
      <div className="w-full max-w-md p-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-center text-green-600 mb-4">
            M-PESA PAYMENT
          </h2>
          
          {stkQueryLoading ? (
            <STKPushQueryLoading number={dataFromForm.mpesa_phone} />
          ) : success ? (
            <PaymentSuccess />
          ) : (
            <>
              <p className="text-center mb-4">
                {transactionType ? (
                  <>Transaction: <strong>{transactionType}</strong></>
                ) : (
                  "Enter payment details"
                )}
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Name</label>
                  <input
                    type="text"
                    required
                    value={dataFromForm.name}
                    onChange={(e) => setDataFromForm({...dataFromForm, name: e.target.value})}
                    placeholder="Your name"
                    className="w-full p-3 border rounded"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">Mpesa Number</label>
                  <input
                    type="text"
                    required
                    value={dataFromForm.mpesa_phone}
                    onChange={(e) => setDataFromForm({...dataFromForm, mpesa_phone: e.target.value})}
                    placeholder="07XXXXXXXX"
                    className="w-full p-3 border rounded"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      value={dataFromForm.amount || ""}
                      onChange={(e) => setDataFromForm({...dataFromForm, amount: Number(e.target.value)})}
                      placeholder="Amount"
                      className="w-full p-3 border rounded pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCalculator(true)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    >
                      <HiCalculator className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  {showCalculator && (
                    <Calculator
                      onCalculate={(result) => {
                        setDataFromForm({...dataFromForm, amount: Number(result)});
                        setShowCalculator(false);
                      }}
                      onClose={() => setShowCalculator(false)}
                      onClear={() => setDataFromForm({...dataFromForm, amount: 0})}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full p-3 rounded-md text-white font-medium ${
                    loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loading ? "Processing..." : (
                    <>
                      <HiOutlineCreditCard className="inline mr-2" />
                      Proceed with Payment
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          Powered by{' '}
          <Link href="https://www.bltasolutions.co.ke" className="text-green-600 hover:underline">
            BLTA Solutions
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PaymentForm;