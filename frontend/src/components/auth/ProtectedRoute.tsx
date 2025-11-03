"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

interface IProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const ProtectedRoute: React.FC<IProtectedRouteProps> = ({
  children,
  requireAuth = true,
}) => {
  const router = useRouter();
  const { isAuthenticated, initializeAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeAuth();
    setIsInitialized(true);
  }, [initializeAuth]);

  useEffect(() => {
    if (isInitialized && requireAuth && !isAuthenticated) {
      router.push("/login");
    }
  }, [isInitialized, isAuthenticated, requireAuth, router]);

  if (!isInitialized || (requireAuth && !isAuthenticated)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-600">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
};

