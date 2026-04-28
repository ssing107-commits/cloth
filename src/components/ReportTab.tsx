"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ITEMS } from "@/constants/items";
import { useAppStore } from "@/store/useAppStore";
import { downloadMonthlyCsv } from "@/utils/csv";

const today = new Date();
const currentYear = Number(format(today, "yyyy"));
const currentMonth = Number(format(today, "MM"));
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

interface ItemSummary {
  itemId: string;
  itemLabel: string;
  inTotal: number;
  outTotal: number;
  inByReason: Record<"stock-secure" | "new-hire" | "replacement", number>;
  outByReason: Record<"stock-secure" | "new-hire" | "replacement", number>;
}

export default function ReportTab() {
  const hydrated = useAppStore((state) => state.hydrated);
  const actions = useAppStore((state) => state.actions);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [appliedMonth, setAppliedMonth] = useState(`${currentYear}-${String(currentMonth).padStart(2, "0")}`);

  const monthlyActions = useMemo(() => actions.filter((action) => action.date.startsWith(appliedMonth)), [actions, appliedMonth]);

  const totals = useMemo(
    () => ({
      inQty: monthlyActions.filter((action) => action.type === "in").reduce((sum, action) => sum + action.qty, 0),
      outQty: monthlyActions.filter((action) => action.type === "out").reduce((sum, action) => sum + action.qty, 0),
    }),
    [monthlyActions],
  );

  const summaries = useMemo<ItemSummary[]>(() => {
    const itemMap = new Map<string, ItemSummary>();

    for (const action of monthlyActions) {
      const item = ITEMS.find((it) => it.id === action.itemId);
      if (!item) {
        continue;
      }

      if (!itemMap.has(action.itemId)) {
        itemMap.set(action.itemId, {
          itemId: action.itemId,
          itemLabel: `${item.name} ${item.sub}`,
          inTotal: 0,
          outTotal: 0,
          inByReason: { "stock-secure": 0, "new-hire": 0, replacement: 0 },
          outByReason: { "stock-secure": 0, "new-hire": 0, replacement: 0 },
        });
      }

      const target = itemMap.get(action.itemId);
      if (!target) {
        continue;
      }

      if (action.type === "in") {
        target.inTotal += action.qty;
        target.inByReason[action.reason] += action.qty;
      } else {
        target.outTotal += action.qty;
        target.outByReason[action.reason] += action.qty;
      }
    }

    return Array.from(itemMap.values());
  }, [monthlyActions]);

  if (!hydrated) {
    return <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">데이터를 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="text-sm text-slate-700">
            조회 연도
            <select className="mt-1 block rounded-md border border-slate-300 px-3 py-2" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}년
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            조회 월
            <select className="mt-1 block rounded-md border border-slate-300 px-3 py-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}월
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => setAppliedMonth(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`)}
          >
            보고서 생성
          </button>
          <button
            type="button"
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              if (monthlyActions.length === 0) {
                toast.error("내보낼 기록이 없습니다.");
                return;
              }
              downloadMonthlyCsv(appliedMonth, monthlyActions);
              toast.success("CSV를 다운로드했습니다.");
            }}
          >
            CSV 내보내기
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard title="총 입고 수량" value={totals.inQty} />
        <StatCard title="총 불출 수량" value={totals.outQty} />
      </div>

      {summaries.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">해당 월의 거래 기록이 없습니다.</p>
      ) : (
        summaries.map((summary) => {
          return (
            <article key={summary.itemId} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-base font-semibold text-slate-900">{summary.itemLabel}</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                  입고 수량: <span className="font-semibold">{summary.inTotal}</span>
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-800">
                  불출 수량: <span className="font-semibold">{summary.outTotal}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                  입고 사유: 재고확보 {summary.inByReason["stock-secure"]}
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-800">
                  불출 사유: 신규입사 {summary.outByReason["new-hire"]} / 노후교체 {summary.outByReason.replacement}
                </div>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
