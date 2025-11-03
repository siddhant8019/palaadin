"use client";

import { useState } from "react";

interface ISearchBarProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function SearchBar({
  onSubmit,
  isLoading,
  placeholder = "Ask anything... (e.g., 'Show me tech companies in SF')",
}: ISearchBarProps): JSX.Element {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSubmit(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-6 py-4 text-base border-2 border-neutral-200 rounded-xl focus:outline-none focus:border-primary transition-colors"
          placeholder={placeholder}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Thinking..." : "Ask"}
        </button>
      </div>
      <div className="mt-2 text-xs text-neutral-500">
        Try: "Show me all companies" or "Find people in San Francisco"
      </div>
    </form>
  );
}

