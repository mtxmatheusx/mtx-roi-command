import { useState, useCallback } from "react";

export interface DashboardSection {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: "kpis", label: "KPIs Principais", visible: true },
  { id: "charts", label: "Gráficos de Tendência", visible: true },
  { id: "campaigns", label: "Tabela de Campanhas", visible: true },
  { id: "demographics", label: "Dados Demográficos", visible: true },
  { id: "utm", label: "Análise UTM", visible: true },
  { id: "logs", label: "Log de Automação", visible: true },
];

const STORAGE_KEY = "mtx-dashboard-prefs";

function loadPrefs(): DashboardSection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const saved = JSON.parse(raw) as DashboardSection[];
    // Merge with defaults to pick up new sections
    return DEFAULT_SECTIONS.map((def) => {
      const found = saved.find((s) => s.id === def.id);
      return found ? { ...def, visible: found.visible } : def;
    });
  } catch {
    return DEFAULT_SECTIONS;
  }
}

function savePrefs(sections: DashboardSection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {}
}

export function useDashboardPrefs() {
  const [sections, setSections] = useState<DashboardSection[]>(loadPrefs);

  const toggle = useCallback((id: string) => {
    setSections((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, visible: !s.visible } : s
      );
      savePrefs(next);
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (id: string) => sections.find((s) => s.id === id)?.visible ?? true,
    [sections]
  );

  const reset = useCallback(() => {
    setSections(DEFAULT_SECTIONS);
    savePrefs(DEFAULT_SECTIONS);
  }, []);

  return { sections, toggle, isVisible, reset };
}
