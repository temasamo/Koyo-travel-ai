"use client";
import React from "react";

const categories = ["自然", "食べる", "遊ぶ", "歴史"];

export const CategoryButtons = ({ onSelect }: { onSelect: (cat: string) => void }) => (
  <div className="flex gap-3 justify-center my-4">
    {categories.map((cat) => (
      <button
        key={cat}
        className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
        onClick={() => onSelect(cat)}
      >
        {cat}
      </button>
    ))}
  </div>
);



