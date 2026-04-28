"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ITEMS } from "@/constants/items";
import { useAppStore } from "@/store/useAppStore";
import { ActionLog } from "@/types";

const today = new Date();
const currentYear = Number(format(today, "yyyy"));
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ActionTab() {
  const hydrated = useAppStore((state) => state.hydrated);
  const actions = useAppStore((state) => state.actions);
  const addAction = useAppStore((state) => state.addAction);
  const deleteAction = useAppStore((state) => state.deleteAction);
  const getStock = useAppStore((state) => state.getStock);

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(Number(format(today, "MM")));
  const [day, setDay] = useState(format(today, "dd"));
  const [type, setType] = useState<"in" | "out">("in");
  const [reason, setReason] = useState<"new-hire" | "replacement">("new-hire");
  const [itemId, setItemId] = useState(ITEMS[0]?.id ?? "");
  const [qtyBySize, setQtyBySize] = useState<Record<string, number>>({});
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");

  const selectedItem = useMemo(() => ITEMS.find((item) => item.id === itemId) ?? ITEMS[0], [itemId]);
  const sizes = selectedItem?.sizes ?? [];

  const handleItemChange = (nextItemId: string) => {
    setItemId(nextItemId);
    setQtyBySize({});
  };

  const submit = () => {
    if (!selectedItem) {
      toast.error("입력값을 확인해 주세요.");
      return;
    }

    const selectedRows = sizes
      .map((size) => ({ size, qty: Math.max(0, Number(qtyBySize[size] ?? 0)) }))
      .filter((row) => row.qty > 0);

    if (selectedRows.length === 0) {
      toast.error("사이즈별 수량을 1개 이상 입력해 주세요.");
      return;
    }
    if (type === "out" && recipient.trim().length === 0) {
      toast.error("불출 대상자를 입력해 주세요.");
      return;
    }

    const safeDay = String(Math.min(31, Math.max(1, Number(day) || 1))).padStart(2, "0");
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${safeDay}`;
    const itemLabel = `${selectedItem.name} ${selectedItem.sub}`;

    for (const row of selectedRows) {
      const stock = getStock(selectedItem.id, row.size);
      if (type === "out" && stock < row.qty) {
        toast.error(`재고 부족: ${row.size}`);
        return;
      }
    }

    for (const row of selectedRows) {
      const log: ActionLog = {
        id: crypto.randomUUID(),
        date,
        type,
        reason,
        itemId: selectedItem.id,
        itemLabel,
        size: row.size,
        qty: row.qty,
        recipient: recipient.trim(),
        note: note.trim(),
      };
      addAction(log);
    }

    setNote("");
    setRecipient("");
    setQtyBySize({});
    toast.success(type === "in" ? `입고 ${selectedRows.length}건 등록 완료` : `불출 ${selectedRows.length}건 등록 완료`);
  };

  if (!hydrated) {
    return <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">데이터를 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">입고 / 불출 등록</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            연도
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}년
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            월
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}월
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            일
            <input type="number" min={1} max={31} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="text-sm text-slate-700">
            유형
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={type} onChange={(e) => setType(e.target.value as "in" | "out")}>
              <option value="in">입고</option>
              <option value="out">불출</option>
            </select>
          </label>
          {type === "out" && (
            <label className="text-sm text-slate-700">
              사유
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value as "new-hire" | "replacement")}>
                <option value="new-hire">신규입사</option>
                <option value="replacement">노후교체</option>
              </select>
            </label>
          )}
          <label className="text-sm text-slate-700">
            품목
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={itemId} onChange={(e) => handleItemChange(e.target.value)}>
              {ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.sub}
                </option>
              ))}
            </select>
          </label>
          {type === "out" && (
            <label className="text-sm text-slate-700 md:col-span-2">
              불출 대상자
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="불출 대상자 이름 (필수)"
              />
            </label>
          )}
          <label className="text-sm text-slate-700 md:col-span-2">
            비고
            <input type="text" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택 입력" />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">사이즈별 수량 (0은 제외)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {sizes.map((value) => (
              <label key={value} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{value}</span>
                <input
                  type="number"
                  min={0}
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right"
                  value={qtyBySize[value] ?? 0}
                  onChange={(e) =>
                    setQtyBySize((prev) => ({
                      ...prev,
                      [value]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <button type="button" className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={submit}>
          등록
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">최근 기록 (최신 30건)</h3>
        {actions.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">날짜</th>
                  <th className="px-2 py-2">유형</th>
                  <th className="px-2 py-2">품목</th>
                  <th className="px-2 py-2">사유</th>
                  <th className="px-2 py-2">사이즈</th>
                  <th className="px-2 py-2">수량</th>
                  <th className="px-2 py-2">불출 대상자</th>
                  <th className="px-2 py-2">비고</th>
                  <th className="px-2 py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {actions.slice(0, 30).map((action) => (
                  <tr key={action.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{action.date}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${action.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                        {action.type === "in" ? "입고" : "불출"}
                      </span>
                    </td>
                    <td className="px-2 py-2">{action.itemLabel}</td>
                    <td className="px-2 py-2">{action.reason === "replacement" ? "노후교체" : "신규입사"}</td>
                    <td className="px-2 py-2">{action.size}</td>
                    <td className="px-2 py-2">{action.qty}</td>
                    <td className="px-2 py-2">{action.recipient || "-"}</td>
                    <td className="px-2 py-2">{action.note || "-"}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          const confirmed = window.confirm("해당 기록을 삭제하시겠습니까?");
                          if (!confirmed) {
                            return;
                          }
                          deleteAction(action.id);
                          toast.success("기록이 삭제되었습니다.");
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
