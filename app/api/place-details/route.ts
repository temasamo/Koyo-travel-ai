import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("place_id");

  if (!placeId) {
    return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;

    // ✅ 新しいPlaces API (New) endpoint
    const url = `https://places.googleapis.com/v1/places/${placeId}?key=${apiKey}`;

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "id,displayName,formattedAddress,photos,location,primaryType,primaryTypeDisplayName,regularOpeningHours",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Places API Error:", errText);
      return NextResponse.json({ error: "Failed to fetch place details" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
