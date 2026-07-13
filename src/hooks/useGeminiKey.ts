import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "pocket_ai_gemini_key";

export function useGeminiKey() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    setHasKey(!!localStorage.getItem(STORAGE_KEY));
  }, []);

  const getKey = useCallback((): string | null => {
    return localStorage.getItem(STORAGE_KEY);
  }, []);

  const setKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key.trim());
    setHasKey(true);
  }, []);

  const clearKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHasKey(false);
  }, []);

  return { getKey, setKey, clearKey, hasKey };
}
