"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";
import { downloadMonthlyCsv } from "@/utils/csv";

const today = new Date();
const currentYear = Number(format(today, "yyyy"));
const currentMonth = Number(format(today, "MM"));
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

const REPORT_COLUMNS = [
  { key: "jumper_spring", label: "춘추 점퍼", itemIds: ["jumper_spring"] },
  { key: "jumper_winter", label: "동계 점퍼", itemIds: ["jumper_winter"] },
  { key: "tshirt_short", label: "근무복 티셔츠 반팔", itemIds: ["tshirt_short"] },
  { key: "tshirt_long", label: "근무복 티셔츠 긴팔", itemIds: ["tshirt_long"] },
  { key: "work_spring", label: "근무복 하의", itemIds: ["work_spring"] },
  { key: "safety_all", label: "안전화", itemIds: ["safety_office", "safety_work"] },
] as const;

type ColumnKey = (typeof REPORT_COLUMNS)[number]["key"];
type TotalsByColumn = Record<ColumnKey, number>;

const ITEM_ID_TO_COLUMN_KEY: Record<string, ColumnKey> = REPORT_COLUMNS.reduce(
  (acc, column) => {
    for (const itemId of column.itemIds) {
      acc[itemId] = column.key;
    }
    return acc;
  },
  {} as Record<string, ColumnKey>,
);

const initTotals = (): TotalsByColumn =>
  REPORT_COLUMNS.reduce(
    (acc, column) => {
      acc[column.key] = 0;
      return acc;
    },
    {} as TotalsByColumn,
  );

export default function ReportTab() {
  const hydrated = useAppStore((state) => state.hydrated);
  const actions = useAppStore((state) => state.actions);
  const inventory = useAppStore((state) => state.inventory);
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

  const monthlyInByColumn = useMemo(() => {
    const totals = initTotals();
    for (const action of monthlyActions) {
      if (action.type !== "in") {
        continue;
      }
      const columnKey = ITEM_ID_TO_COLUMN_KEY[action.itemId];
      if (!columnKey) {
        continue;
      }
      totals[columnKey] += action.qty;
    }
    return totals;
  }, [monthlyActions]);

  const monthlyOutByColumn = useMemo(() => {
    const totals = initTotals();
    for (const action of monthlyActions) {
      if (action.type !== "out") {
        continue;
      }
      const columnKey = ITEM_ID_TO_COLUMN_KEY[action.itemId];
      if (!columnKey) {
        continue;
      }
      totals[columnKey] += action.qty;
    }
    return totals;
  }, [monthlyActions]);

  const currentStockByColumn = useMemo(() => {
    const totals = initTotals();
    for (const column of REPORT_COLUMNS) {
      totals[column.key] = column.itemIds.reduce((columnSum, itemId) => {
        const sizeMap = inventory[itemId] ?? {};
        const itemTotal = Object.values(sizeMap).reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0);
        return columnSum + itemTotal;
      }, 0);
    }
    return totals;
  }, [inventory]);

  const stockBeforeOutByColumn = useMemo(() => {
    const totals = initTotals();
    for (const column of REPORT_COLUMNS) {
      totals[column.key] = currentStockByColumn[column.key] - monthlyInByColumn[column.key] + monthlyOutByColumn[column.key];
    }
    return totals;
  }, [currentStockByColumn, monthlyInByColumn, monthlyOutByColumn]);

  const outReasonSummary = useMemo(() => {
    const reasonTotals = { "new-hire": 0, replacement: 0 };
    for (const action of monthlyActions) {
      if (action.type !== "out") {
        continue;
      }
      if (action.reason === "replacement") {
        reasonTotals.replacement += action.qty;
      } else if (action.reason === "new-hire") {
        reasonTotals["new-hire"] += action.qty;
      }
    }
    return reasonTotals;
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

      {monthlyActions.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">해당 월의 거래 기록이 없습니다.</p>
      ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">{appliedMonth} 월별 요약</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-800">
                  <th className="px-2 py-2 text-left">구분</th>
                  {REPORT_COLUMNS.map((column) => (
                    <th key={column.key} className="px-2 py-2 text-right">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-left">비고</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium">불출 전 수량</td>
                  {REPORT_COLUMNS.map((column) => (
                    <td key={`start-${column.key}`} className="px-2 py-2 text-right">
                      {stockBeforeOutByColumn[column.key]}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-slate-500">전월 재고 보관분</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium">{month}월 불출 수량</td>
                  {REPORT_COLUMNS.map((column) => (
                    <td key={`out-${column.key}`} className="px-2 py-2 text-right">
                      {monthlyOutByColumn[column.key]}
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    신규입사 {outReasonSummary["new-hire"]} / 노후교체 {outReasonSummary.replacement}
                  </td>
                </tr>
                <tr className="border-b border-slate-100 bg-yellow-50">
                  <td className="px-2 py-2 font-semibold">구매 수량</td>
                  {REPORT_COLUMNS.map((column) => (
                    <td key={`in-${column.key}`} className="px-2 py-2 text-right font-semibold">
                      {monthlyInByColumn[column.key]}
                    </td>
                  ))}
                  <td className="px-2 py-2">입고 사유: 재고확보</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 font-medium">현재 보유 수량</td>
                  {REPORT_COLUMNS.map((column) => (
                    <td key={`current-${column.key}`} className="px-2 py-2 text-right">
                      {currentStockByColumn[column.key]}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-slate-500">현재 재고 합계</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
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
