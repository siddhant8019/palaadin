"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function DashboardContent(): JSX.Element {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-800">
            Sales Intelligence Platform
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-600">
              <span className="font-medium">{user?.email}</span>
              <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded text-xs uppercase">
                {user?.role}
              </span>
            </div>
            <button onClick={handleLogout} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8">
          <h2 className="text-xl font-semibold text-neutral-800 mb-4">
            Welcome to Your Dashboard
          </h2>
          <p className="text-neutral-600 mb-6">
            You are successfully authenticated. The conversational AI interface
            and data management features will be built in the upcoming weeks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/companies")}
            >
              <h3 className="font-semibold text-neutral-800 mb-2">Companies</h3>
              <p className="text-sm text-neutral-600">
                View and manage company data
              </p>
              <div className="mt-2 text-xs text-primary">Click to view</div>
            </div>

            <div
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/people")}
            >
              <h3 className="font-semibold text-neutral-800 mb-2">People</h3>
              <p className="text-sm text-neutral-600">
                View and manage contact data
              </p>
              <div className="mt-2 text-xs text-primary">Click to view</div>
            </div>

            <div
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/search")}
            >
              <h3 className="font-semibold text-neutral-800 mb-2">AI Search</h3>
              <p className="text-sm text-neutral-600">
                Natural language AI interface
              </p>
              <div className="mt-2 text-xs text-primary">Click to search</div>
            </div>

            <div
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/agent-mode")}
            >
              <h3 className="font-semibold text-neutral-800 mb-2">
                Agent Mode
              </h3>
              <p className="text-sm text-neutral-600">
                ChatGPT-like scraping assistant
              </p>
              <div className="mt-2 text-xs text-primary">Click to chat</div>
            </div>

            <div
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/files")}
            >
              <h3 className="font-semibold text-neutral-800 mb-2">
                File Upload
              </h3>
              <p className="text-sm text-neutral-600">
                Upload Excel and HAR files
              </p>
              <div className="mt-2 text-xs text-primary">Click to upload</div>
            </div>

            <div
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/batch-processing")}
            >
              <h3 className="font-semibold text-neutral-800 mb-2">
                Batch Processing
              </h3>
              <p className="text-sm text-neutral-600">
                Process massive datasets (1000+ records)
              </p>
              <div className="mt-2 text-xs text-primary">Click to start</div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-neutral-100 rounded-lg">
            <h3 className="font-semibold text-neutral-800 mb-2">
              Development Progress
            </h3>
            <ul className="text-sm text-neutral-600 space-y-1">
              <li>[DONE] Phase 1: Foundation, Database, Backend Core</li>
              <li>
                [DONE] Phase 2: JWT Authentication, Authorization, Login UI
              </li>
              <li>[DONE] Phase 3: AI Agent System Integration</li>
              <li>[DONE] Phase 4: Multi-Agent Scraping System</li>
              <li>[DONE] Phase 5: File Processing (Excel & HAR)</li>
              <li>[DONE] Phase 6: Intelligent Login-Aware Scraping System</li>
              <li>[NEXT] Phase 7: Advanced Agent Mode Features</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard(): JSX.Element {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
