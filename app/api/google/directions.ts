import axios from "axios";

export async function POST(req: Request) {
  const { origin, destination, waypoints } = await req.json();
  const key = process.env.GOOGLE_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${waypoints.join("|")}&key=${key}`;
  const res = await axios.get(url);
  return Response.json(res.data);
}





