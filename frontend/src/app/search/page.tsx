"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SearchBar } from "@/components/search/SearchBar";
import { ResultsDisplay } from "@/components/search/ResultsDisplay";
import { queryService, IQueryResponse } from "@/services/query.service";
import { useAuthStore } from "@/store/auth.store";

function SearchContent(): JSX.Element {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IQueryResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  const handleQuery = async (query: string): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await queryService.submitQuery({
        query,
        sessionId,
      });

      setResult(response);
      setSessionId(response.sessionId);
    } catch (error) {
      setResult({
        answer: "Sorry, I encountered an error processing your query.",
        sessionId: sessionId || "",
        queryType: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-800">
            AI Search
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-secondary text-sm"
            >
              Dashboard
            </button>
            <div className="text-sm text-neutral-600">
              <span className="font-medium">{user?.email}</span>
            </div>
            <button onClick={handleLogout} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Conversational Intelligence Search
          </h2>
          <p className="text-neutral-600">
            Ask questions in natural language. I'll search the database and
            provide answers.
          </p>
        </div>

        <div className="mb-8">
          <SearchBar onSubmit={handleQuery} isLoading={isLoading} />
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-neutral-600">Processing your query...</p>
          </div>
        )}

        {!isLoading && result && (
          <ResultsDisplay
            answer={result.answer}
            data={result.data}
            metadata={result.metadata}
          />
        )}

        {!result && !isLoading && (
          <div className="text-center py-12 text-neutral-500">
            <p className="text-lg mb-4">Start by asking a question</p>
            <div className="space-y-2 text-sm">
              <p>Examples:</p>
              <p className="text-neutral-400">"Show me all tech companies"</p>
              <p className="text-neutral-400">"Find people in San Francisco"</p>
              <p className="text-neutral-400">"Companies in the software industry"</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Search(): JSX.Element {
  return (
    <ProtectedRoute>
      <SearchContent />
    </ProtectedRoute>
  );
}

