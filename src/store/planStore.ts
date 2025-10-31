"use client";

import { create } from "zustand";

interface PlanState {
  planPhase: "selecting" | "planning" | "completed";
  origin: string | null;
  lodging: string | null;
  planMessage: string | null;
  selectedCategories: string[]; // 追加: 地図フィルタ用カテゴリ
  showStaffRecommendations: boolean; // スタッフおすすめ表示フラグ
  setOrigin: (value: string) => void;
  setLodging: (value: string) => void;
  setPhase: (phase: "selecting" | "planning" | "completed") => void;
  setPlanMessage: (msg: string) => void;
  setSelectedCategories: (cats: string[]) => void;
  setShowStaffRecommendations: (show: boolean) => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  planPhase: "selecting",
  origin: null,
  lodging: null,
  planMessage: null,
  selectedCategories: [],
  showStaffRecommendations: false,
  setOrigin: (value) => set({ origin: value }),
  setLodging: (value) => set({ lodging: value }),
  setPhase: (phase) => set({ planPhase: phase }),
  setPlanMessage: (msg) => set({ planMessage: msg }),
  setSelectedCategories: (cats) => set({ selectedCategories: cats }),
  setShowStaffRecommendations: (show) => set({ showStaffRecommendations: show }),
}));


