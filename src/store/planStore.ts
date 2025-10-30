"use client";

import { create } from "zustand";

interface PlanState {
  planPhase: "selecting" | "planning" | "completed";
  origin: string | null;
  lodging: string | null;
  setOrigin: (value: string) => void;
  setLodging: (value: string) => void;
  setPhase: (phase: "selecting" | "planning" | "completed") => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  planPhase: "selecting",
  origin: null,
  lodging: null,
  setOrigin: (value) => set({ origin: value }),
  setLodging: (value) => set({ lodging: value }),
  setPhase: (phase) => set({ planPhase: phase }),
}));


