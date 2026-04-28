export type Inventory = Record<string, Record<string, number>>;

export interface ActionLog {
  id: string;
  date: string;
  type: "in" | "out";
  reason: "new-hire" | "replacement";
  itemId: string;
  itemLabel: string;
  size: string;
  qty: number;
  note: string;
  recipient: string;
}

export interface AppData {
  inventory: Inventory;
  actions: ActionLog[];
}
