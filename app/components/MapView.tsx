"use client";
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from "@react-google-maps/api";

export const MapView = ({ center, directions }: any) => (
  <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_API_KEY!}>
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "500px" }}
      center={center}
      zoom={12}
    >
      {directions && <DirectionsRenderer directions={directions} />}
      <Marker position={center} />
    </GoogleMap>
  </LoadScript>
);
