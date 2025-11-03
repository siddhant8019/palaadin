"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuthStore } from "@/store/auth.store";

interface IAgentModeRequest {
  url: string;
  userMessage: string;
  credentials?: {
    username?: string;
    password?: string;
    email?: string;
    apiKey?: string;
    token?: string;
  };
  harFile?: string;
}

interface IAgentModeResponse {
  success: boolean;
  message: string;
  requiresCredentials?: boolean;
  requiresHAR?: boolean;
  analysis?: any;
  loginResult?: any;
  scrapedData?: any;
  nextSteps?: string[];
  error?: string;
}

function AgentModeContent(): JSX.Element {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      type: "user" | "agent";
      content: string;
      timestamp: Date;
      data?: any;
    }>
  >([]);
  const [currentInput, setCurrentInput] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    email: "",
    apiKey: "",
    token: "",
  });
  const [currentUrl, setCurrentUrl] = useState("");

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  const sendMessage = async (): Promise<void> => {
    if (!currentInput.trim()) return;

    const userMessage = currentInput.trim();
    setCurrentInput("");
    setIsLoading(true);

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);

    try {
      // Check if message contains a URL
      const urlMatch = userMessage.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : currentUrl;

      const request: IAgentModeRequest = {
        url: url || "",
        userMessage,
        credentials: showCredentials ? credentials : undefined,
      };

      const response = await fetch(
        "http://localhost:4000/api/query/agent-mode",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({ url, message: userMessage }),
        }
      );

      const result = await response.json();

      if (result.success) {
        const agentResponse = result.data;

        // Add agent response to chat
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: agentResponse.message,
            timestamp: new Date(),
            data: agentResponse,
          },
        ]);

        // Handle special cases
        if (agentResponse.requiresCredentials) {
          setShowCredentials(true);
        }
        if (agentResponse.requiresHAR) {
          // TODO: Implement HAR file upload
        }
        if (urlMatch) {
          setCurrentUrl(url);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: `Error: ${result.error}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          type: "agent",
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = (): void => {
    setMessages([]);
    setCurrentUrl("");
    setShowCredentials(false);
    setCredentials({
      username: "",
      password: "",
      email: "",
      apiKey: "",
      token: "",
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-800">Agent Mode</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-secondary text-sm"
            >
              Dashboard
            </button>
            <button onClick={handleLogout} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-neutral-800 mb-2">
              ChatGPT-like Agent Mode
            </h2>
            <p className="text-sm text-neutral-600">
              Ask me to scrape any website, handle authentication, or extract
              data. I can work with login credentials, HAR files, and complex
              authentication flows.
            </p>
          </div>

          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto border border-neutral-200 rounded-lg p-4 mb-4 bg-neutral-50">
            {messages.length === 0 ? (
              <div className="text-center text-neutral-500 py-8">
                <p className="text-lg font-medium mb-2">
                  Welcome to Agent Mode!
                </p>
                <p className="text-sm">
                  Try asking me to scrape a website or help with authentication.
                </p>
                <div className="mt-4 text-xs text-neutral-400">
                  <p>Examples:</p>
                  <p>"Scrape https://example.com for company data"</p>
                  <p>"Help me login to a protected site"</p>
                  <p>"Extract data from this URL"</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.type === "user"
                          ? "bg-primary text-white"
                          : "bg-white border border-neutral-200 text-neutral-800"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>

                      {/* Show scraped companies in a table */}
                      {message.data?.companies &&
                        message.data.companies.length > 0 && (
                          <div className="mt-3">
                            <p className="font-medium text-sm mb-2">
                              Found {message.data.companies.length} companies:
                            </p>
                            <div className="max-h-40 overflow-y-auto">
                              <table className="w-full text-xs border-collapse border border-neutral-200">
                                <thead>
                                  <tr className="bg-neutral-100">
                                    <th className="border border-neutral-200 px-2 py-1 text-left">
                                      #
                                    </th>
                                    <th className="border border-neutral-200 px-2 py-1 text-left">
                                      Company Name
                                    </th>
                                    <th className="border border-neutral-200 px-2 py-1 text-left">
                                      Source
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {message.data.companies
                                    .slice(0, 10)
                                    .map((company: any, i: number) => (
                                      <tr
                                        key={i}
                                        className="hover:bg-neutral-50"
                                      >
                                        <td className="border border-neutral-200 px-2 py-1">
                                          {i + 1}
                                        </td>
                                        <td className="border border-neutral-200 px-2 py-1 font-medium">
                                          {company.name}
                                        </td>
                                        <td className="border border-neutral-200 px-2 py-1 text-neutral-600">
                                          {company.source || "scraped"}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                              {message.data.companies.length > 10 && (
                                <p className="text-xs text-neutral-500 mt-1">
                                  ... and {message.data.companies.length - 10}{" "}
                                  more companies
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Show additional data for agent responses */}
                      {message.data?.nextSteps && (
                        <div className="mt-2 text-xs">
                          <p className="font-medium">Next Steps:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {message.data.nextSteps.map(
                              (step: string, i: number) => (
                                <li key={i}>{step}</li>
                              )
                            )}
                          </ul>
                          {message.data.companies &&
                            message.data.companies.length > 0 && (
                              <div className="mt-2">
                                <a
                                  href="/companies"
                                  className="inline-block bg-primary text-white px-3 py-1 rounded text-xs hover:bg-primary/90 transition-colors"
                                >
                                  View in Companies Dashboard →
                                </a>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-neutral-200 rounded-lg px-4 py-2">
                      <p className="text-sm text-neutral-600">Thinking...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Credentials Form */}
          {showCredentials && (
            <div className="mb-4 p-4 border border-neutral-200 rounded-lg bg-yellow-50">
              <h3 className="font-medium text-neutral-800 mb-3">
                Authentication Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Username/Email
                  </label>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    placeholder="Enter username or email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    API Key (Optional)
                  </label>
                  <input
                    type="text"
                    value={credentials.apiKey}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    placeholder="Enter API key if needed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Token (Optional)
                  </label>
                  <input
                    type="text"
                    value={credentials.token}
                    onChange={(e) =>
                      setCredentials((prev) => ({
                        ...prev,
                        token: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                    placeholder="Enter authentication token"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to scrape a website or help with authentication..."
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !currentInput.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : "Send"}
            </button>
            <button
              onClick={clearChat}
              className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300"
            >
              Clear
            </button>
          </div>

          {/* Current URL Display */}
          {currentUrl && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Current URL:</span> {currentUrl}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AgentMode(): JSX.Element {
  return (
    <ProtectedRoute>
      <AgentModeContent />
    </ProtectedRoute>
  );
}
