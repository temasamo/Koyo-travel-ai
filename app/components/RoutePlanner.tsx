"use client";
import { useState } from "react";

export default function RoutePlanner({ onRouteGenerated }: { onRouteGenerated: (route: string[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string[]>([]);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plan", { method: "POST" });
      const data = await res.json();
      setPlan(data.places);
      onRouteGenerated(data.places);
    } catch (err) {
      console.error("AI生成エラー:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-4">
      <button
        onClick={generatePlan}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "AIがプラン作成中..." : "AIに観光ルートを提案してもらう"}
      </button>

      {plan.length > 0 && (
        <div className="mt-3 text-sm">
          <strong>提案されたスポット:</strong>
          <ul className="list-disc ml-5 mt-1">
            {plan.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
