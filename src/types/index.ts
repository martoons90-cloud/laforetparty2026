export type UserRole = 'owner' | 'admin' | 'fiduciante' | 'intendente';

export interface User {
  id: string;
  name: string;
  username?: string; // e.g. "efrain.rodriguez"
  email: string;
  role: UserRole;
  isFiduciante?: boolean;
  isCabezaDeEquipo?: boolean;
  partName: string; // e.g. "Cabeza 1 - Parte I (25%)"
  cabezaNumber?: number; // 1, 2, 3, 4
  sharePercentage?: number; // % de participación / aporte / acciones en gastos y expensas (ej: 6.25, 12.5, 25)
  annualQuotaDays: number;
  usedDays: number;
  pendingDays: number;
  color: string; // Hex color for calendar
  avatarInitials: string;
  phone: string;
  password?: string; // 6-character alphanumeric password
  active: boolean;
  createdAt: string;
}

export const isUserAdmin = (user?: User | null): boolean => user?.role === 'admin';
// Intendente is the ONLY role with 100% access across the entire system
export const isUserIntendente = (user?: User | null): boolean => user?.role === 'intendente';
export const hasTotalSystemAccess = (user?: User | null): boolean =>
  Boolean(isUserIntendente(user));

export const isUserFiduciante = (user?: User | null): boolean =>
  user?.role === 'fiduciante' || Boolean(user?.isFiduciante);
export const isUserCabezaDeEquipo = (user?: User | null): boolean =>
  Boolean(user?.isCabezaDeEquipo);

// Full operational rights (inventory management, incident resolution, maintenance blocks)
export const hasFullOperationalAccess = (user?: User | null): boolean =>
  Boolean(isUserIntendente(user));

// Financial power: exclusively for Gastos, Cobranzas, Caja & Cuentas (Admin & Intendente)
export const hasFinancialAccess = (user?: User | null): boolean =>
  Boolean(isUserAdmin(user) || isUserIntendente(user));

// Upload expenses allowed for Cabezas de Equipo, Admin & Intendente
export const canUploadExpenses = (user?: User | null): boolean =>
  Boolean(isUserAdmin(user) || isUserIntendente(user) || isUserCabezaDeEquipo(user));

export const hasPrivilegedAccess = (user?: User | null): boolean =>
  Boolean(isUserAdmin(user) || isUserIntendente(user) || isUserFiduciante(user) || isUserCabezaDeEquipo(user));


export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  partName: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  totalDays: number;
  status: BookingStatus;
  guestsCount: number;
  arrivalTime: string;
  notes?: string;
  cleaningBufferApplied: boolean;
  cleaningBufferEndDate?: string; // Next day YYYY-MM-DD
  createdAt: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export type BlockReason = 'maintenance' | 'repairs' | 'deep_cleaning' | 'seasonal_prep' | 'extraordinary';

export interface DateBlock {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: BlockReason;
  title: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface HouseRule {
  id: string;
  category: 'horarios' | 'capacidad' | 'mascotas' | 'quincho' | 'pileta' | 'convivencia';
  title: string;
  description: string;
  iconName: string;
}

export interface UsefulContact {
  id: string;
  category: 'emergencia' | 'seguridad' | 'personal' | 'servicios';
  name: string;
  role: string;
  phone: string;
  availableHours: string;
  notes?: string;
  isEmergency?: boolean;
}

export interface DocumentItem {
  id: string;
  title: string;
  category: 'contrato' | 'acta' | 'reglamento' | 'mantenimiento' | 'manual';
  version: string;
  date: string;
  fileSize: string;
  description: string;
  downloadUrl?: string;
  photoUrl?: string;
}

export type InventoryCategory =
  | 'living_galeria'
  | 'cocina_vajilla'
  | 'suites_dormitorios'
  | 'quincho_asador'
  | 'piscina_parque'
  | 'blanqueria_ropa'
  | 'equipamiento_tecnico';

export type InventoryCondition = 'excelente' | 'bueno' | 'regular' | 'requiere_reparacion' | 'faltante';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  locationRoom: string; // e.g. "Quincho", "Suite Principal", "Cocina"
  quantity: number;
  unit: string; // "unidades", "juegos", "piezas", "bolsas"
  condition: InventoryCondition;
  notes?: string;
  imageUrl?: string;
  lastCheckedDate: string;
}

export type IncidentUrgency = 'baja' | 'media' | 'alta' | 'urgente';
export type IncidentStatus = 'pendiente' | 'en_revision' | 'en_reparacion' | 'resuelto' | 'desestimado';

export interface IncidentReport {
  id: string;
  bookingId?: string;
  reporterUserId: string;
  reporterName: string;
  reporterPartName: string;
  title: string;
  description: string;
  location: string;
  category: 'rotura' | 'faltante' | 'desperfecto_tecnico' | 'limpieza' | 'mantenimiento' | 'otro';
  urgency: IncidentUrgency;
  status: IncidentStatus;
  photoUrl?: string;
  createdAt: string;
  adminResponse?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface NotificationPush {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type:
    | 'booking_created'
    | 'booking_approved'
    | 'booking_rejected'
    | 'booking_cancelled'
    | 'block_added'
    | 'quota_updated'
    | 'incident_reported'
    | 'incident_resolved'
    | 'system';
  targetUserId?: string | null; // null/undefined means all users. If set, ONLY that user or admin sees it
  bookingUserId?: string | null; // The applicant user whose dates were approved or rejected
  bookingUserName?: string | null;
  bookingPartName?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  totalDays?: number | null;
  bookingId?: string | null;
  incidentId?: string | null;
}

export interface CustomCategory {
  id: string;
  name: string;
  description?: string;
}

export interface TrustSettings {
  houseName: string;
  slogan?: string;
  location: string;
  googleMapsUrl?: string;
  wifiSsid: string;
  wifiPassword: string;
  secondaryWifiSsid?: string;
  secondaryWifiPassword?: string;
  checkInTime: string; // "14:00"
  checkOutTime: string; // "11:00"
  autoCleaningBufferHours: number; // 24
  cancellationMinDays: number; // 7
  maxGuestsLimit: number; // 12
  maxConsecutiveDays?: number; // 14
  maxActiveBookingsPerOwner?: number; // 3
  emergencyAddress: string;
  caretakerName?: string;
  caretakerPhone?: string;
  allowPets?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  logoUrl?: string;
  cbu?: string;
  aliasBancario?: string;
  cuitFideicomiso?: string;
  bancoNombre?: string;
  titularCuenta?: string;
  wifiCoverageNotes?: string;
  updatedAt?: string;
  expenseCategories?: CustomCategory[];
  cashFlowCategories?: CustomCategory[];
  feeCategories?: CustomCategory[];
  inventoryCategories?: CustomCategory[];
}

// -------------------------------------------------------------
// COBRANZAS, EXPENSAS Y DISTRIBUCIÓN DE GASTOS
// -------------------------------------------------------------
export type DistributionMode = 'share_percentage' | 'equal_cabezas' | 'equal_owners' | 'percentage' | 'custom_amount';

export type RecurrenceType = 'monthly' | 'days_45' | 'days_60' | 'custom_days' | 'one_time';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue';

export interface OwnerFeeAllocation {
  userId: string;
  userName: string;
  partName: string; // e.g. "Cabeza 1"
  cabezaNumber?: number;
  percentage: number; // % assigned
  assignedAmount: number; // $ assigned
  paidAmount: number; // $ paid so far
  status: PaymentStatus;
  paidAt?: string; // YYYY-MM-DD
  paymentMethod?: 'transfer' | 'cash' | 'check' | 'mercadopago' | 'other';
  receiptUrl?: string; // Photo voucher in R2
  notes?: string;
  /** Datos del plan financiero, persistidos junto a la asignación en la base. */
  financingInterestPercentage?: number;
  baseInstallmentAmount?: number;
}

export interface FeeCollection {
  id: string;
  concept: string; // e.g. "Expensas Mantenimiento General & Servicios"
  category: 'expensas_ordinarias' | 'obras_extraordinarias' | 'servicios' | 'mantenimiento' | 'impuestos' | 'otro';
  totalAmount: number;
  currency: 'ARS' | 'USD';
  recurrence: RecurrenceType;
  customRecurrenceDays?: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  distributionMode: DistributionMode;
  allocations: OwnerFeeAllocation[];
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  notes?: string;
  installmentsCount?: number; // Total number of installments (e.g. 12)
  installmentNumber?: number; // Current installment (e.g. 1)
  transferredPercentage?: number; // e.g. 10 (%) or 100 (%)
  originalExpenseId?: string;
}

// -------------------------------------------------------------
// GESTOR DE GASTOS Y FACTURAS DEL FIDEICOMISO
// -------------------------------------------------------------
export type ExpenseCategory =
  | 'servicios' // Luz, agua, gas, wifi
  | 'personal_casero' // Sueldo casero, encarga de limpieza
  | 'mantenimiento' // Reparaciones, parque, pileta
  | 'impuestos' // Inmobiliario, tasas municipales
  | 'insumos' // Productos de limpieza, insumos quincho
  | 'otro';

export interface ExpenseItem {
  id: string;
  concept: string; // e.g., "Factura Luz EPEC Octubre 2026"
  category: ExpenseCategory;
  amount: number;
  currency: 'ARS' | 'USD';
  periodMonth: string; // "2026-10"
  date: string; // YYYY-MM-DD
  provider?: string; // e.g., "EPEC", "Aguas Cordobesas", "Casero"
  invoiceNumber?: string; // e.g. "0001-0004812" or "N° 84920"
  status: 'paid' | 'pending';
  paidAt?: string;
  paymentMethod?: string;
  receiptUrl?: string; // Foto factura / comprobante
  notes?: string;
  transferredToFeeCollectionId?: string; // ID of fee collection created from this expense/month
  transferredPercentage?: number; // % transferred to fee collection
  transferredInstallments?: number; // Number of installments created
  createdBy: string;
  userId?: string; // User who paid/submitted the expense
  userName?: string;
  partName?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // Subject to admin approval
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  reimbursementStatus?: 'unpaid' | 'partial' | 'fully_repaid';
  reimbursedAmount?: number; // Amount returned so far
  createdAt: string;
}

// -------------------------------------------------------------
// CAJA, INGRESOS, EGRESOS Y CUENTA CORRIENTE DE COPROPIETARIOS
// -------------------------------------------------------------
export type CashFlowType = 'ingreso' | 'egreso';
export type CashFlowCategory =
  | 'aporte_socio'
  | 'pago_expensas'
  | 'pago_proveedor'
  | 'reintegro_gasto'
  | 'fondo_reserva'
  | 'otro_ingreso'
  | 'otro_egreso';

export interface CashFlowTransaction {
  id: string;
  type: CashFlowType;
  category: CashFlowCategory;
  concept: string;
  amount: number;
  currency: 'ARS' | 'USD';
  date: string; // YYYY-MM-DD
  userId?: string; // Linked user account if applicable
  userName?: string;
  partName?: string;
  expenseId?: string; // Linked expense if reimbursement
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface UserAccountBalance {
  userId: string;
  userName: string;
  partName: string;
  totalAdvanced: number; // Total spent out of pocket for the trust
  totalReimbursed: number; // Total refunded back to the user from cash flow
  balanceDue: number; // Remaining balance the trust owes the user
  pendingExpensesCount: number;
}


