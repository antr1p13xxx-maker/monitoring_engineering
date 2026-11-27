export type UserRole = 'Manager' | 'Supervisor' | 'Lead' | 'Designer' | 'Drafter' | 'Viewer';

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
  requiredChecklists?: ChecklistKey[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
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

export interface StaffAccount {
  id: string;
  name: string;
  role: Exclude<UserRole, 'Viewer'>;
  pin: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSessionPresence {
  sessionId: string;
  staffId: string;
  staffName: string;
  role: UserRole;
  status: 'online' | 'editing';
  currentView: 'monitoring' | 'standartPart' | 'barcodes' | 'kpi' | 'appsScript';
  editingTarget?: string;
  deviceLabel: string;
  loggedInAt: string;
  lastHeartbeat: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  staffId?: string;
  staffName?: string;
  staffRole?: UserRole;
  module?: 'Monitoring' | 'Standart Part' | 'KPI' | 'Staff & PIN';
  actionType?: 'create' | 'update' | 'delete' | 'checklist' | 'upload' | 'approval' | 'pin';
  target?: string;
  activity: string;
  year: string;
  month: string;
  oldValue?: string;
  newValue: string;
}

export interface StandartPartAttachment {
  id: string;
  partIndex?: number;
  partLabel?: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface SerahTerimaStandartPartItem {
  id: string;
  no: number;
  month: string;
  prepareStaff: string[];
  projectName: string;
  partNames: string[];
  partAttachments?: StandartPartAttachment[];
  customer: string;
  distributionDate: string;
  distributionTime: string;
  division: string;
  signature: string;
  spk?: string;
  notes?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export type KPIApprovalCategory =
  | 'kpi_actual'
  | 'design_quality_feedback'
  | 'on_time_design'
  | 'distribusi_drawing'
  | 'cost_efficiency'
  | 'design_error_rate';

export interface KPIApprovalRequest {
  id: string;
  category: KPIApprovalCategory;
  categoryLabel: string;
  targetLabel: string;
  summaryOld: string;
  summaryNew: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  payload: {
    year?: string;
    kpiId?: number;
    month?: string;
    actualValue?: number | null;
    keterangan?: string;
    feedbackItem?: DesignFeedbackItem;
    projectSpk?: string;
    projectPatch?: Partial<EngineeringProject>;
    costTarget?: { month: string; customer: string; projectName: string };
    updatedAnggaran?: number;
    addedExpense?: { id: string; desc: string; amount: number };
    errorTarget?: { month: string; customer: string; projectName: string };
    addedError?: { id: string; partName: string; feedback: string };
  };
}

