import { useState } from "react";

export function usePlaceDetails() {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = async (placeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/place-details?place_id=${placeId}`);
      const data = await res.json();
      
      if (!res.ok) {
        console.error("API Error:", data.error);
        setDetails(null);
      } else {
        setDetails(data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  return { details, loading, fetchDetails };
}
