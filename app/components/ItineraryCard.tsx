"use client";
import React from "react";

interface ItineraryCardProps {
  title: string;
  description: string;
  spots: Array<{ name: string; description: string }>;
}

export const ItineraryCard = ({ title, description, spots }: ItineraryCardProps) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
    <h3 className="text-xl font-bold text-green-800 mb-2">{title}</h3>
    <p className="text-gray-600 mb-4">{description}</p>
    <div className="space-y-3">
      {spots.map((spot, index) => (
        <div key={index} className="border-l-4 border-green-500 pl-4">
          <h4 className="font-semibold text-gray-800">{spot.name}</h4>
          <p className="text-gray-600 text-sm">{spot.description}</p>
        </div>
      ))}
    </div>
  </div>
);
