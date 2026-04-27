"use client";

import { useState } from "react";
import { ITEMS } from "@/constants/items";
import { useAppStore } from "@/store/useAppStore";

export default function InventoryTab() {
  const inventory = useAppStore((state) => state.inventory);
  const updateStock = useAppStore((state) => state.updateStock);
  const hydrated = useAppStore((state) => state.hydrated);
  const [filter, setFilter] = useState("");

  if (!hydrated) {
    return <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">데이터를 불러오는 중입니다...</p>;
  }

  const filteredItems = filter ? ITEMS.filter((item) => item.id === filter) : ITEMS;

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label htmlFor="inventory-filter" className="mb-1 block text-xs font-semibold text-slate-700">
          품목 필터
        </label>
        <select
          id="inventory-filter"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">전체</option>
          {ITEMS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} {item.sub}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filteredItems.map((item) => {
          const rows = item.sizes.map((size) => {
            const qty = inventory[item.id]?.[size] ?? 0;
            return { size, qty };
          });
          const total = rows.reduce((sum, row) => sum + row.qty, 0);

          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <header className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {item.name} {item.sub}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">총 {total}</span>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="px-2 py-1.5 text-left">사이즈</th>
                      <th className="px-2 py-1.5 text-left">수량</th>
                      <th className="px-2 py-1.5 text-right">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isLowStock = row.qty <= 1;
                      return (
                        <tr key={row.size} className={`border-b border-slate-100 ${isLowStock ? "bg-red-50/60" : ""}`}>
                          <td className={`px-2 py-1.5 font-medium ${isLowStock ? "text-red-700" : "text-slate-700"}`}>{row.size}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              className={`w-20 rounded-md border px-2 py-1 text-sm ${
                                isLowStock ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300"
                              }`}
                              value={row.qty}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                updateStock(item.id, row.size, Number.isNaN(next) ? 0 : next);
                              }}
                            />
                          </td>
                          <td className={`px-2 py-1.5 text-right font-semibold ${isLowStock ? "text-red-700" : "text-slate-900"}`}>{row.qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="px-2 py-1.5 text-slate-500">합계</td>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5 text-right font-bold text-slate-900">{total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
