"use client";

import { useEffect, useState } from "react";

interface Props {
  placeId: string;
  onClose: () => void;
}

interface PlaceDetails {
  displayName?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteURI?: string;
  photos?: google.maps.places.Photo[];
}

export default function CustomInfoPanel({ placeId, onClose }: Props) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;

      const place = new Place({
        id: placeId,
      });

      try {
        const res = await place.fetchFields({
          fields: [
            "displayName",
            "formattedAddress",
            "rating",
            "userRatingCount",
            "websiteURI",
            "photos",
          ],
        });
        
        // Extract the data from the Place object to match PlaceDetails interface
        const placeDetails: PlaceDetails = {
          displayName: res.place.displayName || undefined,
          formattedAddress: res.place.formattedAddress || undefined,
          rating: res.place.rating || undefined,
          userRatingCount: res.place.userRatingCount || undefined,
          websiteURI: res.place.websiteURI || undefined,
          photos: res.place.photos,
        };
        
        setDetails(placeDetails);
      } catch (e) {
        console.error("fetchFields error:", e);
        setDetails(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [placeId]);

  if (loading) {
    return (
      <aside className="absolute top-4 right-4 bg-white shadow-lg p-4 rounded-lg w-80">読み込み中…</aside>
    );
  }

  if (!details) {
    return (
      <aside className="absolute top-4 right-4 bg-white shadow-lg p-4 rounded-lg w-80">
        データ取得に失敗しました。
        <button className="mt-2 text-blue-600 underline text-sm" onClick={onClose}>閉じる</button>
      </aside>
    );
  }

  const photoUrl = details.photos?.[0]?.getURI?.({ maxHeight: 220 }) || null;

  return (
    <aside className="absolute top-4 right-4 bg-white shadow-2xl border p-4 rounded-2xl w-80 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-1">{details.displayName}</h2>
      {details.formattedAddress && <p className="text-sm text-gray-700 mb-2">{details.formattedAddress}</p>}
      {typeof details.rating === "number" && (
        <p className="text-sm text-yellow-700 mb-2">⭐ {details.rating}（{details.userRatingCount ?? 0}件）</p>
      )}
      {photoUrl ? (
        <img src={photoUrl} alt={details.displayName || "photo"} className="rounded-lg w-full object-cover mb-2" />
      ) : (
        <div className="bg-gray-100 h-32 flex items-center justify-center text-gray-400 text-sm mb-2">No image</div>
      )}
      {details.websiteURI && (
        <a href={details.websiteURI} target="_blank" className="text-blue-600 underline text-sm block mb-3">
          公式サイトを見る
        </a>
      )}
      <button onClick={onClose} className="text-sm text-gray-600 border px-3 py-1 rounded hover:bg-gray-100">
        閉じる
      </button>
    </aside>
  );
}