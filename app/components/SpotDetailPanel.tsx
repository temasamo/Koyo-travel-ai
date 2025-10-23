"use client";
import { useAIComment } from "./useAIComment";
import { useEffect } from "react";

interface SpotDetailPanelProps {
  details: {
    name: string;
    address: string;
    rating: number;
    hours: string[];
    photos: string[];
    review: string | null;
  } | null;
  onClose: () => void;
}

export default function SpotDetailPanel({ details, onClose }: SpotDetailPanelProps) {
  const { loading, comment, generateComment } = useAIComment();

  useEffect(() => {
    if (details) generateComment(details.name, details.review || "");
  }, [details]);

  if (!details) return null;

  return (
    <div className="fixed top-0 right-0 w-[380px] h-full bg-white shadow-xl overflow-y-auto p-4 z-50">
      <button onClick={onClose} className="text-gray-500 mb-2">× 閉じる</button>

      {details.photos?.[0] && (
        <img
          src={details.photos[0]}
          alt={details.name}
          className="w-full h-48 object-cover rounded-lg mb-3"
        />
      )}

      <h2 className="text-xl font-bold mb-1">{details.name || "施設名なし"}</h2>
      <p className="text-gray-600 mb-2">{details.address || "住所情報なし"}</p>
      <p className="text-yellow-500 mb-2">⭐ {details.rating || "評価なし"}</p>

      <h3 className="text-sm font-semibold text-gray-700">営業時間</h3>
      {details.hours && details.hours.length > 0 ? (
        <ul className="text-sm text-gray-600 mb-3">
          {details.hours.map((h: string, i: number) => <li key={i}>{h}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mb-3">営業時間情報なし</p>
      )}

      {details.review && (
        <>
          <h3 className="text-sm font-semibold text-gray-700">口コミ</h3>
          <p className="text-sm text-gray-600 italic mb-4">"{details.review}"</p>
        </>
      )}

      <div className="border-t pt-3 mt-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">AIコメント</h3>
        <p className="text-sm text-gray-800">
          {loading ? "AIがおすすめを考えています..." : comment}
        </p>
      </div>
    </div>
  );
}
