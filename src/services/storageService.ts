import {
  User,
  Booking,
  BookingStatus,
  DateBlock,
  HouseRule,
  UsefulContact,
  DocumentItem,
  TrustSettings,
  NotificationPush,
  InventoryItem,
  IncidentReport,
  FeeCollection,
  OwnerFeeAllocation,
  ExpenseItem,
  CashFlowTransaction,
  CustomCategory,
} from '../types';
import { pushService } from './notificationService';
import { supabaseService } from './supabaseService';

const USERS_KEY = 'el_desayuno_users_v3';
const BOOKINGS_KEY = 'el_desayuno_bookings_v3';
const BLOCKS_KEY = 'el_desayuno_blocks_v3';
const SETTINGS_KEY = 'el_desayuno_settings_v3';
const RULES_KEY = 'el_desayuno_rules_v3';
const CONTACTS_KEY = 'el_desayuno_contacts_v3';
const DOCUMENTS_KEY = 'el_desayuno_documents_v3';
const INVENTORY_KEY = 'el_desayuno_inventory_v3';
const INCIDENTS_KEY = 'el_desayuno_incidents_v3';
const NOTIFICATIONS_KEY = 'el_desayuno_notifications_v3';
const FEES_KEY = 'el_desayuno_fees_v3';
const EXPENSES_KEY = 'el_desayuno_expenses_v1';
const CASH_FLOW_KEY = 'el_desayuno_cashflow_v1';
const CURRENT_USER_KEY = 'el_desayuno_current_user_v3';

/** Estado vacío: la interfaz nunca inventa información si la base no la devuelve. */
export const DEFAULT_USERS: User[] = [];
export const DEFAULT_SETTINGS: TrustSettings = {
  houseName: '', location: '', wifiSsid: '', wifiPassword: '', checkInTime: '', checkOutTime: '',
  autoCleaningBufferHours: 0, cancellationMinDays: 0, maxGuestsLimit: 0, emergencyAddress: '',
  expenseCategories: [], cashFlowCategories: [], feeCategories: [], inventoryCategories: [],
};
export const DEFAULT_BOOKINGS: Booking[] = [];
export const DEFAULT_BLOCKS: DateBlock[] = [];
export const DEFAULT_HOUSE_RULES: HouseRule[] = [];
export const DEFAULT_CONTACTS: UsefulContact[] = [];
export const DEFAULT_DOCUMENTS: DocumentItem[] = [];
export const DEFAULT_INVENTORY: InventoryItem[] = [];
export const DEFAULT_INCIDENTS: IncidentReport[] = [];
export const DEFAULT_NOTIFICATIONS: NotificationPush[] = [];
export const DEFAULT_FEE_COLLECTIONS: FeeCollection[] = [];
export const DEFAULT_EXPENSES: ExpenseItem[] = [];

export const DEFAULT_EXPENSE_CATEGORIES: CustomCategory[] = [];
export const DEFAULT_CASHFLOW_CATEGORIES: CustomCategory[] = [];
export const DEFAULT_FEE_CATEGORIES: CustomCategory[] = [];
export const DEFAULT_INVENTORY_CATEGORIES: CustomCategory[] = [];

export function normalizeSettings(s: any): TrustSettings {
  if (!s || typeof s !== 'object') return DEFAULT_SETTINGS;
  return {
    houseName: s.houseName ?? s.house_name ?? DEFAULT_SETTINGS.houseName,
    location: s.location ?? DEFAULT_SETTINGS.location,
    wifiSsid: s.wifiSsid ?? s.wifi_ssid ?? DEFAULT_SETTINGS.wifiSsid,
    wifiPassword: s.wifiPassword ?? s.wifi_password ?? DEFAULT_SETTINGS.wifiPassword,
    checkInTime: s.checkInTime ?? s.check_in_time ?? DEFAULT_SETTINGS.checkInTime,
    checkOutTime: s.checkOutTime ?? s.check_out_time ?? DEFAULT_SETTINGS.checkOutTime,
    autoCleaningBufferHours: Number(s.autoCleaningBufferHours ?? s.auto_cleaning_buffer_hours ?? DEFAULT_SETTINGS.autoCleaningBufferHours),
    cancellationMinDays: Number(s.cancellationMinDays ?? s.cancellation_min_days ?? DEFAULT_SETTINGS.cancellationMinDays),
    maxGuestsLimit: Number(s.maxGuestsLimit ?? s.max_guests_limit ?? DEFAULT_SETTINGS.maxGuestsLimit),
    emergencyAddress: s.emergencyAddress ?? s.emergency_address ?? DEFAULT_SETTINGS.emergencyAddress,
    logoUrl: s.logoUrl ?? s.logo_url ?? '',
    cbu: s.cbu ?? DEFAULT_SETTINGS.cbu,
    aliasBancario: s.aliasBancario ?? s.alias_bancario ?? DEFAULT_SETTINGS.aliasBancario,
    titularCuenta: s.titularCuenta ?? s.titular_cuenta ?? DEFAULT_SETTINGS.titularCuenta,
    cuitFideicomiso: s.cuitFideicomiso ?? s.cuit_fideicomiso ?? DEFAULT_SETTINGS.cuitFideicomiso,
    bancoNombre: s.bancoNombre ?? s.banco_nombre ?? DEFAULT_SETTINGS.bancoNombre,
    wifiCoverageNotes: s.wifiCoverageNotes ?? s.wifi_coverage_notes ?? DEFAULT_SETTINGS.wifiCoverageNotes,
    slogan: s.slogan ?? DEFAULT_SETTINGS.slogan,
    updatedAt: s.updatedAt ?? s.updated_at ?? new Date().toISOString(),
    expenseCategories: Array.isArray(s.expenseCategories) ? s.expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
    cashFlowCategories: Array.isArray(s.cashFlowCategories) ? s.cashFlowCategories : DEFAULT_CASHFLOW_CATEGORIES,
    feeCategories: Array.isArray(s.feeCategories) ? s.feeCategories : DEFAULT_FEE_CATEGORIES,
    inventoryCategories: Array.isArray(s.inventoryCategories) ? s.inventoryCategories : DEFAULT_INVENTORY_CATEGORIES,
  };
}

// Helper to calculate days used per user from active bookings
function recalculateUsersUsedDays(users: User[], bookings: Booking[]): User[] {
  return users.map((user) => {
    if (user.role === 'admin') return user;
    const userBookings = bookings.filter(
      (b) => b.userId === user.id && (b.status === 'confirmed' || b.status === 'completed')
    );
    const used = userBookings.reduce((sum, b) => sum + b.totalDays, 0);
    return {
      ...user,
      usedDays: used,
    };
  });
}

// Storage Class
class StorageService {
  private listeners: Array<() => void> = [];
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      // Cross-tab synchronization via BroadcastChannel (< 1ms between tabs of same browser)
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('el_desayuno_sync_channel');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'SYNC_SETTINGS' && event.data.settings) {
              const merged = { ...DEFAULT_SETTINGS, ...event.data.settings };
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
              if (merged.logoUrl) {
                localStorage.setItem('el_desayuno_custom_logo', merged.logoUrl);
              }
              this.notify(false, false);
            } else if (event.data?.type === 'SYNC_ALL') {
              this.notify(false, false);
            }
          };
        } catch (err) {
          console.warn('BroadcastChannel error:', err);
        }
      }

      window.addEventListener('storage', () => {
        this.notify(false, false);
      });
    }
  }

  private init() {
    if (typeof window === 'undefined') return;

    // No reutilizamos el caché anterior: la base es la única fuente de verdad.
    [USERS_KEY, BOOKINGS_KEY, BLOCKS_KEY, SETTINGS_KEY, RULES_KEY, CONTACTS_KEY,
      DOCUMENTS_KEY, INVENTORY_KEY, INCIDENTS_KEY, NOTIFICATIONS_KEY, FEES_KEY,
      EXPENSES_KEY, CASH_FLOW_KEY].forEach((key) => localStorage.setItem(key, key === SETTINGS_KEY ? JSON.stringify(DEFAULT_SETTINGS) : '[]'));

    // Hydrate server state and settings directly from database for cross-browser synchronization
    this.fetchLatestSettingsFromDatabase();
    this.hydrateFromAppStateAsync();

    // Real-time synchronization stream via SSE (< 50ms sync across all browser sessions)
    this.initRealtimeSyncStream();

    // Auto-refresh from cloud server on focus, visibility change, and periodic fallback
    window.addEventListener('focus', () => {
      this.fetchLatestSettingsFromDatabase();
      this.hydrateFromAppStateAsync();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.fetchLatestSettingsFromDatabase();
        this.hydrateFromAppStateAsync();
      }
    });

    // Smart background sync: only poll every 30s as a fallback when tab is active
    setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.hydrateFromAppStateAsync();
      }
    }, 30000);
  }

  private initRealtimeSyncStream() {
    if (typeof window === 'undefined') return;
    try {
      const eventSource = new EventSource('/api/sync/events');
      const handleSyncMessage = (e: MessageEvent) => {
        try {
          if (e.data) {
            const parsed = JSON.parse(e.data);
            if (parsed.payload?.settings && typeof parsed.payload.settings === 'object') {
              const current = this.getSettings();
              const merged = { ...DEFAULT_SETTINGS, ...current, ...parsed.payload.settings };
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
              if (merged.logoUrl) {
                localStorage.setItem('el_desayuno_custom_logo', merged.logoUrl);
              }
              this.notify(false, true);
            }
          }
        } catch {}
        this.hydrateFromAppStateAsync();
      };

      eventSource.addEventListener('sync', handleSyncMessage);
      eventSource.onmessage = handleSyncMessage;
      eventSource.onerror = () => {
        // EventSource handles auto-reconnect
      };
    } catch (err) {
      console.warn('Realtime sync stream fallback to polling:', err);
    }
  }

  public async hydrateFromAppStateAsync() {
    if (typeof window === 'undefined') return;
    try {
      const result = await supabaseService.pullDataFromSupabase();
      if (result.success && result.data) {
        const data = { success: true, data: result.data };
        let hasChanges = false;

        const currentBookingsRaw = localStorage.getItem(BOOKINGS_KEY) || '[]';
        const serverBookingsRaw = JSON.stringify(data.data.bookings || []);
        if (currentBookingsRaw !== serverBookingsRaw) {
          localStorage.setItem(BOOKINGS_KEY, serverBookingsRaw);
          hasChanges = true;
        }

        const currentUsersRaw = localStorage.getItem(USERS_KEY) || '[]';
        const serverUsersRaw = JSON.stringify(data.data.users || []);
        if (currentUsersRaw !== serverUsersRaw && Array.isArray(data.data.users)) {
          localStorage.setItem(USERS_KEY, serverUsersRaw);
          hasChanges = true;
        }

        if (Array.isArray(data.data.blocks)) {
          const currentBlocksRaw = localStorage.getItem(BLOCKS_KEY) || '[]';
          const serverBlocksRaw = JSON.stringify(data.data.blocks);
          if (currentBlocksRaw !== serverBlocksRaw) {
            localStorage.setItem(BLOCKS_KEY, serverBlocksRaw);
            hasChanges = true;
          }
        }

        if (Array.isArray(data.data.fees)) {
          const currentFeesRaw = localStorage.getItem(FEES_KEY) || '[]';
          const serverFeesRaw = JSON.stringify(data.data.fees);
          if (currentFeesRaw !== serverFeesRaw) {
            localStorage.setItem(FEES_KEY, serverFeesRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.expenses)) {
          const currentExpensesRaw = localStorage.getItem(EXPENSES_KEY) || '[]';
          const serverExpensesRaw = JSON.stringify(data.data.expenses);
          if (currentExpensesRaw !== serverExpensesRaw) {
            localStorage.setItem(EXPENSES_KEY, serverExpensesRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.cashFlow)) {
          const currentCFRaw = localStorage.getItem(CASH_FLOW_KEY) || '[]';
          const serverCFRaw = JSON.stringify(data.data.cashFlow);
          if (currentCFRaw !== serverCFRaw) {
            localStorage.setItem(CASH_FLOW_KEY, serverCFRaw);
            hasChanges = true;
          }
        }
        if (data.data.settings && typeof data.data.settings === 'object') {
          const currentSettings = this.getSettings();
          const serverNormalized = normalizeSettings(data.data.settings);

          // Deep comparison of all setting fields
          let isDifferent = false;
          for (const key of Object.keys(serverNormalized) as (keyof TrustSettings)[]) {
            if (key === 'updatedAt') continue;
            const val1 = currentSettings[key];
            const val2 = serverNormalized[key];
            if (Array.isArray(val1) && Array.isArray(val2)) {
              if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                isDifferent = true;
                break;
              }
            } else if (val1 !== val2) {
              isDifferent = true;
              break;
            }
          }

          if (isDifferent) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(serverNormalized));
            if (serverNormalized.logoUrl) {
              localStorage.setItem('el_desayuno_custom_logo', serverNormalized.logoUrl);
            }
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.rules)) {
          const currentRulesRaw = localStorage.getItem(RULES_KEY) || '[]';
          const serverRulesRaw = JSON.stringify(data.data.rules);
          if (currentRulesRaw !== serverRulesRaw) {
            localStorage.setItem(RULES_KEY, serverRulesRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.contacts)) {
          const currentContactsRaw = localStorage.getItem(CONTACTS_KEY) || '[]';
          const serverContactsRaw = JSON.stringify(data.data.contacts);
          if (currentContactsRaw !== serverContactsRaw) {
            localStorage.setItem(CONTACTS_KEY, serverContactsRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.documents)) {
          const currentDocsRaw = localStorage.getItem(DOCUMENTS_KEY) || '[]';
          const serverDocsRaw = JSON.stringify(data.data.documents);
          if (currentDocsRaw !== serverDocsRaw) {
            localStorage.setItem(DOCUMENTS_KEY, serverDocsRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.inventory)) {
          const currentInvRaw = localStorage.getItem(INVENTORY_KEY) || '[]';
          const serverInvRaw = JSON.stringify(data.data.inventory);
          if (currentInvRaw !== serverInvRaw) {
            localStorage.setItem(INVENTORY_KEY, serverInvRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.incidents)) {
          const currentIncRaw = localStorage.getItem(INCIDENTS_KEY) || '[]';
          const serverIncRaw = JSON.stringify(data.data.incidents);
          if (currentIncRaw !== serverIncRaw) {
            localStorage.setItem(INCIDENTS_KEY, serverIncRaw);
            hasChanges = true;
          }
        }
        if (Array.isArray(data.data.notifications)) {
          const currentNotifRaw = localStorage.getItem(NOTIFICATIONS_KEY) || '[]';
          const serverNotifRaw = JSON.stringify(data.data.notifications);
          if (currentNotifRaw !== serverNotifRaw) {
            localStorage.setItem(NOTIFICATIONS_KEY, serverNotifRaw);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          this.notify(false);
        }
      }
    } catch {
      // Offline fallback
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(_syncDatabase: boolean = true, broadcast: boolean = true) {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'SYNC_SETTINGS',
          settings: this.getSettings(),
        });
      } catch (err) {
        console.warn('BroadcastChannel post error:', err);
      }
    }
  }

  // Current User / Auth
  public getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // Refresh user data from users list
      const all = this.getUsers();
      return all.find((u) => u.id === parsed.id) || parsed;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: User | null) {
    if (typeof window === 'undefined') return;
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    this.notify();
  }

  public login(userInput: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const cleanInput = userInput.trim().toLowerCase();
    const normalizeStr = (s: string) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\.\-_]+/g, '');

    const normInput = normalizeStr(cleanInput);

    const found = users.find((u) => {
      const uEmail = normalizeStr(u.email || '');
      const uUsername = normalizeStr(u.username || '');
      const uName = normalizeStr(u.name || '');
      const uId = normalizeStr(u.id || '');
      const uPass = normalizeStr(u.password || '');

      return (
        uEmail === normInput ||
        uUsername === normInput ||
        uName === normInput ||
        uId === normInput ||
        (normInput.length >= 3 && (uId.includes(normInput) || uName.includes(normInput) || uUsername.includes(normInput)))
      );
    });

    if (!found) {
      return {
        success: false,
        error: 'Usuario no registrado en el Fideicomiso El Desayuno.',
      };
    }

    if (!found.active) {
      return { success: false, error: 'Este usuario no está activo en la base de datos.' };
    }

    if (password) {
      const inputPass = password.trim().toUpperCase();
      const userPass = (found.password || '').trim().toUpperCase();
      if (!userPass || inputPass !== userPass) {
        return {
          success: false,
          error: 'Contraseña incorrecta.',
        };
      }
    }

    this.setCurrentUser(found);
    return { success: true, user: found };
  }

  public logout() {
    this.setCurrentUser(null);
  }

  // Users
  public getUsers(): User[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    try {
      const parsed: User[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public async saveUser(user: User): Promise<boolean> {
    const users = this.getUsers();
    const index = users.findIndex((u) => {
      if (user.id && u.id === user.id) return true;
      if (!user.id) {
        if (user.email && user.email.trim() !== '' && u.email && u.email.trim().toLowerCase() === user.email.trim().toLowerCase()) return true;
        if (user.username && user.username.trim() !== '' && u.username && u.username.trim().toLowerCase() === user.username.trim().toLowerCase()) return true;
      }
      return false;
    });

    let updated: User[];
    const targetUser = { ...user };
    if (index >= 0) {
      updated = [...users];
      const targetId = targetUser.id || users[index].id;
      targetUser.id = targetId;
      updated[index] = { ...users[index], ...targetUser };
    } else {
      if (!targetUser.id) {
        targetUser.id = 'user-' + Date.now();
      }
      updated = [...users, targetUser];
    }
    const saved = await supabaseService.saveUser(targetUser);
    if (!saved) {
      await this.hydrateFromAppStateAsync();
      return false;
    }

    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    const current = this.getCurrentUser();
    if (current?.id === targetUser.id) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ ...current, ...targetUser }));
    }
    this.notify(false);
    return true;
  }

  public async assignCabezaLeader(cabezaNumber: number, newLeaderUserId: string): Promise<boolean> {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.cabezaNumber === cabezaNumber) {
        return {
          ...u,
          isCabezaDeEquipo: u.id === newLeaderUserId,
        };
      }
      return u;
    });
    const members = updated.filter((u) => u.cabezaNumber === cabezaNumber);
    const saved = await supabaseService.saveUsers(members);
    if (!saved) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    this.notify(false);
    return true;
  }

  public async toggleUserCabezaDeEquipo(userId: string): Promise<boolean> {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return false;
    const newStatus = !target.isCabezaDeEquipo;
    const updatedUser = { ...target, isCabezaDeEquipo: newStatus };
    return this.saveUser(updatedUser);
  }

  public async toggleUserFiduciante(userId: string): Promise<boolean> {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return false;
    const newStatus = !target.isFiduciante;
    const updatedRole = newStatus ? ('fiduciante' as const) : ('owner' as const);
    const updatedUser = { ...target, isFiduciante: newStatus, role: updatedRole };
    return this.saveUser(updatedUser);
  }

  public async updateBulkSharePercentages(sharesMap: Record<string, number>): Promise<boolean> {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (sharesMap[u.id] !== undefined) {
        return {
          ...u,
          sharePercentage: Math.max(0, Math.round(Number(sharesMap[u.id]) * 10000) / 10000),
        };
      }
      return u;
    });
    const saved = await supabaseService.saveUsers(updated.filter((u) => sharesMap[u.id] !== undefined));
    if (!saved) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    this.notify(false);
    return true;
  }

  public async deleteUser(userId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteUser(userId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const users = this.getUsers().filter((u) => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    this.notify(false);
    return true;
  }

  // Transfer Administrator role to another user
  public transferAdminRole(newAdminUserId: string, currentAdminUserId?: string): { success: boolean; message: string } {
    const users = this.getUsers();
    const newAdmin = users.find((u) => u.id === newAdminUserId);
    if (!newAdmin) {
      return { success: false, message: 'Usuario destinatario no encontrado.' };
    }

    const updated = users.map((u) => {
      if (u.id === newAdminUserId) {
        return { ...u, role: 'admin' as const };
      }
      if (u.role === 'admin' || (currentAdminUserId && u.id === currentAdminUserId)) {
        return { ...u, role: 'owner' as const };
      }
      return u;
    });

    localStorage.setItem(USERS_KEY, JSON.stringify(updated));

    // Update active currentUser session if needed
    const current = this.getCurrentUser();
    if (current) {
      const refreshed = updated.find((u) => u.id === current.id);
      if (refreshed) {
        this.setCurrentUser(refreshed);
      }
    }

    this.addNotification({
      title: 'Traspaso de Poder de Administración',
      body: `${newAdmin.name} ha asumido como Administrador de la sociedad.`,
      type: 'system',
    });

    this.notify(false);

    fetch('/api/users/transfer-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAdminUserId, currentAdminUserId }),
    }).catch((err) => console.error('Error transfiriendo administración en servidor:', err));

    return {
      success: true,
      message: `Poder de administración transferido exitosamente a ${newAdmin.name}.`,
    };
  }

  // Update 6-character alphanumeric password for a user
  public updateUserPassword(userId: string, newPasswordRaw: string): { success: boolean; message: string } {
    const code = newPasswordRaw.trim().toUpperCase();
    if (code.length !== 6) {
      return {
        success: false,
        message: 'La contraseña debe ser un código alfanumérico de exactamente 6 caracteres.',
      };
    }
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const updated = users.map((u) => (u.id === userId ? { ...u, password: code } : u));
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, password: code });
    }

    this.notify(false);

    fetch(`/api/users/${userId}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: code }),
    }).catch((err) => console.error('Error actualizando contraseña en servidor:', err));

    return {
      success: true,
      message: `Contraseña de ${user.name} actualizada correctamente a "${code}".`,
    };
  }

  // Bookings
  public getBookings(): Booking[] {
    if (typeof window === 'undefined') return DEFAULT_BOOKINGS;
    const raw = localStorage.getItem(BOOKINGS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_BOOKINGS;
  }

  // Primary Authoritative Cloud Booking Method (Validates against Cloud Server)
  public async createBookingAsync(booking: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> {
    const bookingToCreate = {
      ...booking,
      status: booking.status || ('pending' as BookingStatus),
    };

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingToCreate),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // Instantly refresh cache from cloud so user sees what is occupied
      await this.hydrateFromAppStateAsync();
      throw new Error(data.error || 'Conflicto de fechas: no fue posible registrar la reserva.');
    }

    const newBooking: Booking = data.booking;
    const currentBookings = this.getBookings().filter((b) => b.id !== newBooking.id);
    const updated = [newBooking, ...currentBookings];
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));

    // Update user quota (only confirmed/completed count)
    const users = this.getUsers();
    const recalculated = recalculateUsersUsedDays(users, updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));

    // Add push notification
    this.addNotification({
      title: 'Nueva Solicitud de Reserva',
      body: `${newBooking.userName} solicitó del ${newBooking.checkInDate} al ${newBooking.checkOutDate} (${newBooking.totalDays} noches). En espera de aprobación administrativa.`,
      type: 'booking_created',
      bookingId: newBooking.id,
    });

    this.notify(false);
    return newBooking;
  }

  // Synchronous fallback (calls cloud async in background)
  public createBooking(booking: Omit<Booking, 'id' | 'createdAt'>): Booking {
    const bookings = this.getBookings();
    const newBooking: Booking = {
      ...booking,
      status: booking.status || ('pending' as BookingStatus),
      id: 'book-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newBooking, ...bookings];
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));

    const users = this.getUsers();
    const recalculated = recalculateUsersUsedDays(users, updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));

    this.addNotification({
      title: 'Nueva Solicitud de Reserva',
      body: `${newBooking.userName} solicitó del ${newBooking.checkInDate} al ${newBooking.checkOutDate} (${newBooking.totalDays} noches). En espera de aprobación administrativa.`,
      type: 'booking_created',
      bookingId: newBooking.id,
    });

    this.notify(false);

    // Call cloud server in background
    this.createBookingAsync(booking).catch((err) => {
      console.warn('Syncing booking to cloud server:', err);
    });

    return newBooking;
  }

  // Approve a pending booking (Admin action)
  public async approveBookingAsync(bookingId: string, approvedByName: string = 'Administrador'): Promise<Booking | null> {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const updated = bookings.map((b) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'confirmed' as BookingStatus,
        };
      }
      return b;
    });

    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));

    const users = this.getUsers();
    const recalculated = recalculateUsersUsedDays(users, updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));

    // Add notification with rich metadata for personalized display (both applicant and other owners)
    this.addNotification({
      title: '¡Reserva Aprobada por Administración!',
      body: `La reserva de ${booking.userName} (${booking.checkInDate} al ${booking.checkOutDate}) ha sido confirmada por ${approvedByName}.`,
      type: 'booking_approved',
      bookingId: booking.id,
      bookingUserId: booking.userId,
      bookingUserName: booking.userName,
      bookingPartName: booking.partName,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      totalDays: booking.totalDays,
      targetUserId: null, // Visible to all coproprietors
    });

    // Trigger instant push notification
    pushService.triggerPush({
      title: '¡Reserva Aprobada!',
      body: `La reserva de ${booking.userName} (${booking.checkInDate} al ${booking.checkOutDate}) fue aprobada por ${approvedByName}.`,
      type: 'booking_approved',
      bookingId: booking.id,
      bookingUserId: booking.userId,
      bookingUserName: booking.userName,
      bookingPartName: booking.partName,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      totalDays: booking.totalDays,
    });

    this.notify(false);

    // Call cloud server
    fetch(`/api/bookings/${bookingId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedByName }),
    }).catch((err) => console.error('Error aprobando en servidor:', err));

    return updated.find((b) => b.id === bookingId) || null;
  }

  public approveBooking(bookingId: string, approvedByName: string = 'Administrador') {
    this.approveBookingAsync(bookingId, approvedByName).catch((err) => {
      console.warn('Error ejecutando approveBookingAsync:', err);
    });
  }

  public cancelBooking(bookingId: string, reason: string, cancelledByName: string) {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const isRejection = booking.status === 'pending';

    const updated = bookings.map((b) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'cancelled' as BookingStatus,
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          cancelledBy: cancelledByName,
        };
      }
      return b;
    });

    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));

    const users = this.getUsers();
    const recalculated = recalculateUsersUsedDays(users, updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));

    if (isRejection) {
      // PRIVACY ENFORCEMENT: Rejections are strictly private to applicant (and admin)
      this.addNotification({
        title: 'Solicitud de Reserva Desestimada',
        body: `Tu solicitud de estadía para el período ${booking.checkInDate} al ${booking.checkOutDate} (${booking.totalDays} noches) fue desestimada por la administración: ${reason}. Las fechas han sido liberadas en el calendario común.`,
        type: 'booking_rejected',
        targetUserId: booking.userId, // ONLY the applicant and admin see this!
        bookingId: booking.id,
        bookingUserId: booking.userId,
        bookingUserName: booking.userName,
        bookingPartName: booking.partName,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalDays: booking.totalDays,
      });

      pushService.triggerPush({
        title: 'Solicitud de Reserva Desestimada',
        body: `Tu solicitud para el período ${booking.checkInDate} al ${booking.checkOutDate} fue desestimada: ${reason}.`,
        type: 'booking_rejected',
        targetUserId: booking.userId,
        bookingId: booking.id,
        bookingUserId: booking.userId,
      });
    } else {
      // Cancellation of already confirmed booking: public notification so others know dates are freed
      this.addNotification({
        title: 'Reserva Cancelada',
        body: `La reserva de ${booking.userName} (${booking.checkInDate} a ${booking.checkOutDate}) fue cancelada por ${cancelledByName}. Fechas disponibles en el calendario.`,
        type: 'booking_cancelled',
        bookingId: booking.id,
        bookingUserId: booking.userId,
        bookingUserName: booking.userName,
        bookingPartName: booking.partName,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        totalDays: booking.totalDays,
        targetUserId: null,
      });

      pushService.triggerPush({
        title: 'Reserva Cancelada',
        body: `Se liberaron las fechas del ${booking.checkInDate} al ${booking.checkOutDate} (${booking.userName}).`,
        type: 'booking_cancelled',
        bookingId: booking.id,
      });
    }

    this.notify(false);

    // Cancel on cloud server
    fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, cancelledByName }),
    }).catch((err) => console.error('Error cancelando en servidor:', err));
  }

  // Blocks
  public getBlocks(): DateBlock[] {
    if (typeof window === 'undefined') return DEFAULT_BLOCKS;
    const raw = localStorage.getItem(BLOCKS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_BLOCKS;
  }

  public createBlock(block: Omit<DateBlock, 'id' | 'createdAt'>): DateBlock {
    const blocks = this.getBlocks();
    const newBlock: DateBlock = {
      ...block,
      id: 'block-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newBlock, ...blocks];
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(updated));

    this.addNotification({
      title: 'Nuevo Bloqueo de Fechas',
      body: `Se bloquearon fechas del ${newBlock.startDate} al ${newBlock.endDate}: ${newBlock.title}`,
      type: 'block_added',
    });

    this.notify(false);

    fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBlock),
    }).catch((err) => console.error('Error guardando bloqueo en servidor:', err));

    return newBlock;
  }

  public async deleteBlock(blockId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteBlock(blockId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const blocks = this.getBlocks().filter((b) => b.id !== blockId);
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
    this.notify(false);
    return true;
  }

  // Settings (Authoritative Cloud Persistence)
  public getSettings(): TrustSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  // Force authoritative query to central database on open
  public async fetchLatestSettingsFromDatabase(): Promise<TrustSettings> {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const settings = await supabaseService.getSettingsFromSupabase();
      if (settings) {
        const normalized = normalizeSettings(settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
        if (normalized.logoUrl) localStorage.setItem('el_desayuno_custom_logo', normalized.logoUrl);
        this.notify(false, true);
        return normalized;
      }
    } catch (e) {
      console.warn('Error fetching latest settings from DB:', e);
    }

    return this.getSettings();
  }

  public async saveSettingsAsync(settings: Partial<TrustSettings>): Promise<TrustSettings> {
    const current = this.getSettings();
    const mergedToSave = { ...current, ...settings, updatedAt: new Date().toISOString() };

    try {
      const saved = await supabaseService.saveSettingsToSupabase(mergedToSave);
      const finalNormalized = normalizeSettings(saved);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalNormalized));
      if (finalNormalized.logoUrl) localStorage.setItem('el_desayuno_custom_logo', finalNormalized.logoUrl);
      this.notify(false, true);
      return finalNormalized;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'No se pudieron guardar los ajustes en la base de datos.');
    }
  }

  public saveSettings(settings: Partial<TrustSettings>) {
    const current = this.getSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    this.notify(false);
    this.saveSettingsAsync(merged).catch((err) => console.error('Cloud saveSettings error:', err));
  }

  // Rules
  public getRules(): HouseRule[] {
    if (typeof window === 'undefined') return DEFAULT_HOUSE_RULES;
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_HOUSE_RULES;
  }

  public saveRule(rule: HouseRule) {
    const list = this.getRules();
    const exists = list.some((r) => r.id === rule.id);
    const updated = exists ? list.map((r) => (r.id === rule.id ? rule : r)) : [...list, rule];
    localStorage.setItem(RULES_KEY, JSON.stringify(updated));
    this.notify(false);

    fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    }).catch((err) => console.error('Error guardando regla en servidor:', err));
  }

  public async deleteRule(ruleId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteRule(ruleId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getRules().filter((r) => r.id !== ruleId);
    localStorage.setItem(RULES_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  // Contacts
  public getContacts(): UsefulContact[] {
    if (typeof window === 'undefined') return DEFAULT_CONTACTS;
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONTACTS;
  }

  public saveContact(contact: UsefulContact) {
    const list = this.getContacts();
    const exists = list.some((c) => c.id === contact.id);
    const updated = exists ? list.map((c) => (c.id === contact.id ? contact : c)) : [...list, contact];
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(updated));
    this.notify(false);

    fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    }).catch((err) => console.error('Error guardando contacto en servidor:', err));
  }

  public async deleteContact(contactId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteContact(contactId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getContacts().filter((c) => c.id !== contactId);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  // Documents
  public getDocuments(): DocumentItem[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    if (!raw) return [];
    try {
      const parsed: DocumentItem[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveDocument(doc: DocumentItem) {
    const list = this.getDocuments();
    const exists = list.some((d) => d.id === doc.id);
    const updated = exists ? list.map((d) => (d.id === doc.id ? doc : d)) : [...list, doc];
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updated));
    this.notify(false);

    fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    }).catch((err) => console.error('Error guardando documento en servidor:', err));
  }

  public async deleteDocument(docId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteDocument(docId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getDocuments().filter((d) => d.id !== docId);
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  public async clearAllDocuments(): Promise<boolean> {
    const deleted = await supabaseService.deleteAllDocuments();
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify([]));
    this.notify(false);
    return true;
  }

  // Inventory & Stock of the Estate
  public getInventory(): InventoryItem[] {
    if (typeof window === 'undefined') return DEFAULT_INVENTORY;
    const raw = localStorage.getItem(INVENTORY_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_INVENTORY;
  }

  public async saveInventoryItem(item: InventoryItem): Promise<boolean> {
    const saved = await supabaseService.saveInventoryItem(item);
    if (!saved) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getInventory();
    const exists = list.some((i) => i.id === item.id);
    const updated = exists ? list.map((i) => (i.id === item.id ? item : i)) : [item, ...list];
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(updated));
    this.notify(false);
    return true;
  }

  public async deleteInventoryItemAsync(itemId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteInventoryItem(itemId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getInventory().filter((i) => i.id !== itemId);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  public deleteInventoryItem(itemId: string): Promise<boolean> {
    return this.deleteInventoryItemAsync(itemId);
  }

  // Incident Reports (Daños, novedades, roturas con fotos)
  public getIncidents(): IncidentReport[] {
    if (typeof window === 'undefined') return DEFAULT_INCIDENTS;
    const raw = localStorage.getItem(INCIDENTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_INCIDENTS;
  }

  public createIncident(incident: Omit<IncidentReport, 'id' | 'createdAt' | 'status'>): IncidentReport {
    const list = this.getIncidents();
    const newInc: IncidentReport = {
      ...incident,
      id: 'inc-' + Date.now(),
      createdAt: new Date().toISOString(),
      status: 'pendiente',
    };
    const updated = [newInc, ...list];
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated));

    // Send push notification to administrators and users
    this.addNotification({
      title: `Nuevo Reporte: ${newInc.title}`,
      body: `${newInc.reporterName} reportó una novedad en "${newInc.location}": ${newInc.description}`,
      type: 'incident_reported',
      incidentId: newInc.id,
    });

    this.notify(false);

    fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInc),
    }).catch((err) => console.error('Error guardando incidente en servidor:', err));

    return newInc;
  }

  public updateIncident(incident: IncidentReport) {
    const list = this.getIncidents();
    const updated = list.map((i) => (i.id === incident.id ? incident : i));
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated));

    if (incident.status === 'resuelto') {
      this.addNotification({
        title: `Novedad Resuelta: ${incident.title}`,
        body: `El incidente reportado en "${incident.location}" fue marcado como resuelto.`,
        type: 'incident_resolved',
        incidentId: incident.id,
      });
    }

    this.notify(false);

    fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
    }).catch((err) => console.error('Error actualizando incidente en servidor:', err));
  }

  public async deleteIncident(incidentId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteIncident(incidentId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getIncidents().filter((i) => i.id !== incidentId);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  public async resetIncidents() {
    await this.hydrateFromAppStateAsync();
  }

  // Fee Collections & Cobranzas
  public getFeeCollections(): FeeCollection[] {
    if (typeof window === 'undefined') return DEFAULT_FEE_COLLECTIONS;
    const raw = localStorage.getItem(FEES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FEE_COLLECTIONS;
  }

  public async saveFeeCollection(collection: FeeCollection): Promise<boolean> {
    const saved = await supabaseService.saveFeeCollection(collection);
    if (!saved) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getFeeCollections();
    const index = list.findIndex((f) => f.id === collection.id);
    let updated: FeeCollection[];
    if (index >= 0) {
      updated = [...list];
      updated[index] = collection;
    } else {
      updated = [collection, ...list];
    }
    localStorage.setItem(FEES_KEY, JSON.stringify(updated));

    // Send push notification
    this.addNotification({
      title: `Nueva Cobranza Emitida: ${collection.concept}`,
      body: `Monto total: $${collection.totalAmount.toLocaleString()} ARS - Vencimiento: ${collection.dueDate}`,
      type: 'system',
    });

    this.notify(false);

    return true;
  }

  public updateOwnerAllocationStatus(
    collectionId: string,
    userId: string,
    update: Partial<OwnerFeeAllocation>
  ): Promise<boolean> {
    const list = this.getFeeCollections();
    const collection = list.find((f) => f.id === collectionId);
    if (!collection) return Promise.resolve(false);

    const updatedAllocations = collection.allocations.map((alloc) => {
      if (alloc.userId === userId) {
        return { ...alloc, ...update };
      }
      return alloc;
    });

    // Check if all allocations are completed
    const allPaid = updatedAllocations.every((a) => a.status === 'paid');
    const updatedCollection: FeeCollection = {
      ...collection,
      allocations: updatedAllocations,
      status: allPaid ? 'completed' : collection.status,
    };

    return this.saveFeeCollection(updatedCollection);
  }

  public async deleteFeeCollection(collectionId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteFeeCollection(collectionId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getFeeCollections().filter((f) => f.id !== collectionId);
    localStorage.setItem(FEES_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  // Notifications
  public getNotifications(): NotificationPush[] {
    if (typeof window === 'undefined') return DEFAULT_NOTIFICATIONS;
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_NOTIFICATIONS;
  }

  public addNotification(notif: Omit<NotificationPush, 'id' | 'timestamp' | 'read'>): NotificationPush {
    const list = this.getNotifications();
    const newNotif: NotificationPush = {
      ...notif,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotif, ...list].slice(0, 50); // Keep last 50
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    return newNotif;
  }

  public markNotificationAsRead(id: string) {
    const list = this.getNotifications();
    const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    this.notify();
  }

  public markAllNotificationsAsRead() {
    const list = this.getNotifications();
    const updated = list.map((n) => ({ ...n, read: true }));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    this.notify();
  }

  // Apply complete dataset pulled from Cloudflare D1
  public applyRemoteD1Data(data: {
    users?: User[];
    bookings?: Booking[];
    blocks?: DateBlock[];
    settings?: TrustSettings;
    notifications?: NotificationPush[];
  }) {
    if (data.users && data.users.length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
    }
    if (data.bookings) {
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(data.bookings));
    }
    if (data.blocks) {
      localStorage.setItem(BLOCKS_KEY, JSON.stringify(data.blocks));
    }
    if (data.settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
      if (data.settings.logoUrl) {
        localStorage.setItem('el_desayuno_custom_logo', data.settings.logoUrl);
      }
    }
    if (data.notifications && data.notifications.length > 0) {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(data.notifications));
    }
    this.notify();
  }

  // Expenses & Operating Costs Management
  public getExpenses(): ExpenseItem[] {
    if (typeof window === 'undefined') return DEFAULT_EXPENSES;
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_EXPENSES;
  }

  public async saveExpense(expense: ExpenseItem): Promise<boolean> {
    const saved = await supabaseService.saveExpense(expense);
    if (!saved) {
      await this.fetchExpensesFromDatabase();
      return false;
    }

    const list = this.getExpenses();
    const index = list.findIndex((e) => e.id === expense.id);
    let updated: ExpenseItem[];
    if (index >= 0) {
      updated = [...list];
      updated[index] = expense;
    } else {
      updated = [expense, ...list];
    }
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated));
    this.notify(false);
    return true;
  }

  public async deleteExpense(expenseId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteExpense(expenseId);
    if (!deleted) {
      await this.fetchExpensesFromDatabase();
      return false;
    }

    const list = this.getExpenses().filter((e) => e.id !== expenseId);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  // Cash Flow & Account Ledger
  public getCashFlows(): CashFlowTransaction[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(CASH_FLOW_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  public async saveCashFlowTransaction(tx: CashFlowTransaction): Promise<boolean> {
    const saved = await supabaseService.saveCashFlowTransaction(tx);
    if (!saved) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getCashFlows();
    const exists = list.some((t) => t.id === tx.id);
    const updated = exists ? list.map((t) => (t.id === tx.id ? tx : t)) : [tx, ...list];
    localStorage.setItem(CASH_FLOW_KEY, JSON.stringify(updated));
    this.notify(false);
    return true;
  }

  public async deleteCashFlowTransaction(txId: string): Promise<boolean> {
    const deleted = await supabaseService.deleteCashFlowTransaction(txId);
    if (!deleted) {
      await this.hydrateFromAppStateAsync();
      return false;
    }
    const list = this.getCashFlows().filter((t) => t.id !== txId);
    localStorage.setItem(CASH_FLOW_KEY, JSON.stringify(list));
    this.notify(false);
    return true;
  }

  public async fetchExpensesFromDatabase(): Promise<ExpenseItem[]> {
    if (typeof window === 'undefined') return this.getExpenses();
    try {
      const result = await supabaseService.pullDataFromSupabase();
      if (result.success && Array.isArray(result.data?.expenses)) {
        const expenses = result.data.expenses as ExpenseItem[];
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
        return expenses;
      }
    } catch (err) {
      console.warn('Error fetching expenses from database:', err);
    }
    return DEFAULT_EXPENSES;
  }

  public async fetchCashFlowFromDatabase(): Promise<CashFlowTransaction[]> {
    if (typeof window === 'undefined') return this.getCashFlows();
    try {
      const result = await supabaseService.pullDataFromSupabase();
      if (result.success && Array.isArray(result.data?.cashFlow)) {
        const cashFlow = result.data.cashFlow as CashFlowTransaction[];
        localStorage.setItem(CASH_FLOW_KEY, JSON.stringify(cashFlow));
        return cashFlow;
      }
    } catch (err) {
      console.warn('Error fetching cash flow from database:', err);
    }
    return [];
  }

  public async fetchFeesFromDatabase(): Promise<FeeCollection[]> {
    if (typeof window === 'undefined') return this.getFeeCollections();
    try {
      const result = await supabaseService.pullDataFromSupabase();
      if (result.success && Array.isArray(result.data?.fees)) {
        const fees = result.data.fees as FeeCollection[];
        localStorage.setItem(FEES_KEY, JSON.stringify(fees));
        return fees;
      }
    } catch (err) {
      console.warn('Error fetching fees from database:', err);
    }
    return DEFAULT_FEE_COLLECTIONS;
  }

  // Get complete package of local data for D1 push & backup
  public getAllDataPackage() {
    return {
      users: this.getUsers(),
      bookings: this.getBookings(),
      blocks: this.getBlocks(),
      settings: this.getSettings(),
      rules: this.getRules(),
      contacts: this.getContacts(),
      documents: this.getDocuments(),
      inventory: this.getInventory(),
      incidents: this.getIncidents(),
      notifications: this.getNotifications(),
      fees: this.getFeeCollections(),
      expenses: this.getExpenses(),
      exportedAt: new Date().toISOString(),
      version: '2.0-eldesayuno',
    };
  }

  public exportBackupJSON(): string {
    const pkg = this.getAllDataPackage();
    return JSON.stringify(pkg, null, 2);
  }

  public importBackupJSON(jsonStr: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.users)) localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
      if (Array.isArray(data.bookings)) localStorage.setItem(BOOKINGS_KEY, JSON.stringify(data.bookings));
      if (Array.isArray(data.blocks)) localStorage.setItem(BLOCKS_KEY, JSON.stringify(data.blocks));
      if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
      if (Array.isArray(data.rules)) localStorage.setItem(RULES_KEY, JSON.stringify(data.rules));
      if (Array.isArray(data.contacts)) localStorage.setItem(CONTACTS_KEY, JSON.stringify(data.contacts));
      if (Array.isArray(data.documents)) localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(data.documents));
      if (Array.isArray(data.inventory)) localStorage.setItem(INVENTORY_KEY, JSON.stringify(data.inventory));
      if (Array.isArray(data.incidents)) localStorage.setItem(INCIDENTS_KEY, JSON.stringify(data.incidents));
      if (Array.isArray(data.notifications)) localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(data.notifications));
      if (Array.isArray(data.fees)) localStorage.setItem(FEES_KEY, JSON.stringify(data.fees));
      if (Array.isArray(data.expenses)) localStorage.setItem(EXPENSES_KEY, JSON.stringify(data.expenses));

      this.notify();
      return { success: true, message: 'Copia de respaldo restaurada exitosamente.' };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'El archivo JSON de respaldo no es válido.',
      };
    }
  }

  // Reset to default data if needed
  public resetToDefault() {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(DEFAULT_BOOKINGS));
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(DEFAULT_BLOCKS));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(DEFAULT_INVENTORY));
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(DEFAULT_INCIDENTS));
    localStorage.setItem(FEES_KEY, JSON.stringify(DEFAULT_FEE_COLLECTIONS));
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(DEFAULT_EXPENSES));
    const recalculated = recalculateUsersUsedDays(DEFAULT_USERS, DEFAULT_BOOKINGS);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));
    this.notify();
  }

  public getExpenseCategories(): CustomCategory[] {
    const s = this.getSettings();
    return Array.isArray(s.expenseCategories) ? s.expenseCategories : DEFAULT_EXPENSE_CATEGORIES;
  }
  public saveExpenseCategories(cats: CustomCategory[]) {
    const s = this.getSettings();
    s.expenseCategories = cats;
    s.updatedAt = new Date().toISOString();
    this.saveSettings(s);
  }
  public getCashFlowCategories(): CustomCategory[] {
    const s = this.getSettings();
    return Array.isArray(s.cashFlowCategories) ? s.cashFlowCategories : DEFAULT_CASHFLOW_CATEGORIES;
  }
  public saveCashFlowCategories(cats: CustomCategory[]) {
    const s = this.getSettings();
    s.cashFlowCategories = cats;
    s.updatedAt = new Date().toISOString();
    this.saveSettings(s);
  }
  public getFeeCategories(): CustomCategory[] {
    const s = this.getSettings();
    return Array.isArray(s.feeCategories) ? s.feeCategories : DEFAULT_FEE_CATEGORIES;
  }
  public saveFeeCategories(cats: CustomCategory[]) {
    const s = this.getSettings();
    s.feeCategories = cats;
    s.updatedAt = new Date().toISOString();
    this.saveSettings(s);
  }
  public getInventoryCategories(): CustomCategory[] {
    const s = this.getSettings();
    return Array.isArray(s.inventoryCategories) ? s.inventoryCategories : DEFAULT_INVENTORY_CATEGORIES;
  }
  public saveInventoryCategories(cats: CustomCategory[]) {
    const s = this.getSettings();
    s.inventoryCategories = cats;
    s.updatedAt = new Date().toISOString();
    this.saveSettings(s);
  }
}

export const storageService = new StorageService();
