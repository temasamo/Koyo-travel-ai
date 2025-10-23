"use client";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./components/MapView"), { ssr: false });

export default function Page() {
  return (
    <main className="p-4">
      <h1 className="text-2xl mb-4">古窯 旅AIマップ</h1>
      <MapView />
      <script
        async
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
      ></script>
    </main>
  );
}

