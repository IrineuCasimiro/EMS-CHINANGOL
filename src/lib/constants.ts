import type { UserRole, EquipmentStatus, WorkOrderStatus, TravelStatus, RequisitionStatus, Priority, InspectionStatus, FuelLevel } from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  user: 'User',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full system access including user management and all modules',
  user: 'Operational access to equipment, work orders, travel logs, and requisitions',
};

export const ROLE_ORDER: UserRole[] = ['admin', 'user'];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  operational: 'Operational',
  maintenance: 'In Maintenance',
  standby: 'Standby',
  broken: 'Broken Down',
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_parts: 'Waiting for Parts',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TRAVEL_STATUS_LABELS: Record<TravelStatus, string> = {
  planned: 'Planned',
  in_transit: 'In Transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
};

export const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  empty: 'Empty (E)',
  quarter: '1/4',
  half: '1/2',
  three_quarter: '3/4',
  full: 'Full (F)',
};

export const STATUS_COLORS: Record<string, string> = {
  operational: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  standby: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  broken: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  waiting_parts: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  fulfilled: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  in_transit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', labelKey: 'dashboard', icon: 'LayoutDashboard' },
  { id: 'equipment', label: 'Equipment & Stockyard', labelKey: 'equipment', icon: 'Truck' },
  { id: 'inspections', label: 'Inspections', labelKey: 'inspections', icon: 'ClipboardCheck' },
  { id: 'work-orders', label: 'Folha de Obra', labelKey: 'workOrders', icon: 'Wrench' },
  { id: 'travel-logs', label: 'Guia de Viagem', labelKey: 'travelLogs', icon: 'Route' },
  { id: 'requisitions', label: 'Requisição de Peças', labelKey: 'requisitions', icon: 'Package' },
  { id: 'documents', label: 'Documents', labelKey: 'documents', icon: 'FileText' },
  { id: 'admin', label: 'Admin Panel', labelKey: 'admin', icon: 'ShieldCheck', adminOnly: true },
] as const;

// ============ i18n ============
export type Language = 'en' | 'zh';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    equipment: 'Equipment & Stockyard',
    inspections: 'Inspections',
    workOrders: 'Folha de Obra',
    travelLogs: 'Guia de Viagem',
    requisitions: 'Requisição de Peças',
    documents: 'Documents',
    admin: 'Admin Panel',
    welcome: 'Welcome Back',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    email: 'Email',
    password: 'Password',
    loading: 'Loading EMS...',
    newWorkOrder: 'New Work Order',
    newTravelLog: 'New Travel Log',
    newRequisition: 'New Requisition',
    newEquipment: 'New Equipment',
    newInspection: 'New Inspection',
    search: 'Search',
    status: 'Status',
    actions: 'Actions',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    preview: 'Preview',
    download: 'Download',
    generatePdf: 'Generate PDF',
    number: 'Number',
    date: 'Date',
    driver: 'Driver',
    vehicle: 'Vehicle',
    destination: 'Destination',
    purpose: 'Purpose of Trip',
    client: 'Client',
    model: 'Model',
    serialNumber: 'Serial Number',
    requestedBy: 'Requested By',
    supervisor: 'Supervisor',
    urgency: 'Urgency',
    partsId: 'Parts ID',
    description: 'Description',
    quantity: 'Quantity',
    itemNo: 'Item N°',
    technician: 'Technician',
    mechanic: 'Mechanic',
    dispatcher: 'Dispatcher',
    travelTeam: 'Travel Team',
    licensePlate: 'License Plate',
    departureDate: 'Departure Date',
    expectedReturnTime: 'Expected Return Time',
    arrivalDate: 'Arrival Date',
    arrivalTime: 'Arrival Time',
    startKm: 'Start KM',
    endKm: 'End KM',
    fuelLevel: 'Fuel Level',
    checklist: 'Checklist',
    notes: 'Notes',
    noData: 'No data found',
    operational: 'Operational',
    maintenance: 'In Maintenance',
    standby: 'Standby',
    broken: 'Broken Down',
    open: 'Open',
    inProgress: 'In Progress',
    waitingParts: 'Waiting for Parts',
    completed: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    fulfilled: 'Fulfilled',
    planned: 'Planned',
    inTransit: 'In Transit',
    partsServiceRequest: 'Parts & Service Request Form',
    travelTicket: 'Travel Ticket / Trip Pass',
    workOrderForm: 'Work Order / Folha de Obra',
    diagnosis: 'Diagnosis & Requested Work',
    entryChecklist: 'Entry Checklist',
    partsReplaced: 'Parts Required / Replaced',
    exitObservations: 'Exit Observations',
    signatures: 'Signatures',
    engineer: 'Engineer',
    hourKmMeter: 'Hour/KM Meter',
    serviceNo: 'Service N°',
  },
  zh: {
    dashboard: '仪表板',
    equipment: '设备与库存场',
    inspections: '检查',
    workOrders: '工作令',
    travelLogs: '旅行指南',
    requisitions: '零件申请',
    documents: '文件',
    admin: '管理面板',
    welcome: '欢迎回来',
    signIn: '登录',
    signOut: '退出',
    email: '邮箱',
    password: '密码',
    loading: '正在加载EMS...',
    newWorkOrder: '新建工作令',
    newTravelLog: '新建旅行日志',
    newRequisition: '新建申请',
    newEquipment: '新建设备',
    newInspection: '新建检查',
    search: '搜索',
    status: '状态',
    actions: '操作',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    preview: '预览',
    download: '下载',
    generatePdf: '生成PDF',
    number: '编号',
    date: '日期',
    driver: '司机',
    vehicle: '车辆',
    destination: '目的地',
    purpose: '行程目的',
    client: '客户',
    model: '型号',
    serialNumber: '序列号',
    requestedBy: '申请人',
    supervisor: '主管',
    urgency: '紧急',
    partsId: '零件编号',
    description: '描述',
    quantity: '数量',
    itemNo: '项目编号',
    technician: '技术员',
    mechanic: '机械师',
    dispatcher: '调度员',
    travelTeam: '出行团队',
    licensePlate: '车牌',
    departureDate: '出发日期',
    expectedReturnTime: '预计返回时间',
    arrivalDate: '到达日期',
    arrivalTime: '到达时间',
    startKm: '起始公里',
    endKm: '结束公里',
    fuelLevel: '燃油位',
    checklist: '检查清单',
    notes: '备注',
    noData: '未找到数据',
    operational: '运行中',
    maintenance: '维修中',
    standby: '待机',
    broken: '故障',
    open: '待处理',
    inProgress: '进行中',
    waitingParts: '等待零件',
    completed: '已完成',
    cancelled: '已取消',
    pending: '待定',
    approved: '已批准',
    rejected: '已拒绝',
    fulfilled: '已完成',
    planned: '已计划',
    inTransit: '运输中',
    partsServiceRequest: '零件与服务申请表',
    travelTicket: '旅行票证',
    workOrderForm: '工作令 / Folha de Obra',
    diagnosis: '诊断与要求工作',
    entryChecklist: '入场检查清单',
    partsReplaced: '所需/更换零件',
    exitObservations: '出场观察',
    signatures: '签名',
    engineer: '工程师',
    hourKmMeter: '小时/公里表',
    serviceNo: '服务编号',
  },
};

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function generateNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map((n) => {
      const match = n.match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(3, '0')}`;
}
