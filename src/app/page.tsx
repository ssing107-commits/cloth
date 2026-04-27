"use client";

import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import ActionTab from "@/components/ActionTab";
import InventoryTab from "@/components/InventoryTab";
import ReportTab from "@/components/ReportTab";
import TabNav from "@/components/TabNav";
import { useAppStore } from "@/store/useAppStore";

type TabType = "inventory" | "action" | "report";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("inventory");
  const hydrated = useAppStore((state) => state.hydrated);
  const initializeFromCloud = useAppStore((state) => state.initializeFromCloud);

  useEffect(() => {
    void initializeFromCloud();
  }, [initializeFromCloud]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <main className="mx-auto w-full max-w-[900px]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">피복 관리 시스템</h1>
          <p className="mt-1 text-sm text-slate-500">재고 현황, 입출고 기록, 월별 보고서를 한 곳에서 관리합니다.</p>
        </header>

        <TabNav active={activeTab} onChange={setActiveTab} />

        {!hydrated ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">데이터를 준비하고 있습니다...</p>
        ) : (
          <>
            {activeTab === "inventory" && <InventoryTab />}
            {activeTab === "action" && <ActionTab />}
            {activeTab === "report" && <ReportTab />}
          </>
        )}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          success: { style: { border: "1px solid #86efac", color: "#166534" } },
          error: { style: { border: "1px solid #fca5a5", color: "#991b1b" } },
        }}
      />
    </div>
  );
}
