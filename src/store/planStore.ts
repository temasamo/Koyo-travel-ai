"use client";

import { create } from "zustand";

interface PlanState {
  planPhase: "selecting" | "planning" | "completed";
  origin: string | null;
  lodging: string | null;
  planMessage: string | null;
  setOrigin: (value: string) => void;
  setLodging: (value: string) => void;
  setPhase: (phase: "selecting" | "planning" | "completed") => void;
  setPlanMessage: (msg: string) => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  planPhase: "selecting",
  origin: null,
  lodging: null,
  planMessage: null,
  setOrigin: (value) => set({ origin: value }),
  setLodging: (value) => set({ lodging: value }),
  setPhase: (phase) => set({ planPhase: phase }),
  setPlanMessage: (msg) => set({ planMessage: msg }),
}));


