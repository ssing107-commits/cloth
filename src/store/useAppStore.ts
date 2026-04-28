"use client";

import { create } from "zustand";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ITEMS } from "@/constants/items";
import { db } from "@/lib/firebase";
import { ActionLog, Inventory } from "@/types";

interface AppState {
  inventory: Inventory;
  actions: ActionLog[];
  hydrated: boolean;
  initializeFromCloud: () => Promise<void>;
  saveToCloud: () => Promise<void>;
  addAction: (log: ActionLog) => void;
  deleteAction: (id: string) => void;
  updateActionDate: (id: string, date: string) => void;
  updateStock: (itemId: string, size: string, qty: number) => void;
  getStock: (itemId: string, size: string) => number;
}

const buildInitialInventory = (): Inventory =>
  ITEMS.reduce<Inventory>((acc, item) => {
    acc[item.id] = item.sizes.reduce<Record<string, number>>((sizeAcc, size) => {
      sizeAcc[size] = 0;
      return sizeAcc;
    }, {});
    return acc;
  }, {});

const ensureInventoryShape = (inventory: Inventory): Inventory => {
  const base = buildInitialInventory();

  for (const item of ITEMS) {
    const savedItem = inventory[item.id] ?? {};
    for (const size of item.sizes) {
      const value = savedItem[size];
      base[item.id][size] = Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
    }
  }

  return base;
};

const APP_DOC = doc(db, "cloth", "main");
const FIRESTORE_WRITE_KEY = process.env.NEXT_PUBLIC_FIREBASE_WRITE_KEY ?? "";
const normalizeItemLabel = (value: string): string => value.replace("근무복 춘추", "근무복 하의");

const normalizeActions = (actions: ActionLog[] | undefined): ActionLog[] => {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions.map((action) => ({
    ...action,
    itemLabel: normalizeItemLabel(typeof action.itemLabel === "string" ? action.itemLabel : ""),
    reason: action.reason === "stock-secure" || action.reason === "replacement" ? action.reason : action.type === "in" ? "stock-secure" : "new-hire",
    note: typeof action.note === "string" ? action.note : "",
    recipient: typeof action.recipient === "string" ? action.recipient : "",
  }));
};

const readLegacyLocalData = (): { inventory: Inventory; actions: ActionLog[] } | null => {
  try {
    const raw = localStorage.getItem("pibok-data");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      state?: { inventory?: Inventory; actions?: ActionLog[] };
      inventory?: Inventory;
      actions?: ActionLog[];
    };
    const inventory = parsed.state?.inventory ?? parsed.inventory;
    const actions = parsed.state?.actions ?? parsed.actions;

    return {
      inventory: ensureInventoryShape(inventory ?? {}),
      actions: normalizeActions(actions),
    };
  } catch {
    return null;
  }
};

export const useAppStore = create<AppState>()((set, get) => ({
  inventory: buildInitialInventory(),
  actions: [],
  hydrated: false,
  initializeFromCloud: async () => {
    try {
      const snapshot = await getDoc(APP_DOC);
      if (snapshot.exists()) {
        const data = snapshot.data() as { inventory?: Inventory; actions?: ActionLog[] };
        set({
          inventory: ensureInventoryShape(data.inventory ?? {}),
          actions: normalizeActions(data.actions),
          hydrated: true,
        });
        return;
      }

      const legacy = readLegacyLocalData();
      const initialInventory = legacy?.inventory ?? buildInitialInventory();
      const initialActions = normalizeActions(legacy?.actions ?? []);
      await setDoc(APP_DOC, {
        inventory: initialInventory,
        actions: initialActions,
        writeKey: FIRESTORE_WRITE_KEY,
        updatedAt: Date.now(),
      });
      set({ inventory: initialInventory, actions: initialActions, hydrated: true });
    } catch (error) {
      console.error("Failed to initialize from Firestore:", error);
      set({ hydrated: true });
    }
  },
  saveToCloud: async () => {
    const { inventory, actions } = get();
    try {
      await setDoc(APP_DOC, {
        inventory,
        actions,
        writeKey: FIRESTORE_WRITE_KEY,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to save to Firestore:", error);
    }
  },
  addAction: (log) => {
    set((state) => {
      const current = state.inventory[log.itemId]?.[log.size] ?? 0;
      const nextValue = log.type === "in" ? current + log.qty : Math.max(0, current - log.qty);

      return {
        inventory: {
          ...state.inventory,
          [log.itemId]: {
            ...(state.inventory[log.itemId] ?? {}),
            [log.size]: nextValue,
          },
        },
        actions: [log, ...state.actions],
      };
    });
    void get().saveToCloud();
  },
  deleteAction: (id) => {
    set((state) => {
      const target = state.actions.find((action) => action.id === id);
      if (!target) {
        return state;
      }

      const current = state.inventory[target.itemId]?.[target.size] ?? 0;
      const reverted = target.type === "in" ? Math.max(0, current - target.qty) : current + target.qty;

      return {
        inventory: {
          ...state.inventory,
          [target.itemId]: {
            ...(state.inventory[target.itemId] ?? {}),
            [target.size]: reverted,
          },
        },
        actions: state.actions.filter((action) => action.id !== id),
      };
    });
    void get().saveToCloud();
  },
  updateActionDate: (id, date) => {
    set((state) => ({
      actions: state.actions.map((action) => (action.id === id ? { ...action, date } : action)),
    }));
    void get().saveToCloud();
  },
  updateStock: (itemId, size, qty) => {
    const nextQty = Number.isFinite(qty) ? Math.max(0, qty) : 0;
    set((state) => ({
      inventory: {
        ...state.inventory,
        [itemId]: {
          ...(state.inventory[itemId] ?? {}),
          [size]: nextQty,
        },
      },
    }));
    void get().saveToCloud();
  },
  getStock: (itemId, size) => get().inventory[itemId]?.[size] ?? 0,
}));
