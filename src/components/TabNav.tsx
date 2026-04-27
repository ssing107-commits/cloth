interface TabNavProps {
  active: "inventory" | "action" | "report";
  onChange: (tab: "inventory" | "action" | "report") => void;
}

const tabs: Array<{ id: TabNavProps["active"]; label: string }> = [
  { id: "inventory", label: "재고 현황" },
  { id: "action", label: "입고·불출" },
  { id: "report", label: "월별 보고서" },
];

export default function TabNav({ active, onChange }: TabNavProps) {
  return (
    <nav className="mb-6">
      <ul className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-2">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              type="button"
              className={`w-full rounded-md px-3 py-2 text-sm font-medium transition ${
                active === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/70"
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
