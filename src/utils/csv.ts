import { ActionLog } from "@/types";

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const downloadMonthlyCsv = (month: string, rows: ActionLog[]): void => {
  const header = ["날짜", "유형", "사유", "품목", "사이즈", "수량", "불출대상자", "비고"];
  const body = rows.map((row) => [
    row.date,
    row.type === "in" ? "입고" : "불출",
    row.reason === "stock-secure" ? "재고확보" : row.reason === "replacement" ? "노후교체" : "신규입사",
    row.itemLabel,
    row.size,
    String(row.qty),
    row.recipient ?? "",
    row.note ?? "",
  ]);

  const content = [header, ...body]
    .map((line) => line.map((value) => escapeCsv(value)).join(","))
    .join("\r\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `피복관리_${month}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
