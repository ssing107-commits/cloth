"use client";

import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import toast from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";
import { ActionLog, Inventory } from "@/types";
import { downloadMonthlyCsv } from "@/utils/csv";

const today = new Date();
const todayYmd = format(today, "yyyy-MM-dd");
const defaultRangeStart = format(subDays(today, 30), "yyyy-MM-dd");

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

const sumTotals = (totals: TotalsByColumn): number => REPORT_COLUMNS.reduce((sum, column) => sum + totals[column.key], 0);

const dayBefore = (ymd: string): string => format(subDays(parseISO(ymd), 1), "yyyy-MM-dd");

const inventoryAsOf = (inventory: Inventory, actions: ActionLog[], asOfDate: string): Inventory => {
  const snapshot = Object.fromEntries(
    Object.entries(inventory).map(([itemId, sizeMap]) => [
      itemId,
      Object.fromEntries(Object.entries(sizeMap).map(([size, qty]) => [size, Number(qty) || 0])),
    ]),
  ) as Inventory;

  for (const action of actions) {
    if (action.date <= asOfDate) {
      continue;
    }

    const current = snapshot[action.itemId]?.[action.size] ?? 0;
    const revertedQty = action.type === "in" ? current - action.qty : current + action.qty;
    if (!snapshot[action.itemId]) {
      snapshot[action.itemId] = {};
    }
    snapshot[action.itemId][action.size] = revertedQty;
  }

  return snapshot;
};

const stockByColumn = (inventorySnapshot: Inventory): TotalsByColumn => {
  const totals = initTotals();
  for (const column of REPORT_COLUMNS) {
    totals[column.key] = column.itemIds.reduce((columnSum, itemId) => {
      const sizeMap = inventorySnapshot[itemId] ?? {};
      const itemTotal = Object.values(sizeMap).reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0);
      return columnSum + itemTotal;
    }, 0);
  }
  return totals;
};

export default function ReportTab() {
  const hydrated = useAppStore((state) => state.hydrated);
  const actions = useAppStore((state) => state.actions);
  const inventory = useAppStore((state) => state.inventory);
  const [rangeStart, setRangeStart] = useState(defaultRangeStart);
  const [rangeEnd, setRangeEnd] = useState(todayYmd);
  const [appliedStart, setAppliedStart] = useState<string | null>(null);
  const [appliedEnd, setAppliedEnd] = useState<string | null>(null);
  const [reportReady, setReportReady] = useState(false);

  const periodActions = useMemo(() => {
    if (!appliedStart || !appliedEnd) {
      return [];
    }
    return actions.filter((action) => action.date >= appliedStart && action.date <= appliedEnd);
  }, [actions, appliedStart, appliedEnd]);

  const stockBeforeDate = appliedStart ? dayBefore(appliedStart) : null;

  const totals = useMemo(
    () => ({
      inQty: periodActions.filter((action) => action.type === "in").reduce((sum, action) => sum + action.qty, 0),
      outQty: periodActions.filter((action) => action.type === "out").reduce((sum, action) => sum + action.qty, 0),
    }),
    [periodActions],
  );

  const periodInByColumn = useMemo(() => {
    const totals = initTotals();
    for (const action of periodActions) {
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
  }, [periodActions]);

  const periodOutByColumn = useMemo(() => {
    const totals = initTotals();
    for (const action of periodActions) {
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
  }, [periodActions]);

  const stockBeforeOutByColumn = useMemo(() => {
    if (!stockBeforeDate) {
      return initTotals();
    }
    return stockByColumn(inventoryAsOf(inventory, actions, stockBeforeDate));
  }, [inventory, actions, stockBeforeDate]);

  const stockAtEndByColumn = useMemo(() => {
    if (!appliedEnd) {
      return initTotals();
    }
    return stockByColumn(inventoryAsOf(inventory, actions, appliedEnd));
  }, [inventory, actions, appliedEnd]);

  const outReasonSummary = useMemo(() => {
    const reasonTotals = { "new-hire": 0, replacement: 0 };
    for (const action of periodActions) {
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
  }, [periodActions]);

  const handleGenerateReport = () => {
    if (!rangeStart || !rangeEnd) {
      toast.error("조회 시작일과 종료일을 입력해주세요.");
      return;
    }
    if (rangeStart > rangeEnd) {
      toast.error("시작일은 종료일보다 이전이어야 합니다.");
      return;
    }
    setAppliedStart(rangeStart);
    setAppliedEnd(rangeEnd);
    setReportReady(true);
  };

  if (!hydrated) {
    return <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">데이터를 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="text-sm text-slate-700">
            조회 시작일
            <input
              type="date"
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
              value={rangeStart}
              max={rangeEnd || todayYmd}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700">
            조회 종료일
            <input
              type="date"
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
              value={rangeEnd}
              min={rangeStart}
              max={todayYmd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={handleGenerateReport}
          >
            보고서 생성
          </button>
          <button
            type="button"
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              if (!reportReady || !appliedStart || !appliedEnd) {
                toast.error("먼저 보고서를 생성해주세요.");
                return;
              }
              if (periodActions.length === 0) {
                toast.error("보낼 기록이 없습니다.");
                return;
              }
              downloadMonthlyCsv(`${appliedStart}_${appliedEnd}`, periodActions);
              toast.success("CSV를 다운로드했습니다.");
            }}
          >
            CSV보내기
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          입·불출은 조회 기간({rangeStart || "시작일"} ~ {rangeEnd || "종료일"}) 기준이며, 불출 전 재고는 시작일 전날까지 반영됩니다.
        </p>
      </div>

      {reportReady && appliedStart && appliedEnd && stockBeforeDate && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard title="총 입고 수량" value={totals.inQty} />
            <StatCard title="총 불출 수량" value={totals.outQty} />
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              {appliedStart} ~ {appliedEnd} 기간 요약
            </h3>
            {periodActions.length === 0 && (
              <p className="mb-3 text-sm text-amber-700">해당 기간의 입·불출 기록은 없습니다. 재고는 시작 전일·종료일 기준으로 표시됩니다.</p>
            )}
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
                    <th className="px-2 py-2 text-right">총계</th>
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
                    <td className="px-2 py-2 text-right font-medium">{sumTotals(stockBeforeOutByColumn)}</td>
                    <td className="px-2 py-2 text-slate-500">{stockBeforeDate} 기준 재고</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium">기간 불출 수량</td>
                    {REPORT_COLUMNS.map((column) => (
                      <td key={`out-${column.key}`} className="px-2 py-2 text-right">
                        {periodOutByColumn[column.key]}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-medium">{sumTotals(periodOutByColumn)}</td>
                    <td className="px-2 py-2">
                      신규입사 {outReasonSummary["new-hire"]} / 노후교체 {outReasonSummary.replacement}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-yellow-50">
                    <td className="px-2 py-2 font-semibold">구매 수량</td>
                    {REPORT_COLUMNS.map((column) => (
                      <td key={`in-${column.key}`} className="px-2 py-2 text-right font-semibold">
                        {periodInByColumn[column.key]}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-semibold">{sumTotals(periodInByColumn)}</td>
                    <td className="px-2 py-2">입고 사유: 재고확보</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-medium">기간 종료 보유 수량</td>
                    {REPORT_COLUMNS.map((column) => (
                      <td key={`current-${column.key}`} className="px-2 py-2 text-right">
                        {stockAtEndByColumn[column.key]}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-medium">{sumTotals(stockAtEndByColumn)}</td>
                    <td className="px-2 py-2 text-slate-500">{appliedEnd} 기준 재고 합계</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </>
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
