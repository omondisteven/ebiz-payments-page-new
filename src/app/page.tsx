// /src/app/page.tsx
import { Suspense } from 'react';
import PaymentForm from "@/components/PaymentForm";

export default function Home() {
  return (
    <section className="bg-gray-100 max-w-400 h-screen flex justify-center items-center">
      <Suspense fallback={<div>Loading payment form...</div>}>
        <PaymentForm />
      </Suspense>
    </section>
  );
}