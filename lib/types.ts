export type View =
  "overview" | "medicines" | "symptoms" | "history" | "reports" | "settings";
export type Unit = "F" | "C";
export type Child = {
  id: string;
  name: string;
  color: string;
  birthday?: string;
};
export type LogType = "MEDICINE" | "SYMPTOM" | "METRIC";
export type Log = {
  id: string;
  childId: string;
  type: LogType;
  timeGiven: number;
  timestamp: number;
  data: {
    medicineName?: string;
    dosage?: string;
    frequencyHours?: number | null;
    symptomName?: string;
    temp?: string;
    tempUnit?: Unit;
    severity?: string;
    symptomDetails?: Record<string, string>;
    symptomCount?: number;
    notes?: string;
    metricType?: string;
    value?: string;
    observationPeriod?: "today" | "since-last" | "other";
    wetDiapers?: number;
    bowelMovements?: number;
    stoolDiapers?: number;
    stoolConsistency?: string;
  };
};
export type Database = {
  version: 2;
  children: Child[];
  customMedicines: string[];
  logs: Log[];
  settings: {
    timeFormat: "12h" | "24h";
    tempUnit: Unit;
    activeChildId?: string;
  };
};
