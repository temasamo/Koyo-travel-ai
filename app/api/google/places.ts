import axios from "axios";

export async function POST(req: Request) {
  const { query } = await req.json();
  const key = process.env.GOOGLE_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=jp&key=${key}`;
  const res = await axios.get(url);
  return Response.json(res.data);
}



