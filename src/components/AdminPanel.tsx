import React, { useState, useEffect } from 'react';
import { User, UserRole, Booking, DateBlock, TrustSettings, isUserIntendente } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import { pushService } from '../services/notificationService';
import { d1Service, D1Config, D1_SCHEMA_SQL } from '../services/d1Service';
import { BrandLogo } from './BrandLogo';
import { PasswordManagementModal } from './PasswordManagementModal';
import { TransferAdminModal } from './TransferAdminModal';
import { UserFormModal } from './UserFormModal';
import { UserRoleBadge } from './UserRoleBadge';
import {
  Users,
  Calendar,
  Lock,
  Download,
  Printer,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Sparkles,
  Sliders,
  FileSpreadsheet,
  Search,
  Filter,
  XCircle,
  Database,
  Cloud,
  Server,
  Terminal,
  RefreshCw,
  Image as ImageIcon,
  Check,
  ExternalLink,
  ShieldCheck,
  Upload,
  KeyRound,
  Shield,
  ShieldAlert,
  Copy,
  CheckCheck,
  CreditCard,
  Building,
  Eye,
  EyeOff,
} from 'lucide-react';

export type AdminSectionType =
  | 'owners'
  | 'blocks'
  | 'reservations'
  | 'settings'
  | 'd1'
  | 'logo';

interface AdminPanelProps {
  currentUser: User;
  users: User[];
  bookings: Booking[];
  blocks: DateBlock[];
  settings: TrustSettings;
  activeSection: AdminSectionType;
  onNavigateSection: (sec: AdminSectionType) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  users,
  bookings,
  blocks,
  settings,
  activeSection,
  onNavigateSection,
}) => {
  // --- Section 1: User / Owner Management State ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [isTransferAdminOpen, setIsTransferAdminOpen] = useState(false);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [copiedAllSuccess, setCopiedAllSuccess] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  // Protección también para esta vista histórica: las claves de terceros las ve solo el intendente.
  const canViewAccountPasswords = isUserIntendente(currentUser);

  const handleCopyAllCredentials = () => {
    if (!canViewAccountPasswords) return;
    const lines = [
      '=====================================================',
      'ESTANCIA EL DESAYUNO - PADRÓN DE COPROPIETARIOS Y ACCESOS',
      '=====================================================',
      '',
    ];

    users.forEach((u, idx) => {
      lines.push(`${idx + 1}. ${u.name}`);
      lines.push(`   • Usuario: ${u.username || u.email.split('@')[0]}`);
      lines.push(`   • Contraseña: ${u.password || '******'}`);
      lines.push(`   • Parte: ${u.partName}`);
      lines.push(`   • Rol: ${u.role === 'admin' ? 'Administrador' : 'Copropietario'}`);
      lines.push('');
    });

    lines.push('=====================================================');

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedAllSuccess(true);
    setTimeout(() => setCopiedAllSuccess(false), 3000);
  };
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    partName: 'Cabeza 1',
    annualQuotaDays: 30,
    color: '#DC2626',
    password: '',
  });

  // --- Section 2: Date Blocks State ---
  const [isNewBlockModalOpen, setIsNewBlockModalOpen] = useState(false);
  const [blockFormData, setBlockFormData] = useState({
    startDate: '',
    endDate: '',
    title: '',
    reason: 'maintenance' as DateBlock['reason'],
    notes: '',
  });

  // --- Section 3: Consolidated Bookings Filters ---
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Section 4: Settings State ---
  const [settingsFormData, setSettingsFormData] = useState<TrustSettings>(settings);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  useEffect(() => {
    setSettingsFormData(settings);
  }, [settings]);

  // Cancellation Modal for Admin
  const [adminCancelBookingId, setAdminCancelBookingId] = useState<string | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState('');

  // --- Section 5: Logo Management State ---
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>(
    settings.logoUrl || (typeof window !== 'undefined' ? localStorage.getItem('el_desayuno_custom_logo') || '' : '')
  );
  const [logoInputUrl, setLogoInputUrl] = useState<string>(currentLogoUrl);
  const [logoSavedSuccess, setLogoSavedSuccess] = useState(false);

  // --- Section 6: Cloudflare D1 Management State ---
  const [d1ConfigForm, setD1ConfigForm] = useState<D1Config>(d1Service.getConfig());
  const [d1StatusMessage, setD1StatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [d1Loading, setD1Loading] = useState(false);
  const [d1Latency, setD1Latency] = useState<number | null>(null);
  const [sqlConsoleQuery, setSqlConsoleQuery] = useState('SELECT id, name, email, role, part_name, used_days FROM users;');
  const [sqlConsoleResults, setSqlConsoleResults] = useState<Record<string, unknown>[] | null>(null);
  const [sqlConsoleError, setSqlConsoleError] = useState<string | null>(null);

  useEffect(() => {
    setD1ConfigForm(d1Service.getConfig());
    setSettingsFormData(settings);
  }, [activeSection, settings]);

  // Handle User Edit / Save
  const handleSaveUserFromModal = async (userData: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    partName: string;
    cabezaNumber?: number;
    annualQuotaDays: number;
    sharePercentage?: number;
    color: string;
    password?: string;
    role?: UserRole;
    isCabezaDeEquipo?: boolean;
    isFiduciante?: boolean;
  }): Promise<boolean> => {
    let saved = false;
    if (userData.id) {
      const existing = users.find((u) => u.id === userData.id);
      if (existing) {
        saved = await storageService.saveUser({
          ...existing,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          partName: userData.partName,
          cabezaNumber: userData.cabezaNumber,
          annualQuotaDays: userData.annualQuotaDays,
          sharePercentage: typeof userData.sharePercentage === 'number' ? userData.sharePercentage : (existing.sharePercentage ?? 6.25),
          color: userData.color,
          password: userData.password || existing.password,
          role: userData.role || existing.role,
          isCabezaDeEquipo: userData.isCabezaDeEquipo !== undefined ? userData.isCabezaDeEquipo : existing.isCabezaDeEquipo,
          isFiduciante: userData.isFiduciante !== undefined ? userData.isFiduciante : existing.isFiduciante,
        });
      }
    } else {
      const newUser: User = {
        id: 'user-' + Date.now(),
        name: userData.name,
        username: userData.email.split('@')[0],
        email: userData.email,
        phone: userData.phone,
        partName: userData.partName,
        cabezaNumber: typeof userData.cabezaNumber === 'number' ? userData.cabezaNumber : 0,
        role: userData.role || 'owner',
        isCabezaDeEquipo: Boolean(userData.isCabezaDeEquipo),
        isFiduciante: Boolean(userData.isFiduciante),
        annualQuotaDays: typeof userData.annualQuotaDays === 'number' ? userData.annualQuotaDays : 30,
        sharePercentage: typeof userData.sharePercentage === 'number' ? userData.sharePercentage : 0,
        usedDays: 0,
        pendingDays: 0,
        color: userData.color,
        avatarInitials: userData.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        password: userData.password,
        active: true,
        createdAt: new Date().toISOString().split('T')[0],
      };
      saved = await storageService.saveUser(newUser);
    }
    if (!saved) return false;
    setEditingUser(null);
    setIsNewUserModalOpen(false);
    return true;
  };

  const handleToggleUserActive = async (user: User) => {
    if (user.id === currentUser.id) {
      alert('No puede desactivar su propio usuario administrador.');
      return;
    }
    const saved = await storageService.saveUser({
      ...user,
      active: !user.active,
    });
    if (!saved) alert('La base de datos no confirmó el cambio de estado.');
  };

  const handleDeleteUserConfirm = (user: User) => {
    if (user.id === currentUser.id) {
      alert('No puede eliminar su propio usuario administrador.');
      return;
    }
    if (window.confirm(`¿Está seguro de que desea eliminar a "${user.name}"? Esta acción eliminará al copropietario del sistema y de Supabase.`)) {
      storageService.deleteUser(user.id);
    }
  };

  // Handle Date Block Save
  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockFormData.startDate || !blockFormData.endDate || blockFormData.endDate < blockFormData.startDate) {
      alert('Las fechas de bloqueo no son válidas.');
      return;
    }

    const s = new Date(blockFormData.startDate + 'T00:00:00');
    const end = new Date(blockFormData.endDate + 'T00:00:00');
    const days = Math.round((end.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    storageService.createBlock({
      startDate: blockFormData.startDate,
      endDate: blockFormData.endDate,
      totalDays: days,
      reason: blockFormData.reason,
      title: blockFormData.title,
      notes: blockFormData.notes || undefined,
      createdBy: `${currentUser.name} (Administrador)`,
    });

    setIsNewBlockModalOpen(false);
    setBlockFormData({
      startDate: '',
      endDate: '',
      title: '',
      reason: 'maintenance',
      notes: '',
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (confirm('¿Está seguro de desbloquear estas fechas?')) {
      storageService.deleteBlock(blockId);
    }
  };

  // Handle Admin Cancel Booking
  const handleAdminCancelBooking = () => {
    if (!adminCancelBookingId) return;
    storageService.cancelBooking(
      adminCancelBookingId,
      adminCancelReason || 'Cancelación de oficio por Administración Fiduciaria',
      `${currentUser.name} (Admin)`
    );
    setAdminCancelBookingId(null);
    setAdminCancelReason('');
  };

  // Handle Admin Approve Booking
  const handleAdminApproveBooking = (bookingId: string) => {
    storageService.approveBooking(bookingId, `${currentUser.name} (Admin)`);
  };

  // Pending bookings count & list
  const pendingBookings = bookings.filter((b) => b.status === 'pending');

  // Filtered Bookings for consolidated list
  const filteredBookings = bookings.filter((b) => {
    if (filterOwner !== 'all' && b.userId !== filterOwner) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        b.userName.toLowerCase().includes(q) ||
        b.partName.toLowerCase().includes(q) ||
        b.checkInDate.includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Export Bookings to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Reserva',
      'Copropietario',
      'Parte Indivisa',
      'Check-in',
      'Check-out',
      'Días Totales',
      'Huéspedes',
      'Estado',
      'Sanitización Buffer',
      'Fecha Creación',
      'Observaciones',
    ];

    const rows = filteredBookings.map((b) => [
      b.id,
      `"${b.userName}"`,
      `"${b.partName}"`,
      b.checkInDate,
      b.checkOutDate,
      b.totalDays,
      b.guestsCount,
      b.status,
      b.cleaningBufferApplied ? 'Sí (24h)' : 'No',
      b.createdAt.split('T')[0],
      `"${(b.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `reporte_ocupacion_el_desayuno_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await storageService.saveSettingsAsync(settingsFormData);
    setSettingsSavedMessage(true);
    setTimeout(() => setSettingsSavedMessage(false), 3000);
  };

  // -------------------------------------------------------------
  // LOGO MANAGEMENT HANDLERS
  // -------------------------------------------------------------
  const handleFileUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) {
          // Upload to Cloudflare R2 bucket el-desayuno for global availability
          const r2Res = await r2Service.uploadPhoto(base64, `logo_${Date.now()}`, 'logo');
          const finalUrl = r2Res.success && r2Res.url ? r2Res.url : base64;
          localStorage.setItem('el_desayuno_custom_logo', finalUrl);
          setCurrentLogoUrl(finalUrl);
          setLogoInputUrl(finalUrl);
          // Save in shared settings
          storageService.saveSettings({
            ...settings,
            logoUrl: finalUrl,
          });
          setLogoSavedSuccess(true);
          setTimeout(() => setLogoSavedSuccess(false), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoInputUrl.trim()) {
      localStorage.removeItem('el_desayuno_custom_logo');
      setCurrentLogoUrl('');
      storageService.saveSettings({
        ...settings,
        logoUrl: '',
      });
    } else {
      localStorage.setItem('el_desayuno_custom_logo', logoInputUrl.trim());
      setCurrentLogoUrl(logoInputUrl.trim());
      storageService.saveSettings({
        ...settings,
        logoUrl: logoInputUrl.trim(),
      });
    }
    setLogoSavedSuccess(true);
    setTimeout(() => setLogoSavedSuccess(false), 3000);
  };

  const handleResetToDefaultLogo = () => {
    localStorage.removeItem('el_desayuno_custom_logo');
    setCurrentLogoUrl('');
    setLogoInputUrl('');
    storageService.saveSettings({
      ...settings,
      logoUrl: '',
    });
    setLogoSavedSuccess(true);
    setTimeout(() => setLogoSavedSuccess(false), 3000);
  };

  // -------------------------------------------------------------
  // CLOUDFLARE D1 MANAGEMENT HANDLERS
  // -------------------------------------------------------------
  const handleTestD1Connection = async () => {
    setD1Loading(true);
    setD1StatusMessage(null);
    const res = await d1Service.testConnection(d1ConfigForm);
    setD1Loading(false);
    if (res.success) {
      setD1Latency(res.latencyMs || 0);
      setD1StatusMessage({
        type: 'success',
        text: res.message,
      });
    } else {
      setD1StatusMessage({
        type: 'error',
        text: res.message,
      });
    }
  };

  const handleSaveD1Config = (e: React.FormEvent) => {
    e.preventDefault();
    d1Service.saveConfig(d1ConfigForm);
    setD1StatusMessage({
      type: 'success',
      text: 'Credenciales de Cloudflare D1 guardadas.',
    });
  };

  const handleInitD1Schema = async () => {
    if (!confirm('¿Crear o verificar las tablas en Cloudflare D1 (users, bookings, date_blocks, trust_settings)?')) {
      return;
    }
    setD1Loading(true);
    const res = await d1Service.initializeSchema();
    setD1Loading(false);
    setD1StatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  const handlePushDataToD1 = async () => {
    if (!confirm('¿Desea migrar todos los datos actuales del sistema hacia Cloudflare D1?')) {
      return;
    }
    setD1Loading(true);
    const payload = storageService.getAllDataPackage();
    const res = await d1Service.pushLocalDataToD1(payload);
    setD1Loading(false);
    setD1StatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  const handlePullDataFromD1 = async () => {
    if (!confirm('¿Descargar y sincronizar datos desde Cloudflare D1? Se actualizará el estado de la aplicación.')) {
      return;
    }
    setD1Loading(true);
    const res = await d1Service.pullDataFromD1();
    setD1Loading(false);
    if (res.success && res.data) {
      storageService.applyRemoteD1Data(res.data);
      setD1StatusMessage({
        type: 'success',
        text: 'Datos sincronizados exitosamente desde Cloudflare D1.',
      });
    } else {
      setD1StatusMessage({
        type: 'error',
        text: res.error || 'Error al obtener datos de Cloudflare D1.',
      });
    }
  };

  const handleExecuteConsoleSQL = async () => {
    if (!sqlConsoleQuery.trim()) return;
    setD1Loading(true);
    setSqlConsoleError(null);
    setSqlConsoleResults(null);
    const res = await d1Service.executeQuery(sqlConsoleQuery);
    setD1Loading(false);
    if (res.success) {
      setSqlConsoleResults(res.results);
    } else {
      setSqlConsoleError(res.error || 'Error ejecutando query SQL.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Section Title Header */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#163323] flex items-center gap-2">
            {activeSection === 'reservations' && (
              <>
                <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
                <span>Consolidado General de Reservas</span>
              </>
            )}
            {activeSection === 'blocks' && (
              <>
                <Lock className="w-4 h-4 text-amber-800" />
                <span>Bloqueos Administrativos de Mantenimiento</span>
              </>
            )}
            {activeSection === 'owners' && (
              <>
                <Users className="w-4 h-4 text-[#1B3B2B]" />
                <span>Padrón de Copropietarios</span>
              </>
            )}
            {activeSection === 'logo' && (
              <>
                <ImageIcon className="w-4 h-4 text-[#BFA270]" />
                <span>Identidad Institucional e Isologotipo</span>
              </>
            )}
            {activeSection === 'd1' && (
              <>
                <Database className="w-4 h-4 text-[#BFA270]" />
                <span>Base de Datos Cloudflare D1</span>
              </>
            )}
            {activeSection === 'settings' && (
              <>
                <Sliders className="w-4 h-4 text-[#1B3B2B]" />
                <span>Parámetros de Configuración</span>
              </>
            )}
          </h2>
          <p className="text-xs text-[#637568] mt-0.5">
            {activeSection === 'reservations' && 'Planilla, filtros y reporte oficial de ocupación.'}
            {activeSection === 'blocks' && 'Períodos bloqueados para reparaciones y mantenimiento de la estancia.'}
            {activeSection === 'owners' && 'Gestión de usuarios y credenciales del fideicomiso.'}
            {activeSection === 'logo' && 'Logotipo y branding oficial.'}
            {activeSection === 'd1' && 'Conexión y sincronización con Cloudflare D1.'}
            {activeSection === 'settings' && 'Ajustes del fideicomiso.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'owners' && (
            <button
              onClick={() => {
                setEditingUser(null);
                setUserFormData({
                  name: '',
                  email: '',
                  phone: '',
                  partName: 'Cabeza 1',
                  annualQuotaDays: 30,
                  color: '#DC2626',
                  password: '',
                });
                setIsNewUserModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Alta Propietario</span>
            </button>
          )}

          {activeSection === 'blocks' && (
            <button
              onClick={() => setIsNewBlockModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Nuevo Bloqueo</span>
            </button>
          )}

          {activeSection === 'reservations' && (
            <>
              {canViewAccountPasswords && <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-800" />
                <span>Exportar CSV</span>
              </button>}
              <button
                onClick={handlePrintReport}
                className="px-3 py-1.5 bg-[#F6F2E8] hover:bg-[#EDE6D7] border border-[#DDD5BF] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. GESTIÓN DE IDENTIDAD Y LOGO                            */}
      {/* ========================================================= */}
      {activeSection === 'logo' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#A68853]">
                Imagen Institucional
              </span>
              <h3 className="text-base font-bold text-[#163323] mt-0.5">
                Configuración del Isologotipo de El Desayuno
              </h3>
              <p className="text-xs text-[#7A8E7E]">
                Cargue una imagen personalizada o ingrese un enlace directo para actualizar el logo en la portada, panel y reportes.
              </p>
            </div>
          </div>

          {logoSavedSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Logo actualizado correctamente en la aplicación.</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Logo Preview Column (5 cols) */}
            <div className="lg:col-span-5 bg-[#FAF8F5] border border-[#E6E0CF] p-6 flex flex-col items-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#163323] mb-4">
                Vista Previa del Emblema
              </span>

              <div className="p-4 bg-white border border-[#E0D9C5] shadow-xs flex items-center justify-center">
                <BrandLogo size="2xl" variant="seal-only" logoUrl={currentLogoUrl || undefined} />
              </div>

              <div className="mt-4 text-center">
                <span className="font-serif font-bold text-lg tracking-wider text-[#163323] block">
                  EL DESAYUNO
                </span>
                <span className="text-[10px] tracking-[0.25em] text-[#A68853] uppercase font-semibold">
                  S O C I E D A D
                </span>
                <span className="text-[9px] text-[#637568] block mt-0.5">
                  Cuatro Partes, Un Mismo Objetivo
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-[#EAE3D3] w-full flex items-center justify-around text-xs text-[#7A8E7E]">
                <span>Header (44px)</span>
                <span>·</span>
                <span>Login (190px)</span>
                <span>·</span>
                <span>Reportes</span>
              </div>
            </div>

            {/* Controls Column (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Option 1: File Upload */}
              <div className="p-5 bg-white border border-[#E3DFC8]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#BFA270]" />
                  <span>Opción 1: Cargar Archivo de Imagen desde su Equipo</span>
                </h4>
                <p className="text-xs text-[#526657] mt-1 leading-relaxed">
                  Seleccione su archivo PNG, JPG o SVG. Se guardará de manera permanente en la base de datos y memoria de la plataforma.
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <label className="px-4 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer flex items-center gap-2 transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>Seleccionar Archivo de Imagen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadLogo}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Option 2: Image URL */}
              <div className="p-5 bg-white border border-[#E3DFC8]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#BFA270]" />
                  <span>Opción 2: URL Externa Directa (CDN / Cloudflare R2)</span>
                </h4>
                <p className="text-xs text-[#526657] mt-1 leading-relaxed">
                  Ingrese el enlace directo a la imagen alojada en un bucket o servidor web.
                </p>

                <form onSubmit={handleSaveLogoUrl} className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={logoInputUrl}
                      onChange={(e) => setLogoInputUrl(e.target.value)}
                      placeholder="https://ejemplo.com/logo-el-desayuno.png"
                      className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs font-mono focus:outline-none focus:border-[#1E3F20]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#F4EFE6] hover:bg-[#EDE6D8] border border-[#DCD4C0] text-[#163323] text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      Guardar URL
                    </button>
                  </div>
                </form>
              </div>

              {/* Reset Option */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E6E0CF] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#163323] block">
                    Restablecer al Emblema Heráldico Original
                  </span>
                  <span className="text-[11px] text-[#7A8E7E]">
                    Vuelve a la ilustración vectorial predeterminada.
                  </span>
                </div>
                <button
                  onClick={handleResetToDefaultLogo}
                  className="px-3.5 py-1.5 bg-white hover:bg-red-50 border border-[#DDD5BF] hover:border-red-300 text-xs font-semibold text-[#163323] hover:text-red-700 transition-colors cursor-pointer"
                >
                  Restablecer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. BASE DE DATOS CLOUDFLARE D1                            */}
      {/* ========================================================= */}
      {activeSection === 'd1' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs space-y-6">
          {/* Header & Status Banner */}
          <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#1B3B2B]" />
                <h3 className="text-base font-bold text-[#163323]">
                  Conexión con Base de Datos Cloudflare D1
                </h3>
              </div>
              <p className="text-xs text-[#7A8E7E] mt-0.5">
                Base de datos relacional serverless SQLite para persistencia y auditoría del Fideicomiso.
              </p>
            </div>

            {/* Connection Status Pill */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border ${
                  d1Service.isConnected()
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    d1Service.isConnected() ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>
                  {d1Service.isConnected()
                    ? `D1 Enlazado ${d1Latency ? `(${d1Latency}ms)` : ''}`
                    : 'Modo Local (Sin enlace D1)'}
                </span>
              </span>
            </div>
          </div>

          {/* Status Alert if any */}
          {d1StatusMessage && (
            <div
              className={`p-4 text-xs border flex items-start gap-2.5 ${
                d1StatusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {d1StatusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{d1StatusMessage.text}</span>
            </div>
          )}

          {/* D1 Configuration Form */}
          <div className="p-5 bg-[#FAF8F5] border border-[#E6E0CF]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] mb-3 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#BFA270]" />
              <span>Credenciales de Cloudflare API</span>
            </h4>

            <form onSubmit={handleSaveD1Config} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Cloudflare Account ID
                  </label>
                  <input
                    type="text"
                    value={d1ConfigForm.accountId}
                    onChange={(e) =>
                      setD1ConfigForm({ ...d1ConfigForm, accountId: e.target.value.trim() })
                    }
                    placeholder="ej. 8f2a1c9e4b3d7a6f..."
                    className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none focus:border-[#1E3F20]"
                  />
                  <span className="text-[10px] text-[#7A8E7E] block mt-0.5">
                    Visible en la barra lateral del panel de Cloudflare.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    D1 Database ID (UUID)
                  </label>
                  <input
                    type="text"
                    value={d1ConfigForm.databaseId}
                    onChange={(e) =>
                      setD1ConfigForm({ ...d1ConfigForm, databaseId: e.target.value.trim() })
                    }
                    placeholder="ej. 550e8400-e29b-41d4-a716-..."
                    className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none focus:border-[#1E3F20]"
                  />
                  <span className="text-[10px] text-[#7A8E7E] block mt-0.5">
                    UUID de la base creada en Cloudflare D1.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    API Token (Permiso D1 Edit)
                  </label>
                  <input
                    type="password"
                    value={d1ConfigForm.apiToken}
                    onChange={(e) =>
                      setD1ConfigForm({ ...d1ConfigForm, apiToken: e.target.value.trim() })
                    }
                    placeholder="••••••••••••••••••••••••"
                    className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none focus:border-[#1E3F20]"
                  />
                  <span className="text-[10px] text-[#7A8E7E] block mt-0.5">
                    Token creado en Cloudflare con acceso a D1.
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EAE3D3] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestD1Connection}
                    disabled={d1Loading}
                    className="px-4 py-2 bg-[#F4EFE6] hover:bg-[#EDE6D8] border border-[#DCD4C0] text-[#163323] font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {d1Loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-[#1B3B2B]" />}
                    <span>Probar Conexión</span>
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Guardar Credenciales
                  </button>
                </div>

                {d1ConfigForm.lastConnectedAt && (
                  <span className="text-[11px] text-[#7A8E7E]">
                    Último enlace exitoso:{' '}
                    {new Date(d1ConfigForm.lastConnectedAt).toLocaleString('es-AR')}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Database Operations & Migrations */}
          <div className="p-5 bg-white border border-[#E3DFC8]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-[#BFA270]" />
              <span>Acciones de Esquema y Sincronización</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#FAF8F5] border border-[#E4DEC9] flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-xs text-[#163323]">1. Inicializar Tablas en D1</h5>
                  <p className="text-[11px] text-[#637568] mt-1 leading-snug">
                    Ejecuta las sentencias SQL DDL para crear las tablas <code>users</code>, <code>bookings</code>, <code>date_blocks</code> y <code>trust_settings</code>.
                  </p>
                </div>
                <button
                  onClick={handleInitD1Schema}
                  disabled={d1Loading}
                  className="mt-4 w-full py-2 bg-white hover:bg-[#FAF8F5] border border-[#D5CDBC] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Crear / Verificar Tablas</span>
                </button>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E4DEC9] flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-xs text-[#163323]">2. Subir Datos Locales a D1</h5>
                  <p className="text-[11px] text-[#637568] mt-1 leading-snug">
                    Migra todos los socios, turnos y bloqueos cargados en la aplicación hacia las tablas de Cloudflare D1.
                  </p>
                </div>
                <button
                  onClick={handlePushDataToD1}
                  disabled={d1Loading}
                  className="mt-4 w-full py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Migrar a Cloudflare D1</span>
                </button>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E4DEC9] flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-xs text-[#163323]">3. Descargar Datos desde D1</h5>
                  <p className="text-[11px] text-[#637568] mt-1 leading-snug">
                    Consulta Cloudflare D1 y refresca el estado local de todos los turnos, cupos y parámetros.
                  </p>
                </div>
                <button
                  onClick={handlePullDataFromD1}
                  disabled={d1Loading}
                  className="mt-4 w-full py-2 bg-white hover:bg-[#FAF8F5] border border-[#D5CDBC] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#1B3B2B]" />
                  <span>Sincronizar desde D1</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive SQL Console */}
          <div className="p-5 bg-white border border-[#E3DFC8]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#BFA270]" />
                <span>Consola de Consultas SQL D1</span>
              </h4>
              <span className="text-[10px] text-[#7A8E7E]">SQLite 3 / Cloudflare Edge</span>
            </div>
            <p className="text-xs text-[#637568] mb-3">
              Ejecute consultas directas para auditar o consultar los registros de la estancia en Cloudflare D1.
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <textarea
                  value={sqlConsoleQuery}
                  onChange={(e) => setSqlConsoleQuery(e.target.value)}
                  rows={2}
                  className="flex-1 p-2.5 bg-[#19231A] text-[#E0EBDD] font-mono text-xs focus:outline-none border border-[#2D3F2F]"
                />
                <button
                  onClick={handleExecuteConsoleSQL}
                  disabled={d1Loading}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer self-stretch flex items-center justify-center"
                >
                  {d1Loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Ejecutar'}
                </button>
              </div>

              {sqlConsoleError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-mono">
                  Error: {sqlConsoleError}
                </div>
              )}

              {sqlConsoleResults && (
                <div className="p-3 bg-[#FAF8F5] border border-[#E6E0CF] overflow-x-auto max-h-60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#637568] block mb-2">
                    Resultados ({sqlConsoleResults.length} filas retornadas):
                  </span>
                  {sqlConsoleResults.length === 0 ? (
                    <p className="text-xs text-[#7A8E7E] italic">Consulta ejecutada sin filas devueltas.</p>
                  ) : (
                    <table className="w-full text-xs text-left font-mono">
                      <thead className="bg-[#EFEAE0] text-[#19231A]">
                        <tr>
                          {Object.keys(sqlConsoleResults[0]).map((col) => (
                            <th key={col} className="p-1.5 border border-[#D5CDBC]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlConsoleResults.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-white">
                            {Object.values(row).map((val, cIdx) => (
                              <td key={cIdx} className="p-1.5 border border-[#E8E2D2] text-[11px]">
                                {val === null ? 'NULL' : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. GESTIÓN DE COPROPIETARIOS / BENEFICIARIOS              */}
      {/* ========================================================= */}
      {activeSection === 'owners' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs space-y-4">
          <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1B3B2B]" />
                <span>Padrón de Copropietarios & Gestión de Accesos</span>
              </h3>
              <p className="text-xs text-[#7A8E7E] mt-0.5">
                Directorio de beneficiarios, contraseñas de acceso y administración de poderes fiduciarios.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canViewAccountPasswords && <button
                type="button"
                onClick={handleCopyAllCredentials}
                className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Copiar lista completa de usuarios, accesos y contraseñas al portapapeles"
              >
                {copiedAllSuccess ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>¡Copiado al Portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>Copiar Usuarios y Contraseñas</span>
                  </>
                )}
              </button>}

              <button
                onClick={() => setIsTransferAdminOpen(true)}
                className="px-3.5 py-1.5 bg-[#F4EFE6] hover:bg-[#EDE6D8] border border-[#D5CDBC] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                title="Ceder el poder de Administrador General a otro socio"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                <span>Transferir Administración</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Copropietario</th>
                  <th className="py-3 px-3">Figura / Rol</th>
                  <th className="py-3 px-3">Cabeza / Grupo</th>
                  <th className="py-3 px-3 text-center">Cupo Anual</th>
                  <th className="py-3 px-3 text-center">% Acciones</th>
                  <th className="py-3 px-3">Contraseña de Acceso</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {users.map((u) => {
                  const isIndependent = !u.cabezaNumber || u.cabezaNumber === 0 || (u.partName && (u.partName.toLowerCase().includes('sin') || u.partName.toLowerCase().includes('independiente')));
                  return (
                    <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: u.color }}
                          >
                            {u.avatarInitials}
                          </div>
                          <div>
                            <span className="font-semibold text-[#163323] block leading-tight">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-[#7A8E7E] block font-mono">
                              {u.username || u.email.split('@')[0]}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <UserRoleBadge user={u} size="sm" showAll={true} />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: u.color }}
                          />
                          {isIndependent ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-2xs text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              ○ Sin Grupo (Cabeza 0)
                            </span>
                          ) : (
                            <span className="font-semibold text-xs text-[#163323]">
                              {u.partName || `Cabeza ${u.cabezaNumber}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323]">
                          {typeof u.annualQuotaDays === 'number' ? `${u.annualQuotaDays} d` : `${u.annualQuotaDays || 0} d`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-xs text-[#163323]">
                          {Number(u.sharePercentage || 0).toFixed(4)}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs tracking-wider bg-[#F4EFE6] px-2 py-0.5 border border-[#DCD4C0] text-[#163323]">
                            {canViewAccountPasswords && revealedPasswords[u.id] ? (u.password || '******') : '••••••'}
                          </span>
                          {canViewAccountPasswords && <>
                          <button
                            type="button"
                            onClick={() => setRevealedPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                            className="p-1 hover:bg-[#EDE6D7] text-[#637568] hover:text-[#163323] transition-colors cursor-pointer"
                            title={revealedPasswords[u.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {revealedPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (u.password) {
                                navigator.clipboard.writeText(u.password);
                                setCopiedPasswordId(u.id);
                                setTimeout(() => setCopiedPasswordId(null), 2000);
                              }
                            }}
                            className="p-1 hover:bg-[#EDE6D7] text-[#637568] hover:text-[#163323] transition-colors cursor-pointer"
                            title="Copiar contraseña"
                          >
                            {copiedPasswordId === u.id ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPasswordModalUser(u)}
                            className="text-[10px] text-[#1B3B2B] hover:underline font-semibold cursor-pointer"
                            title="Modificar contraseña"
                          >
                            Editar
                          </button>
                          </>}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                            u.active ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {u.active ? 'Habilitado' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canViewAccountPasswords && <button
                            onClick={() => setPasswordModalUser(u)}
                            className="p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
                            title="Cambiar Contraseña"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#BFA270]" />
                          </button>}
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setUserFormData({
                                name: u.name,
                                email: u.email,
                                phone: u.phone,
                                partName: u.partName,
                                annualQuotaDays: u.annualQuotaDays,
                                color: u.color,
                                password: u.password || '',
                              });
                            }}
                            className="p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
                            title="Modificar datos"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u.role !== 'admin' && (
                            <>
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`p-1 text-[10px] font-semibold cursor-pointer ${
                                  u.active
                                    ? 'text-amber-700 hover:text-amber-900'
                                    : 'text-emerald-700 hover:text-emerald-900'
                                }`}
                                title={u.active ? 'Desactivar acceso' : 'Habilitar acceso'}
                              >
                                {u.active ? 'Deshabilitar' : 'Activar'}
                              </button>
                              <button
                                onClick={() => handleDeleteUserConfirm(u)}
                                className="p-1 text-red-600 hover:text-red-800 cursor-pointer"
                                title="Eliminar copropietario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CONSOLIDADO DE TODAS LAS RESERVAS                      */}
      {/* ========================================================= */}
      {activeSection === 'reservations' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0]">
            <h3 className="text-base font-bold text-[#163323]">
              Planilla Consolidada de Ocupación Anual
            </h3>
            <p className="text-xs text-[#7A8E7E]">
              Listado auditable de todas las reservas de los 4 propietarios para el año 2026.
            </p>
          </div>

          {/* Pending Bookings Approval Banner */}
          {pendingBookings.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50/80 border border-amber-300 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h4 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                    Solicitudes de Reserva Pendientes de Aprobación ({pendingBookings.length})
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 uppercase tracking-wider">
                  Acción Requerida
                </span>
              </div>
              <p className="text-xs text-amber-900 mb-3">
                Las siguientes estadías han sido solicitadas por los copropietarios y están pendientes de su autorización como Administrador:
              </p>
              <div className="space-y-2.5">
                {pendingBookings.map((pb) => (
                  <div
                    key={pb.id}
                    className="p-3.5 bg-white border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: pb.userColor }}
                        />
                        <strong className="text-xs font-bold text-[#163323]">{pb.userName}</strong>
                        <span className="text-[11px] text-[#7A8E7E]">({pb.partName})</span>
                        <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 border border-amber-200">
                          {pb.totalDays} noches
                        </span>
                        <span className="text-xs text-[#526657]">
                          · {pb.guestsCount} personas · Arribo {pb.arrivalTime}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#19231A] mt-1.5 flex items-center gap-2">
                        <span>Check-in: {pb.checkInDate}</span>
                        <span className="text-[#BFA270]">→</span>
                        <span>Check-out: {pb.checkOutDate}</span>
                      </div>
                      {pb.notes && (
                        <p className="text-[11px] text-[#55695B] italic mt-1.5 bg-[#FAF8F5] p-2 border border-[#ECE5D4]">
                          “{pb.notes}”
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-amber-100">
                      <button
                        onClick={() => handleAdminApproveBooking(pb.id)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprobar Turno
                      </button>
                      <button
                        onClick={() => {
                          setAdminCancelBookingId(pb.id);
                          setAdminCancelReason('Desestimada por la administración fiduciaria');
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-red-50 border border-red-300 text-red-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 bg-[#FAF8F5] border border-[#E6E0CF]">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#637568] mb-1">
                Filtrar por Copropietario
              </label>
              <select
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#DCD4C0] text-xs focus:outline-none"
              >
                <option value="all">Todos los propietarios</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.partName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#637568] mb-1">
                Estado del Turno
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#DCD4C0] text-xs focus:outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes de Aprobación</option>
                <option value="confirmed">Confirmadas</option>
                <option value="completed">Completadas / Pasadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#637568] mb-1">
                Búsqueda Rápida
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A8E7E]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, nota o fecha..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#DCD4C0] text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Copropietario</th>
                  <th className="py-3 px-3">Rango de Estadía</th>
                  <th className="py-3 px-3">Noches</th>
                  <th className="py-3 px-3">Huéspedes</th>
                  <th className="py-3 px-3">Limpieza 24h</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Notas</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#7A8E7E]">
                      No se encontraron reservas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: b.userColor }}
                          />
                          <div>
                            <span className="font-semibold text-[#163323] block leading-tight">
                              {b.userName}
                            </span>
                            <span className="text-[10px] text-[#7A8E7E] block">{b.partName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#19231A] whitespace-nowrap">
                        {b.checkInDate} <span className="text-[#BFA270]">→</span> {b.checkOutDate}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold tabular-nums">
                        {b.totalDays} noches
                      </td>
                      <td className="py-3 px-3 text-[#4F6254]">{b.guestsCount} pax</td>
                      <td className="py-3 px-3">
                        {b.cleaningBufferApplied ? (
                          <span className="text-emerald-800 font-semibold text-[10px] flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Bloqueada
                          </span>
                        ) : (
                          <span className="text-[#7A8E7E] text-[10px]">No</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : b.status === 'pending'
                              ? 'bg-amber-50 text-amber-900 border border-amber-300'
                              : b.status === 'completed'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-red-50 text-red-800 line-through'
                          }`}
                        >
                          {b.status === 'confirmed'
                            ? 'Confirmada'
                            : b.status === 'pending'
                            ? 'Pendiente'
                            : b.status === 'completed'
                            ? 'Completada'
                            : 'Cancelada'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#637568] max-w-xs truncate">
                        {b.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {b.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleAdminApproveBooking(b.id)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] uppercase font-bold tracking-wider cursor-pointer shadow-2xs"
                              title="Aprobar y Confirmar Reserva"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => {
                                setAdminCancelBookingId(b.id);
                                setAdminCancelReason('Rechazada por la administración fiduciaria');
                              }}
                              className="px-2 py-1 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                              title="Rechazar Reserva"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => {
                              setAdminCancelBookingId(b.id);
                              setAdminCancelReason('');
                            }}
                            className="px-2 py-1 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. BLOQUEO MANUAL DE FECHAS (OBRAS, MANTENIMIENTO)        */}
      {/* ========================================================= */}
      {activeSection === 'blocks' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#163323]">
                Bloqueos Administrativos y de Mantenimiento
              </h3>
              <p className="text-xs text-[#7A8E7E]">
                Inhabilite fechas para reparaciones, pintura, mantenimiento de pileta o imprevistos.
              </p>
            </div>
            <button
              onClick={() => setIsNewBlockModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Lock className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Inhabilitar Rango de Fechas</span>
            </button>
          </div>

          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="p-4 bg-[#FFFDF7] border-l-4 border-amber-500 border-y border-r border-[#E8E2D2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">
                      {block.reason.toUpperCase()}
                    </span>
                    <span className="text-[#7A8E7E]">·</span>
                    <span className="font-mono font-bold text-[#163323]">
                      {block.startDate} al {block.endDate} ({block.totalDays} días)
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#163323] mt-0.5">{block.title}</h4>
                  {block.notes && <p className="text-xs text-[#4F6254] mt-1">{block.notes}</p>}
                  <span className="text-[10px] text-[#7A8E7E] block mt-1">
                    Registrado por {block.createdBy}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="px-3 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Desbloquear Fechas</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. CONFIGURACIÓN GENERAL DEL FIDEICOMISO                  */}
      {/* ========================================================= */}
      {activeSection === 'settings' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0]">
            <h3 className="text-base font-bold text-[#163323]">
              Parámetros Operativos del Fideicomiso El Desayuno
            </h3>
            <p className="text-xs text-[#7A8E7E]">
              Reglas de margen de sanitización post check-out, límites y credenciales de la estancia.
            </p>
          </div>

          {settingsSavedMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Configuración guardada exitosamente y actualizada en tiempo real.</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Horas de Bloqueo de Sanitización Automática
                </label>
                <select
                  value={settingsFormData.autoCleaningBufferHours}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      autoCleaningBufferHours: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                >
                  <option value={12}>12 horas (Mismo día)</option>
                  <option value={24}>24 horas (Día siguiente completo - Recomendado)</option>
                  <option value={48}>48 horas (Sanitización especial fin de semana)</option>
                </select>
                <span className="text-[10px] text-[#7A8E7E] block mt-1">
                  Acondicionamiento del servicio de limpieza entre turnos.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Anticipación Mínima para Cancelar
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settingsFormData.cancellationMinDays}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      cancellationMinDays: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                />
                <span className="text-[10px] text-[#7A8E7E] block mt-1">
                  Días mínimos previos al check-in para que el dueño pueda cancelar en el portal.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Red Wi-Fi (SSID)
                </label>
                <input
                  type="text"
                  value={settingsFormData.wifiSsid}
                  onChange={(e) =>
                    setSettingsFormData({ ...settingsFormData, wifiSsid: e.target.value })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  Contraseña de Wi-Fi
                </label>
                <input
                  type="text"
                  value={settingsFormData.wifiPassword}
                  onChange={(e) =>
                    setSettingsFormData({ ...settingsFormData, wifiPassword: e.target.value })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#EFEAE0]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#BFA270]" />
                Datos Bancarios del Fideicomiso (CBU & Alias para Transferencias)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                    Titular de la Cuenta
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.titularCuenta || ''}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, titularCuenta: e.target.value })
                    }
                    placeholder="Fideicomiso Estancia El Desayuno"
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                    CUIT del Fideicomiso
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.cuitFideicomiso || ''}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, cuitFideicomiso: e.target.value })
                    }
                    placeholder="30-71234567-8"
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                    Nombre del Banco / Entidad
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.bancoNombre || ''}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, bancoNombre: e.target.value })
                    }
                    placeholder="Banco Galicia / BBVA / Macro"
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                    ALIAS Bancario
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.aliasBancario || ''}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, aliasBancario: e.target.value })
                    }
                    placeholder="EL.DESAYUNO.ESTANCIA"
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none font-mono font-bold text-[#163323]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                    CBU / CVU (22 dígitos)
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.cbu || ''}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, cbu: e.target.value })
                    }
                    placeholder="0070123420000012345678"
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none font-mono font-bold text-[#163323]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                Dirección Legal y Coordenadas para Emergencias
              </label>
              <input
                type="text"
                value={settingsFormData.emergencyAddress}
                onChange={(e) =>
                  setSettingsFormData({ ...settingsFormData, emergencyAddress: e.target.value })
                }
                className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-[#EFEAE0]">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Guardar Parámetros Fiduciarios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* Modal: Add or Edit Owner */}
      <UserFormModal
        isOpen={isNewUserModalOpen || !!editingUser}
        onClose={() => {
          setIsNewUserModalOpen(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
        allUsers={users}
        onSaveUser={handleSaveUserFromModal}
      />

      {/* Modal: New Date Block */}
      {isNewBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0] flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Bloquear Rango de Fechas por Mantenimiento</span>
            </h3>

            <form onSubmit={handleSaveBlock} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={blockFormData.startDate}
                    onChange={(e) =>
                      setBlockFormData({ ...blockFormData, startDate: e.target.value })
                    }
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    min={blockFormData.startDate}
                    value={blockFormData.endDate}
                    onChange={(e) => setBlockFormData({ ...blockFormData, endDate: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Motivo Principal
                </label>
                <select
                  value={blockFormData.reason}
                  onChange={(e) =>
                    setBlockFormData({
                      ...blockFormData,
                      reason: e.target.value as DateBlock['reason'],
                    })
                  }
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                >
                  <option value="maintenance">Mantenimiento Preventivo Edilicio</option>
                  <option value="repairs">Reparaciones Urgentes (Bombas / Caldera)</option>
                  <option value="deep_cleaning">Limpieza y Desinfección Profunda</option>
                  <option value="seasonal_prep">Apertura / Cierre de Temporada de Pileta</option>
                  <option value="extraordinary">Causa Extraordinaria / Climatológica</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Título Descriptivo
                </label>
                <input
                  type="text"
                  value={blockFormData.title}
                  onChange={(e) => setBlockFormData({ ...blockFormData, title: e.target.value })}
                  placeholder="ej. Service Oficial de Caldera y Pintura de Deck"
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Detalles y Contratista (Opcional)
                </label>
                <textarea
                  value={blockFormData.notes}
                  onChange={(e) => setBlockFormData({ ...blockFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => setIsNewBlockModalOpen(false)}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-800 text-white font-semibold uppercase tracking-wider hover:bg-amber-900"
                >
                  Inhabilitar Fechas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Cancel Booking */}
      {/* Modal: Admin Cancel / Reject Booking */}
      {adminCancelBookingId && (() => {
        const targetBooking = bookings.find((b) => b.id === adminCancelBookingId);
        const isPending = targetBooking?.status === 'pending';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
            <div className="bg-[#FFFFFF] w-full max-w-md border border-[#DED7C2] shadow-2xl p-6">
              <h3 className="text-base font-bold text-red-800 pb-3 border-b border-[#EFEAE0] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span>{isPending ? 'Desestimar Solicitud de Reserva' : 'Cancelación Extraordinaria de Reserva'}</span>
              </h3>

              <p className="text-xs text-[#4F6254] mt-3 leading-relaxed">
                {isPending ? (
                  <>
                    Como Administrador, al desestimar esta solicitud las fechas solicitadas quedarán liberadas de inmediato en el calendario común.
                    <span className="block mt-1 font-semibold text-amber-900 bg-amber-50 p-2 border border-amber-200">
                      🔒 Privacidad garantizada: la notificación y el motivo del rechazo solo serán visibles para el solicitante ({targetBooking?.userName}) y no para los demás copropietarios.
                    </span>
                  </>
                ) : (
                  'Como Administrador Fiduciario, al cancelar esta reserva las fechas quedarán inmediatamente liberadas en el calendario y los días se reintegrarán al saldo del propietario.'
                )}
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#35483A] mb-1">
                  {isPending ? 'Motivo del Rechazo (Privado para el solicitante)' : 'Motivo Oficial de la Cancelación'}
                </label>
                <textarea
                  value={adminCancelReason}
                  onChange={(e) => setAdminCancelReason(e.target.value)}
                  placeholder={isPending ? 'Ej. Conflicto con mantención programada o documentación incompleta...' : 'Indique la causa legal o imprevisto de fuerza mayor...'}
                  rows={3}
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => setAdminCancelBookingId(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#637568] hover:text-[#19231A]"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleAdminCancelBooking}
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white text-xs font-semibold uppercase tracking-wider"
                >
                  {isPending ? 'Confirmar Rechazo' : 'Ejecutar Cancelación'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Password Management */}
      {canViewAccountPasswords && passwordModalUser && (
        <PasswordManagementModal
          isOpen={!!passwordModalUser}
          onClose={() => setPasswordModalUser(null)}
          targetUser={passwordModalUser}
          isSelfChange={passwordModalUser.id === currentUser.id}
        />
      )}

      {/* Modal: Transfer Admin Role */}
      {isTransferAdminOpen && (
        <TransferAdminModal
          isOpen={isTransferAdminOpen}
          onClose={() => setIsTransferAdminOpen(false)}
          currentAdmin={currentUser}
          users={users}
          onTransferSuccess={(newAdmin) => {
            setIsTransferAdminOpen(false);
          }}
        />
      )}
    </div>
  );
};
