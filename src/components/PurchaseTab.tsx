"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ITEMS } from "@/constants/items";
import { useAppStore } from "@/store/useAppStore";

type PurchaseRow = {
  size: string;
  qty: number;
  safeMin: number;
  needed: number;
};

const SAFE_MIN_BY_ITEM_ID: Record<string, number> = {
  // - 알림 기준: qty <= 1 인 품목 → 안전 최소 재고 2
  tshirt_short: 2,
  tshirt_long: 2,
  work_spring: 2,

  // - 알림 기준: qty === 0 인 품목 → 안전 최소 재고 1
  jumper_spring: 1,
  jumper_winter: 1,
  safety_office: 1,
  safety_work: 1,
};

export default function PurchaseTab() {
  const inventory = useAppStore((state) => state.inventory);
  const hydrated = useAppStore((state) => state.hydrated);
  const [filter, setFilter] = useState("");

  const filteredItems = useMemo(() => (filter ? ITEMS.filter((item) => item.id === filter) : ITEMS), [filter]);

  const totalNeeded = useMemo(() => {
    return filteredItems.reduce((sum, item) => {
      return (
        sum +
        item.sizes.reduce((itemSum, size) => {
          const qty = inventory[item.id]?.[size] ?? 0;
          const safeMin = SAFE_MIN_BY_ITEM_ID[item.id] ?? 1;
          const needed = Math.max(0, safeMin - qty);
          return itemSum + needed;
        }, 0)
      );
    }, 0);
  }, [filteredItems, inventory]);

  const purchaseSummaryText = useMemo(() => {
    const blocks: string[] = [];

    for (const item of filteredItems) {
      const neededRows = item.sizes
        .map((size) => {
          const qty = inventory[item.id]?.[size] ?? 0;
          const safeMin = SAFE_MIN_BY_ITEM_ID[item.id] ?? 1;
          const needed = Math.max(0, safeMin - qty);
          return { size, qty, needed };
        })
        .filter((row) => row.needed > 0);

      if (neededRows.length === 0) continue;

      blocks.push(`${item.name} ${item.sub}`);
      for (const row of neededRows) {
        blocks.push(`${row.size} ${row.needed}개`);
      }
      blocks.push(""); // 항목 사이 빈 줄
    }

    return blocks.join("\n").trimEnd();
  }, [filteredItems, inventory]);

  if (!hydrated) {
    return <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">데이터를 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label htmlFor="purchase-filter" className="mb-1 block text-xs font-semibold text-slate-700">
          품목 필터
        </label>
        <select
          id="purchase-filter"
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

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-900">총 구매 필요: {totalNeeded}</p>
        <p className="mt-1 text-xs text-slate-500">현재 수량이 안전 최소 재고 이하이면 부족분만큼 구매 필요 개수를 표시합니다.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              if (!purchaseSummaryText) {
                toast.success("구매 필요 항목이 없습니다.");
                return;
              }

              const blob = new Blob([purchaseSummaryText], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const date = new Date().toISOString().slice(0, 10);
              a.href = url;
              a.download = `구매필요_요약_${date}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            구매 필요 요약 TXT 다운로드
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filteredItems.map((item) => {
          const rows: PurchaseRow[] = item.sizes.map((size) => {
            const qty = inventory[item.id]?.[size] ?? 0;
            const safeMin = SAFE_MIN_BY_ITEM_ID[item.id] ?? 1;
            const needed = Math.max(0, safeMin - qty);
            return { size, qty, safeMin, needed };
          });

          const itemNeeded = rows.reduce((sum, row) => sum + row.needed, 0);

          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <header className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {item.name} {item.sub}
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${itemNeeded > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                  필요 {itemNeeded}
                </span>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="px-2 py-1.5 text-left">사이즈</th>
                      <th className="px-2 py-1.5 text-right">현재 수량</th>
                      <th className="px-2 py-1.5 text-right">구매 필요</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isNeeded = row.needed > 0;
                      return (
                        <tr key={row.size} className={`border-b border-slate-100 ${isNeeded ? "bg-red-50/60" : ""}`}>
                          <td className={`px-2 py-1.5 font-medium ${isNeeded ? "text-red-700" : "text-slate-700"}`}>{row.size}</td>
                          <td className={`px-2 py-1.5 text-right font-semibold ${isNeeded ? "text-red-700" : "text-slate-900"}`}>{row.qty}</td>
                          <td className={`px-2 py-1.5 text-right font-semibold ${isNeeded ? "text-red-700" : "text-slate-500"}`}>
                            {isNeeded ? row.needed : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

