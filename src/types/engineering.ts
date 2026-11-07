export type UserRole = 'Manager' | 'Supervisor' | 'Lead' | 'Drafter' | 'Viewer';

export interface EngineeringProject {
  No: number;
  Bulan: string;
  SPK: string;
  'Nomor PO': string;
  Customer: string;
  Status: 'Selesai' | 'In Progress' | 'Revisi';
  'Delivery Time': string;
  'Nama Project': string;
  PIC: string;
  'Qty Drawing': number;
  'Permintaan Drawing/Design': string;
  'Target Design': string;
  'Tanggal Penyelesaian': string;
  'Aktual Engineering': string;
  'File CAD Drive': string;
  'Konsep 3D/2D': string;
  APPROVAL: string;
  '3D': string;
  '2D': string;
  'LIST STANDARD PART': string;
  'list material': string;
  IRD: string;
  Squence: string;
  animation: string;
  dokumentasi: string;
  'layout pengiriman': string;
  'drawing box pengiriman': string;
  simulation: string;
  penawaran: string;
  keterangan: string;
}

export type ChecklistKey =
  | 'Konsep 3D/2D'
  | 'APPROVAL'
  | '3D'
  | '2D'
  | 'LIST STANDARD PART'
  | 'list material'
  | 'IRD'
  | 'Squence'
  | 'animation'
  | 'dokumentasi'
  | 'layout pengiriman'
  | 'drawing box pengiriman'
  | 'simulation'
  | 'penawaran';

export interface KPIItem {
  id: number;
  no: string;
  objective: string;
  kpi: string;
  bobot: number;
  unit: string;
  target: string;
  targetVal: number;
  ruleType: 'gte' | 'lte' | 'eq_100_percent' | 'eq_zero_accident';
  measurementBasis: string;
  ruleDesc: string;
  keterangan: string;
  months: Record<string, number | null>;
}

export interface ReviewCostItem {
  month: string;
  customer: string;
  projectName: string;
  anggaran: number;
  pengeluaran: Array<{ id: string; desc: string; amount: number }>;
}

export interface ReviewErrorItem {
  month: string;
  customer: string;
  projectName: string;
  errors: Array<{ id: string; partName: string; feedback: string }>;
}

export interface DesignFeedbackItem {
  month: string;
  customer: string;
  projectName: string;
  fbProduksi: string;
  fbKastamer: string;
  fbProdPdfName?: string;
  fbKastPdfName?: string;
  isNoRevision: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  activity: string;
  year: string;
  month: string;
  newValue: string;
}
