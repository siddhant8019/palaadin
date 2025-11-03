"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

export default function Home(): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-800 mb-4">
          Sales Intelligence Platform
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          AI-powered sales intelligence with intelligent web scraping
        </p>
        <div className="flex gap-4 justify-center">
          <a href="/login" className="btn-primary">
            Get Started
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Documentation
          </a>
        </div>
      </div>
    </main>
  );
}

