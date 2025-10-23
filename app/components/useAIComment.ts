"use client";
import { useState } from "react";

export function useAIComment() {
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState<string | null>(null);

  const generateComment = async (spotName: string, description?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotName, description }),
      });
      const data = await res.json();
      setComment(data.comment);
    } catch (err) {
      console.error("AIコメント生成エラー:", err);
    } finally {
      setLoading(false);
    }
  };

  return { loading, comment, generateComment };
}
