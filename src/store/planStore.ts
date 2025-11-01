"use client";

import { create } from "zustand";

// ルート生成ルール
export interface RouteGenerationRules {
  maxPoints: number; // 最大地点数（デフォルト: 6）
  excludeBroadAreas: boolean; // 広範囲地名（県、市、町）を除外するか（デフォルト: true）
  minConfidence: number; // 最小信頼度（デフォルト: 0.9）
  optimizeWaypoints: boolean; // 経由地の最適化を行うか（デフォルト: false = 通常料金）
  autoGenerate: boolean; // 自動生成するか（デフォルト: false = 手動トリガーのみ）
}

interface PlanState {
  planPhase: "selecting" | "planning" | "completed";
  origin: string | null;
  lodging: string | null;
  planMessage: string | null;
  selectedCategories: string[]; // 追加: 地図フィルタ用カテゴリ
  showStaffRecommendations: boolean; // スタッフおすすめ表示フラグ
  routeRules: RouteGenerationRules; // ルート生成ルール
  shouldGenerateRoute: boolean; // ルート生成をトリガーするフラグ
  setOrigin: (value: string) => void;
  setLodging: (value: string) => void;
  setPhase: (phase: "selecting" | "planning" | "completed") => void;
  setPlanMessage: (msg: string) => void;
  setSelectedCategories: (cats: string[]) => void;
  setShowStaffRecommendations: (show: boolean) => void;
  setRouteRules: (rules: Partial<RouteGenerationRules>) => void;
  triggerRouteGeneration: () => void;
  resetRouteGeneration: () => void;
}

const defaultRouteRules: RouteGenerationRules = {
  maxPoints: 6,
  excludeBroadAreas: true,
  minConfidence: 0.9,
  optimizeWaypoints: false,
  autoGenerate: false, // デフォルトで自動生成を無効化
};

export const usePlanStore = create<PlanState>((set) => ({
  planPhase: "selecting",
  origin: null,
  lodging: null,
  planMessage: null,
  selectedCategories: [],
  showStaffRecommendations: false,
  routeRules: defaultRouteRules,
  shouldGenerateRoute: false,
  setOrigin: (value) => set({ origin: value }),
  setLodging: (value) => set({ lodging: value }),
  setPhase: (phase) => set({ planPhase: phase }),
  setPlanMessage: (msg) => set({ planMessage: msg }),
  setSelectedCategories: (cats) => set({ selectedCategories: cats }),
  setShowStaffRecommendations: (show) => set({ showStaffRecommendations: show }),
  setRouteRules: (rules) => set((state) => ({
    routeRules: { ...state.routeRules, ...rules }
  })),
  triggerRouteGeneration: () => set({ shouldGenerateRoute: true }),
  resetRouteGeneration: () => set({ shouldGenerateRoute: false }),
}));


