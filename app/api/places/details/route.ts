import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("placeId");
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!placeId) {
    return NextResponse.json({ error: "Missing placeId" }, { status: 400 });
  }

  if (!key) {
    console.error("❌ GOOGLE_MAPS_API_KEY is not set");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${key}`
    );
    
    if (!res.ok) {
      console.warn(`⚠️ Places API error: ${res.status}`);
      return NextResponse.json({});
    }

    const data = await res.json();
    
    if (data.status === "OVER_QUERY_LIMIT") {
      console.warn("⚠️ Places API quota exceeded");
      return NextResponse.json({});
    }

    return NextResponse.json(data.result || {});
  } catch (error) {
    console.error("❌ Places Details API error:", error);
    return NextResponse.json({});
  }
}
