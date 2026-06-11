import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-8">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
