import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Booking, DateBlock, TrustSettings, HouseRule, UsefulContact, DocumentItem, CustomCategory, isUserIntendente } from '../types';
import { storageService } from '../services/storageService';
import { d1Service, D1Config } from '../services/d1Service';
import { r2Service, R2Config } from '../services/r2Service';
import { supabaseService, SupabaseConfig } from '../services/supabaseService';
import { BrandLogo } from './BrandLogo';
import { PasswordManagementModal } from './PasswordManagementModal';
import { TransferAdminModal } from './TransferAdminModal';
import { UserFormModal } from './UserFormModal';
import { CustomDialogModal } from './CustomDialogModal';
import { DiagnosticsLogTab } from './DiagnosticsLogTab';
import { APP_VERSION, APP_BUILD_DATE, APP_STAGE } from '../version';
import { UserRoleBadge } from './UserRoleBadge';
import {
  Users,
  Sliders,
  BookOpen,
  Home,
  PhoneCall,
  FileText,
  Award,
  Landmark,
  Image as ImageIcon,
  Database,
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Cloud,
  Download,
  Upload,
  Clock,
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Search,
  ExternalLink,
  Wifi,
  MapPin,
  Flame,
  Waves,
  Dog,
  Volume2,
  HeartPulse,
  KeyRound,
  FileSpreadsheet,
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
  Building,
  PieChart,
  X,
  Activity,
} from 'lucide-react';

export type SettingsTabId =
  | 'owners'
  | 'engine'
  | 'rules'
  | 'property'
  | 'contacts'
  | 'documents'
  | 'identity'
  | 'categories'
  | 'database'
  | 'diagnostics';

interface UnifiedSettingsPanelProps {
  currentUser: User;
  users: User[];
  bookings: Booking[];
  blocks: DateBlock[];
  settings: TrustSettings;
  initialTab?: SettingsTabId;
  onNavigateTab?: (tab: SettingsTabId) => void;
}

export const UnifiedSettingsPanel: React.FC<UnifiedSettingsPanelProps> = ({
  currentUser,
  users,
  bookings,
  blocks,
  settings,
  initialTab = 'owners',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Success / Alert message banner
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // -------------------------------------------------------------
  // 1. OWNERS MANAGEMENT STATE
  // -------------------------------------------------------------
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [isTransferAdminOpen, setIsTransferAdminOpen] = useState(false);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [copiedAllSuccess, setCopiedAllSuccess] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  // Las claves de cuentas de terceros son exclusivas del intendente.
  const canViewAccountPasswords = isUserIntendente(currentUser);

  // Shares / Equity Matrix Modal State
  const [isSharesMatrixModalOpen, setIsSharesMatrixModalOpen] = useState(false);
  const [sharesMatrixData, setSharesMatrixData] = useState<Record<string, number>>({});

  const handleOpenSharesMatrix = () => {
    const initialMap: Record<string, number> = {};
    users.forEach((u) => {
      initialMap[u.id] = typeof u.sharePercentage === 'number' && !isNaN(u.sharePercentage)
        ? u.sharePercentage
        : 6.25;
    });
    setSharesMatrixData(initialMap);
    setIsSharesMatrixModalOpen(true);
  };

  const handleSaveSharesMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await storageService.updateBulkSharePercentages(sharesMatrixData);
    if (!saved) {
      alert('La base de datos no confirmó la matriz de porcentajes.');
      return;
    }
    setIsSharesMatrixModalOpen(false);
    showSuccess('¡Matriz de porcentajes de acciones actualizada y guardada para todos los socios!');
  };

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

  // -------------------------------------------------------------
  // 2. ENGINE & PROPERTY SETTINGS STATE
  // -------------------------------------------------------------
  const [settingsFormData, setSettingsFormData] = useState<TrustSettings>(settings);

  useEffect(() => {
    setSettingsFormData(settings);
  }, [settings]);

  // Direct fetch from database on mount and whenever the active tab changes
  useEffect(() => {
    storageService.fetchLatestSettingsFromDatabase().then((dbSettings) => {
      if (dbSettings) {
        setSettingsFormData(dbSettings);
      }
    });

    const unsub = storageService.subscribe(() => {
      setSettingsFormData(storageService.getSettings());
      setExpenseCategoriesList(storageService.getExpenseCategories());
      setCashFlowCategoriesList(storageService.getCashFlowCategories());
      setFeeCategoriesList(storageService.getFeeCategories());
      setInventoryCategoriesList(storageService.getInventoryCategories());
      setRulesList(storageService.getRules());
      setContactsList(storageService.getContacts());
      setDocumentsList(storageService.getDocuments());
    });
    return () => unsub();
  }, [activeTab]);

  const [propertySaveStatus, setPropertySaveStatus] = useState<'saving' | 'saved'>('saved');
  const [isRefreshingFromDb, setIsRefreshingFromDb] = useState(false);
  const propertySaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefreshFromDatabase = async () => {
    setIsRefreshingFromDb(true);
    try {
      const latest = await storageService.fetchLatestSettingsFromDatabase();
      if (latest) {
        setSettingsFormData(latest);
        showSuccess('✓ Ajustes actualizados en tiempo real desde la base de datos central.');
      }
    } finally {
      setIsRefreshingFromDb(false);
    }
  };

  const handleSaveSettingsGeneral = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (propertySaveTimerRef.current) clearTimeout(propertySaveTimerRef.current);
    setPropertySaveStatus('saving');
    try {
      const saved = await storageService.saveSettingsAsync(settingsFormData);
      if (saved) setSettingsFormData(saved);
      setPropertySaveStatus('saved');
      showSuccess('✓ Ajustes guardados y sincronizados en la base de datos central para todas las sesiones.');
    } catch {
      setPropertySaveStatus('saved');
    }
  };

  const handlePropertyFieldChange = (field: keyof TrustSettings, value: any) => {
    const updated = { ...settingsFormData, [field]: value };
    setSettingsFormData(updated);
    setPropertySaveStatus('saving');
    if (propertySaveTimerRef.current) clearTimeout(propertySaveTimerRef.current);
    propertySaveTimerRef.current = setTimeout(async () => {
      try {
        const saved = await storageService.saveSettingsAsync(updated);
        if (saved) setSettingsFormData(saved);
        setPropertySaveStatus('saved');
      } catch {
        setPropertySaveStatus('saved');
      }
    }, 1200);
  };

  const handlePropertyFieldBlur = () => {
    if (propertySaveTimerRef.current) clearTimeout(propertySaveTimerRef.current);
    storageService.saveSettingsAsync(settingsFormData).then((saved) => {
      if (saved) setSettingsFormData(saved);
      setPropertySaveStatus('saved');
    });
  };

  // -------------------------------------------------------------
  // CATEGORIES MANAGEMENT STATE
  // -------------------------------------------------------------
  const [expenseCategoriesList, setExpenseCategoriesList] = useState<CustomCategory[]>(storageService.getExpenseCategories());
  const [cashFlowCategoriesList, setCashFlowCategoriesList] = useState<CustomCategory[]>(storageService.getCashFlowCategories());
  const [feeCategoriesList, setFeeCategoriesList] = useState<CustomCategory[]>(storageService.getFeeCategories());
  const [inventoryCategoriesList, setInventoryCategoriesList] = useState<CustomCategory[]>(storageService.getInventoryCategories());

  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean;
    type: 'expense' | 'cashflow' | 'fee' | 'inventory';
    itemToEdit?: CustomCategory | null;
  }>({
    isOpen: false,
    type: 'expense',
    itemToEdit: null,
  });
  const [categoryNameInput, setCategoryNameInput] = useState('');

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryNameInput.trim()) return;
    const type = categoryModal.type;
    const editing = categoryModal.itemToEdit;

    let targetId = editing ? editing.id : categoryNameInput.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!targetId) targetId = `cat_${Date.now()}`;
    const targetObj = { id: targetId, name: categoryNameInput.trim() };

    const saved = await supabaseService.saveCategoryToTable(type, targetObj);
    if (!saved) {
      alert('La base de datos no confirmó la categoría.');
      return;
    }

    if (type === 'expense') {
      let list = [...expenseCategoriesList];
      if (editing) {
        list = list.map(c => c.id === editing.id ? targetObj : c);
      } else {
        list.push(targetObj);
      }
      storageService.saveExpenseCategories(list);
      setExpenseCategoriesList(list);
    } else if (type === 'cashflow') {
      let list = [...cashFlowCategoriesList];
      if (editing) {
        list = list.map(c => c.id === editing.id ? targetObj : c);
      } else {
        list.push(targetObj);
      }
      storageService.saveCashFlowCategories(list);
      setCashFlowCategoriesList(list);
    } else if (type === 'fee') {
      let list = [...feeCategoriesList];
      if (editing) {
        list = list.map(c => c.id === editing.id ? targetObj : c);
      } else {
        list.push(targetObj);
      }
      storageService.saveFeeCategories(list);
      setFeeCategoriesList(list);
    } else if (type === 'inventory') {
      let list = [...inventoryCategoriesList];
      if (editing) {
        list = list.map(c => c.id === editing.id ? targetObj : c);
      } else {
        list.push(targetObj);
      }
      storageService.saveInventoryCategories(list);
      setInventoryCategoriesList(list);
    }

    setCategoryModal({ isOpen: false, type: 'expense', itemToEdit: null });
    setCategoryNameInput('');
    showSuccess('✓ Categoría guardada exitosamente.');
  };

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'confirm' | 'alert' | 'success' | 'warning';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleDeleteCategory = (type: 'expense' | 'cashflow' | 'fee' | 'inventory', id: string, name: string) => {
    setDialogState({
      isOpen: true,
      title: 'Eliminar Categoría',
      message: `¿Desea eliminar la categoría "${name}"?`,
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        void supabaseService.deleteCategoryFromTable(type, id).then((deleted) => {
          if (!deleted) {
            alert('La base de datos no confirmó la eliminación de la categoría.');
            return;
          }
          if (type === 'expense') {
          const list = expenseCategoriesList.filter(c => c.id !== id);
          storageService.saveExpenseCategories(list);
          setExpenseCategoriesList(list);
        } else if (type === 'cashflow') {
          const list = cashFlowCategoriesList.filter(c => c.id !== id);
          storageService.saveCashFlowCategories(list);
          setCashFlowCategoriesList(list);
        } else if (type === 'fee') {
          const list = feeCategoriesList.filter(c => c.id !== id);
          storageService.saveFeeCategories(list);
          setFeeCategoriesList(list);
        } else if (type === 'inventory') {
          const list = inventoryCategoriesList.filter(c => c.id !== id);
          storageService.saveInventoryCategories(list);
          setInventoryCategoriesList(list);
          }
          showSuccess('Categoría eliminada.');
        });
      },
    });
  };

  // -------------------------------------------------------------
  // 3. HOUSE RULES STATE
  // -------------------------------------------------------------
  const [rulesList, setRulesList] = useState<HouseRule[]>(storageService.getRules());
  const [editingRule, setEditingRule] = useState<HouseRule | null>(null);
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [ruleFormData, setRuleFormData] = useState<Omit<HouseRule, 'id'>>({
    category: 'convivencia',
    title: '',
    description: '',
    iconName: 'Volume2',
  });

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      const updated: HouseRule = {
        ...editingRule,
        ...ruleFormData,
      };
      storageService.saveRule(updated);
      setEditingRule(null);
    } else {
      const newRule: HouseRule = {
        id: 'rule-' + Date.now(),
        ...ruleFormData,
      };
      storageService.saveRule(newRule);
      setIsNewRuleModalOpen(false);
    }
    setRulesList(storageService.getRules());
    showSuccess('Regla de convivencia guardada.');
  };

  const handleDeleteRule = (ruleId: string) => {
    setDialogState({
      isOpen: true,
      title: 'Eliminar Regla',
      message: '¿Desea eliminar esta regla de la casa?',
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        storageService.deleteRule(ruleId);
        setRulesList(storageService.getRules());
        showSuccess('Regla eliminada.');
      },
    });
  };

  // -------------------------------------------------------------
  // 4. USEFUL CONTACTS STATE
  // -------------------------------------------------------------
  const [contactsList, setContactsList] = useState<UsefulContact[]>(storageService.getContacts());
  const [editingContact, setEditingContact] = useState<UsefulContact | null>(null);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [contactFormData, setContactFormData] = useState<Omit<UsefulContact, 'id'>>({
    category: 'personal',
    name: '',
    role: '',
    phone: '',
    availableHours: '08:00 a 18:00 hs',
    notes: '',
    isEmergency: false,
  });

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      const updated: UsefulContact = {
        ...editingContact,
        ...contactFormData,
      };
      storageService.saveContact(updated);
      setEditingContact(null);
    } else {
      const newContact: UsefulContact = {
        id: 'cnt-' + Date.now(),
        ...contactFormData,
      };
      storageService.saveContact(newContact);
      setIsNewContactModalOpen(false);
    }
    setContactsList(storageService.getContacts());
    showSuccess('Contacto de asistencia guardado.');
  };

  const handleDeleteContact = (contactId: string) => {
    setDialogState({
      isOpen: true,
      title: 'Eliminar Contacto',
      message: '¿Desea eliminar este contacto del directorio?',
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        storageService.deleteContact(contactId);
        setContactsList(storageService.getContacts());
        showSuccess('Contacto eliminado.');
      },
    });
  };

  // -------------------------------------------------------------
  // 5. DOCUMENTS REPOSITORY STATE
  // -------------------------------------------------------------
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>(storageService.getDocuments());
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [docFormData, setDocFormData] = useState<Omit<DocumentItem, 'id'>>({
    title: '',
    category: 'reglamento',
    version: 'v1.0 Actualizada',
    date: new Date().toLocaleDateString('es-AR'),
    fileSize: '1.5 MB',
    description: '',
    downloadUrl: '',
  });

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDoc) {
      const updated: DocumentItem = {
        ...editingDoc,
        ...docFormData,
      };
      storageService.saveDocument(updated);
      setEditingDoc(null);
    } else {
      const newDoc: DocumentItem = {
        id: 'doc-' + Date.now(),
        ...docFormData,
      };
      storageService.saveDocument(newDoc);
      setIsNewDocModalOpen(false);
    }
    setDocumentsList(storageService.getDocuments());
    showSuccess('Documento fiduciario guardado.');
  };

  const handleDeleteDoc = (docId: string) => {
    setDialogState({
      isOpen: true,
      title: 'Eliminar Documento',
      message: '¿Desea eliminar este documento del repositorio?',
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        storageService.deleteDocument(docId);
        setDocumentsList(storageService.getDocuments());
        showSuccess('Documento eliminado.');
      },
    });
  };

  // -------------------------------------------------------------
  // 6. LOGO & BRANDING STATE
  // -------------------------------------------------------------
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>(
    settings.logoUrl || (typeof window !== 'undefined' ? localStorage.getItem('el_desayuno_custom_logo') || '' : '')
  );
  const [logoInputUrl, setLogoInputUrl] = useState<string>(currentLogoUrl);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleFileUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Por favor seleccione una imagen menor a 15MB.');
      return;
    }

    setIsUploadingLogo(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        let finalLogoUrl = base64;

        try {
          // Upload directly to Cloudflare R2 Bucket 'el-desayuno'
          const r2Res = await r2Service.uploadPhoto(base64, file.name || 'logo-oficial-el-desayuno', 'marca');
          if (r2Res.success && r2Res.url) {
            finalLogoUrl = r2Res.url;
          }
        } catch {
          // Fallback to base64 if R2 is unavailable
        }

        localStorage.setItem('el_desayuno_custom_logo', finalLogoUrl);
        setCurrentLogoUrl(finalLogoUrl);
        setLogoInputUrl(finalLogoUrl);
        const updated = { ...settingsFormData, logoUrl: finalLogoUrl };
        setSettingsFormData(updated);
        storageService.saveSettings(updated);

        if (d1Service.isConnected()) {
          try {
            await d1Service.pushLocalDataToD1(storageService.getAllDataPackage());
          } catch {
            // ignore
          }
        }

        setIsUploadingLogo(false);
        showSuccess('¡Logo oficial subido a la nube (Cloudflare R2)! Guardado para todos los usuarios y dispositivos.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoInputUrl.trim()) return;
    localStorage.setItem('el_desayuno_custom_logo', logoInputUrl.trim());
    setCurrentLogoUrl(logoInputUrl.trim());
    const updated = { ...settingsFormData, logoUrl: logoInputUrl.trim() };
    setSettingsFormData(updated);
    storageService.saveSettings(updated);
    showSuccess('URL de logo guardada.');
  };

  const handleResetToDefaultLogo = () => {
    localStorage.removeItem('el_desayuno_custom_logo');
    setCurrentLogoUrl('');
    setLogoInputUrl('');
    const updated = { ...settingsFormData, logoUrl: '' };
    setSettingsFormData(updated);
    storageService.saveSettings(updated);
    showSuccess('Restablecido al emblema heráldico vectorial original.');
  };

  // -------------------------------------------------------------
  // 7. CLOUDFLARE D1, R2 & BACKUP STATE
  // -------------------------------------------------------------
  const [d1ConfigForm, setD1ConfigForm] = useState<D1Config>(d1Service.getConfig());
  const [d1Loading, setD1Loading] = useState(false);
  const [d1StatusInfo, setD1StatusInfo] = useState<{
    connected: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);
  const [sqlQueryText, setSqlQueryText] = useState('SELECT count(*) as total_users FROM users;');
  const [sqlResults, setSqlResults] = useState<Record<string, unknown>[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  // Cloudflare R2 State
  const [r2ConfigForm, setR2ConfigForm] = useState<R2Config>(r2Service.getConfig());
  const [r2Status, setR2Status] = useState<{ configured: boolean; connected: boolean; message?: string } | null>(null);

  // Supabase State
  const [supabaseConfigForm, setSupabaseConfigForm] = useState<SupabaseConfig>(supabaseService.getConfig());
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState('');

  const handleTestSupabaseConnection = async () => {
    setSupabaseLoading(true);
    setSupabaseStatusMsg('Probrando conexión con Supabase...');
    const res = await supabaseService.testConnection(supabaseConfigForm.url, supabaseConfigForm.anonKey);
    setSupabaseStatusMsg(res.message);
    setSupabaseLoading(false);
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    supabaseService.saveConfig(supabaseConfigForm);
    showSuccess('Credenciales de Supabase guardadas correctamente.');
  };

  const handlePushDataToSupabase = async () => {
    setDialogState({
      isOpen: true,
      title: 'Migrar / Guardar Datos en Supabase',
      message: '¿Desea enviar y sincronizar todos los socios, gastos y datos actuales del fideicomiso a Supabase?',
      type: 'confirm',
      confirmText: 'Sí, Sincronizar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setSupabaseLoading(true);
        const payload = storageService.getAllDataPackage();
        const res = await supabaseService.pushDataToSupabase(payload);
        setSupabaseLoading(false);
        if (res.success) {
          showSuccess(res.message);
        } else {
          setDialogState({
            isOpen: true,
            title: 'Atención Supabase',
            message: res.message,
            type: 'alert',
            confirmText: 'Entendido',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  const handlePullDataFromSupabase = async () => {
    setDialogState({
      isOpen: true,
      title: 'Descargar Datos desde Supabase',
      message: '¿Descargar e importar los datos desde Supabase hacia la aplicación?',
      type: 'confirm',
      confirmText: 'Sí, Descargar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setSupabaseLoading(true);
        const res = await supabaseService.pullDataFromSupabase();
        setSupabaseLoading(false);
        if (res.success && res.data) {
          storageService.importBackupJSON(JSON.stringify(res.data));
          showSuccess('¡Datos sincronizados exitosamente desde Supabase!');
        } else {
          setDialogState({
            isOpen: true,
            title: 'Error Supabase',
            message: res.message,
            type: 'alert',
            confirmText: 'Entendido',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  useEffect(() => {
    d1Service.checkServerStatus().then((info) => setD1StatusInfo(info));
    r2Service.checkServerStatus().then((info) => setR2Status(info));
  }, []);

  const handleSaveR2Config = (e: React.FormEvent) => {
    e.preventDefault();
    r2Service.saveConfig(r2ConfigForm);
    showSuccess("Configuración de Cloudflare R2 (Bucket 'el-desayuno') guardada.");
    r2Service.checkServerStatus().then((info) => setR2Status(info));
  };

  const handleTestD1Connection = async () => {
    setD1Loading(true);
    const res = await d1Service.testConnection(d1ConfigForm);
    const liveStatus = await d1Service.checkServerStatus();
    setD1StatusInfo(liveStatus);
    setD1Loading(false);
    showSuccess(res.message);
  };

  const handleSaveD1Config = (e: React.FormEvent) => {
    e.preventDefault();
    d1Service.saveConfig(d1ConfigForm);
    showSuccess('Credenciales D1 almacenadas.');
  };

  const handleInitD1Schema = async () => {
    setDialogState({
      isOpen: true,
      title: 'Inicializar Tablas D1',
      message: '¿Crear o verificar las tablas en Cloudflare D1 (users, bookings, date_blocks, trust_settings)?',
      type: 'confirm',
      confirmText: 'Inicializar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setD1Loading(true);
        const res = await d1Service.initializeSchema();
        setD1Loading(false);
        showSuccess(res.message);
      },
    });
  };

  const handlePushDataToD1 = async () => {
    setDialogState({
      isOpen: true,
      title: 'Migrar Datos a D1',
      message: '¿Desea migrar todos los socios, turnos y parámetros actuales hacia Cloudflare D1?',
      type: 'confirm',
      confirmText: 'Migrar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setD1Loading(true);
        const payload = storageService.getAllDataPackage();
        const res = await d1Service.pushLocalDataToD1(payload as any);
        setD1Loading(false);
        showSuccess(res.message);
      },
    });
  };

  const handlePullDataFromD1 = async () => {
    setDialogState({
      isOpen: true,
      title: 'Sincronizar desde D1',
      message: '¿Descargar y sincronizar datos desde Cloudflare D1 hacia la aplicación?',
      type: 'confirm',
      confirmText: 'Sincronizar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setD1Loading(true);
        const res = await d1Service.pullDataFromD1();
        setD1Loading(false);
        if (res.success && res.data) {
          storageService.applyRemoteD1Data(res.data);
          showSuccess('Datos sincronizados exitosamente desde Cloudflare D1.');
        } else {
          setDialogState({
            isOpen: true,
            title: 'Error de Sincronización',
            message: res.error || 'Error al obtener datos desde Cloudflare D1.',
            type: 'warning',
            confirmText: 'Aceptar',
            cancelText: '',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  const handleExecuteSQL = async () => {
    if (!sqlQueryText.trim()) return;
    setD1Loading(true);
    setSqlError(null);
    setSqlResults(null);
    const res = await d1Service.executeQuery(sqlQueryText);
    setD1Loading(false);
    if (res.success) {
      setSqlResults(res.results);
    } else {
      setSqlError(res.error || 'Error ejecutando sentencia SQL en D1');
    }
  };

  const handleDownloadBackupJSON = () => {
    const jsonStr = storageService.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-el-desayuno-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Copia de respaldo JSON descargada.');
  };

  const handleUploadBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const res = storageService.importBackupJSON(text);
        if (res.success) {
          showSuccess(res.message);
        } else {
          alert('Error: ' + res.message);
        }
      }
    };
    reader.readAsText(file);
  };

  // User Save/Edit Handlers
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
        cabezaNumber: userData.cabezaNumber,
        role: userData.role || 'owner',
        isCabezaDeEquipo: Boolean(userData.isCabezaDeEquipo),
        isFiduciante: Boolean(userData.isFiduciante),
        annualQuotaDays: userData.annualQuotaDays,
        sharePercentage: typeof userData.sharePercentage === 'number' ? userData.sharePercentage : 6.25,
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
    showSuccess('Copropietario guardado correctamente.');
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
    if (!saved) {
      alert('La base de datos no confirmó el cambio de estado.');
      return;
    }
    showSuccess(`Estado de ${user.name} actualizado.`);
  };

  const handleDeleteUserConfirm = (user: User) => {
    if (user.id === currentUser.id) {
      alert('No puede eliminar su propio usuario administrador.');
      return;
    }
    setDialogState({
      isOpen: true,
      title: 'Eliminar Copropietario',
      message: `¿Está seguro de que desea eliminar a "${user.name}"? Esta acción eliminará al copropietario del sistema y de Supabase.`,
      type: 'confirm',
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        storageService.deleteUser(user.id);
        showSuccess(`Copropietario ${user.name} eliminado correctamente.`);
      },
    });
  };

  // Nav items for sidebar
  const tabsList: Array<{
    id: SettingsTabId;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    {
      id: 'owners',
      label: 'Copropietarios & Accesos',
      description: 'Padrón, 4 Cabezas, contraseñas y administración',
      icon: Users,
      badge: users.length,
    },
    {
      id: 'engine',
      label: 'Motor de Reservas & Operatoria',
      description: 'Buffer de limpieza, check-in/out y anticipación',
      icon: Sliders,
    },
    {
      id: 'rules',
      label: 'Reglas de Convivencia',
      description: 'Normas de la casa, pileta, quincho y mascotas',
      icon: BookOpen,
      badge: rulesList.length,
    },
    {
      id: 'property',
      label: 'Estancia & Wi-Fi',
      description: 'Dirección, credenciales Wi-Fi y ubicación',
      icon: Home,
    },
    {
      id: 'contacts',
      label: 'Directorio de Asistencia',
      description: 'Casero, mucamas, emergencias y técnicos',
      icon: PhoneCall,
      badge: contactsList.length,
    },
    {
      id: 'documents',
      label: 'Documentación Oficial',
      description: 'Actas, estatutos y protocolos fiduciarios',
      icon: FileText,
      badge: documentsList.length,
    },
    {
      id: 'identity',
      label: 'Identidad, Marca & Logo',
      description: 'Personalización de logo, lema y vista previa',
      icon: ImageIcon,
    },
    {
      id: 'categories',
      label: 'Categorías Operativas',
      description: 'Configurar categorías de gastos, cajas, cobranzas e inventario',
      icon: PieChart,
    },
    {
      id: 'database',
      label: 'Supabase, D1 & Backup',
      description: 'Conexión PostgreSQL Supabase, Cloudflare D1 y respaldos',
      icon: Database,
      badge: supabaseService.isConnected() ? '⚡ Supabase' : d1Service.isConnected() ? '● D1' : '○ Local',
    },
    {
      id: 'diagnostics',
      label: 'Registro de Diagnóstico (Logs)',
      description: 'Monitoreo en vivo de peticiones API, consola y estado',
      icon: Activity,
    },
  ];

  const ownerGroups = (() => {
    const isGrouped = (user: User) => Number.isInteger(user.cabezaNumber) && (user.cabezaNumber ?? 0) > 0;
    const cabezaNumbers = Array.from(
      new Set(users.filter(isGrouped).map((user) => user.cabezaNumber as number))
    ).sort((a, b) => a - b);

    const groups = cabezaNumbers.map((number) => ({
      id: `cabeza-${number}`,
      label: `Cabeza ${number}`,
      color: number === 1 ? '#DC2626' : number === 2 ? '#16A34A' : number === 3 ? '#2563EB' : '#D97706',
      members: users
        .filter((user) => user.cabezaNumber === number)
        .sort((a, b) => Number(b.isCabezaDeEquipo) - Number(a.isCabezaDeEquipo) || a.name.localeCompare(b.name)),
    }));

    const independents = users
      .filter((user) => !isGrouped(user))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (independents.length > 0) {
      groups.push({
        id: 'independientes',
        label: 'Sin grupo / Independientes',
        color: '#64748B',
        members: independents,
      });
    }

    return groups;
  })();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#1B3B2B] text-[#BFA270] shadow-xs">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#163323] tracking-wide">
                Centro de Parametrización & Configuración Integral
              </h2>
              <p className="text-xs text-[#637568]">
                Panel maestro unificado: gestione socios, cuotas, reglas de convivencia, motor de turnos, identidad y base de datos.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadBackupJSON}
            className="px-3 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Descargar respaldo completo en formato JSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-800" />
            <span>Descargar Backup</span>
          </button>

          <label className="px-3 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
            <span>Restaurar Backup</span>
            <input type="file" accept=".json" onChange={handleUploadBackupJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Save / Success alert banner */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2.5 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Split Layout: Unified Sidebar + Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Unified Sidebar Navigation (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E3DFC8] divide-y divide-[#EFEAE0] shadow-xs">
          <div className="p-3.5 bg-[#FAF8F5] border-b border-[#E3DFC8]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#637568]">
              Módulos de Configuración
            </span>
          </div>

          <div className="divide-y divide-[#F3EFE6]">
            {tabsList.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                    isActive
                      ? 'bg-[#1B3B2B] text-white'
                      : 'hover:bg-[#FAF8F5] text-[#163323]'
                  }`}
                >
                  <span
                    className={`p-2 shrink-0 ${
                      isActive
                        ? 'bg-[#122A1F] text-[#BFA270]'
                        : 'bg-[#F2ECE1] text-[#163323]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs leading-tight truncate">
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-2xs shrink-0 ${
                            isActive
                              ? 'bg-[#122A1F] text-[#BFA270]'
                              : 'bg-[#EDE7D9] text-[#163323]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] mt-0.5 leading-snug line-clamp-1 ${
                        isActive ? 'text-[#D7CFBA]' : 'text-[#637568]'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* System Version & Environment Info Card */}
          <div className="p-3.5 bg-[#FAF8F5] border-t border-[#E3DFC8]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568]">
                Versión del Sistema
              </span>
              <span className="font-mono font-bold text-xs bg-[#1B3B2B] text-white px-2 py-0.5 rounded shadow-2xs">
                {APP_VERSION}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#55695B]">
              <span>Entorno:</span>
              <span className="font-medium text-[#163323]">{APP_STAGE} · Cloud Multi-Terminal</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#7A8E7E] font-mono">
              <span>Compilación:</span>
              <span>{APP_BUILD_DATE}</span>
            </div>
          </div>
        </div>

        {/* Unified Content Panel (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#E3DFC8] p-6 shadow-xs min-h-[500px]">
          {/* ========================================================= */}
          {/* 1. COPROPIETARIOS & ACCESOS                               */}
          {/* ========================================================= */}
          {activeTab === 'owners' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Padrón de Copropietarios & Gestión de Accesos</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Directorio de las 4 partes, contraseñas de acceso y administración de poderes fiduciarios.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenSharesMatrix}
                    className="px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#D5CDBC] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Modificar % de participación y acciones para la división de gastos de cada socio"
                  >
                    <PieChart className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>Matriz % de Acciones</span>
                  </button>

                  {canViewAccountPasswords && <button
                    type="button"
                    onClick={handleCopyAllCredentials}
                    className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
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
                    className="px-3.5 py-2 bg-[#F4EFE6] hover:bg-[#EDE6D8] border border-[#D5CDBC] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Ceder el poder de Administrador General a otro socio"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    <span>Transferir Administración</span>
                  </button>

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
                    className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>Alta Copropietario</span>
                  </button>
                </div>
              </div>

              {/* KPI Shares Distribution Banner */}
              {(() => {
                const totalAssignedShares = users.reduce((acc, u) => acc + (u.sharePercentage || 0), 0);
                const isSharesBalanced = Math.abs(totalAssignedShares - 100) < 0.05;
                return (
                  <div className={`p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                    isSharesBalanced
                      ? 'bg-[#F4F8F5] border-emerald-300 text-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <PieChart className={`w-5 h-5 shrink-0 ${isSharesBalanced ? 'text-emerald-700' : 'text-amber-700'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase tracking-wider">
                            Distribución de Cuotas Sociales & Acciones:
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                            isSharesBalanced ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {totalAssignedShares.toFixed(4)}% Asignado
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          {isSharesBalanced
                            ? '✓ Las acciones están perfectamente balanceadas al 100.0000%. Todos los gastos y cobros de expensas se dividen exactamente según estos porcentajes.'
                            : `⚠️ Atención: La suma de acciones difiere del 100% (diferencia: ${(100 - totalAssignedShares).toFixed(4)}%). Ajuste las cuotas para un reparto exacto.`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenSharesMatrix}
                      className="px-3 py-1.5 bg-white border border-current text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs flex items-center gap-1.5"
                    >
                      <PieChart className="w-3.5 h-3.5 text-[#BFA270]" />
                      <span>Ajustar Matriz de %</span>
                    </button>
                  </div>
                );
              })()}

              {/* Asignación de Cabezas de Equipo & Roles Fiduciarios */}
              <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4.5 space-y-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E8E2D2]">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#163323] flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#D97706]" />
                      <span>Asignación Oficial de Cabezas de Equipo (Líderes de Grupo)</span>
                    </h4>
                    <p className="text-[11px] text-[#637568] mt-0.5">
                      Seleccione qué copropietario lidera cada Cabeza indivisa (25%). Los líderes tienen un distintivo especial en su perfil y acceso reservado a <strong>Actas de Asamblea</strong> y al <strong>Libro de Gastos</strong>.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#8C7A53] bg-white px-2 py-1 border border-[#D5CDBC] shrink-0 self-start sm:self-auto font-bold">
                    4 Cabezas Indivisas
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((cNum) => {
                    const cabezaMembers = users.filter((u) => u.cabezaNumber === cNum || u.partName.includes(`Cabeza ${cNum}`));
                    const currentLeader = cabezaMembers.find((u) => u.isCabezaDeEquipo);
                    const cabezaColor = cNum === 1 ? '#DC2626' : cNum === 2 ? '#16A34A' : cNum === 3 ? '#2563EB' : '#D97706';

                    return (
                      <div key={cNum} className="bg-white p-3 border border-[#E3DFC8] space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-2xs border text-[#163323]"
                            style={{ backgroundColor: `${cabezaColor}15`, borderColor: cabezaColor }}
                          >
                            Cabeza {cNum} (25%)
                          </span>
                          <span className="text-[10px] text-[#7A8E7E]">{cabezaMembers.length} socios</span>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-[#637568] mb-1">
                            Líder / Cabeza de Equipo:
                          </label>
                          <select
                            value={currentLeader?.id || ''}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              if (!targetId) return;
                              void storageService.assignCabezaLeader(cNum, targetId).then((saved) => {
                                if (!saved) {
                                  alert('La base de datos no confirmó el cambio de líder.');
                                  return;
                                }
                                const assigned = users.find((u) => u.id === targetId);
                                showSuccess(`¡${assigned?.name || 'Socio'} asignado como Líder de Cabeza ${cNum}!`);
                              });
                            }}
                            className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs font-semibold text-[#163323] focus:outline-none focus:border-[#163323] cursor-pointer"
                          >
                            <option value="" disabled>Seleccione líder...</option>
                            {cabezaMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.isCabezaDeEquipo ? '★ (Líder actual)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="text-[10px] text-[#637568] pt-1 border-t border-[#F0EBE0] flex items-center justify-between">
                          <span>Estado:</span>
                          {currentLeader ? (
                            <span className="font-bold text-[#92400E] flex items-center gap-1">
                              <Award className="w-3 h-3 text-[#D97706]" />
                              <span className="truncate max-w-[90px]">{currentLeader.name}</span>
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic">Sin designar</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owners Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Copropietario</th>
                      <th className="py-3 px-3">Cabeza / Grupo</th>
                      <th className="py-3 px-3">% Acciones / Aporte</th>
                      <th className="py-3 px-3">Color Calendario</th>
                      <th className="py-3 px-3">Contraseña de Acceso</th>
                      <th className="py-3 px-3">Rol & Distinción</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE0]">
                    {ownerGroups.map((group) => (
                      <React.Fragment key={group.id}>
                        <tr className="bg-[#F8F5EE] border-y border-[#E3DFC8]">
                          <td colSpan={8} className="px-3 py-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#163323]">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                              <span>{group.label}</span>
                              <span className="font-medium normal-case tracking-normal text-[#7A8E7E]">
                                {group.members.length} {group.members.length === 1 ? 'copropietario' : 'copropietarios'}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {group.members.map((u) => {
                      const isCurrentUser = u.id === currentUser.id;
                      const isCurrentAdmin = u.role === 'admin';
                      return (
                        <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-7 h-7 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs"
                                style={{ backgroundColor: u.color }}
                              >
                                {u.avatarInitials}
                              </span>
                              <div>
                                <span className="font-semibold text-[#163323] block leading-tight">
                                  {u.name}
                                </span>
                                <span className="text-[10px] text-[#7A8E7E] font-mono">
                                  {u.username || u.email.split('@')[0]}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {!u.cabezaNumber || u.cabezaNumber === 0 || u.partName.toLowerCase().includes('sin') || u.partName.toLowerCase().includes('independiente') ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-2xs bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                                <span>Sin Grupo (Independiente)</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-2xs border text-[#163323] shadow-2xs"
                                style={{ backgroundColor: `${u.color}15`, borderColor: u.color }}
                              >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                                <span>{u.partName}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-[#163323] bg-[#EFE9DB] px-2 py-0.5 border border-[#DCD4C0]">
                                {(u.sharePercentage ?? 6.25).toFixed(4)}%
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(u);
                                  setIsNewUserModalOpen(true);
                                }}
                                className="text-[10px] text-[#1B3B2B] hover:underline font-semibold cursor-pointer"
                                title="Ajustar porcentaje de acciones"
                              >
                                Ajustar
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/10"
                                style={{ backgroundColor: u.color }}
                              />
                              <span className="font-mono text-[10px] text-[#637568]">{u.color}</span>
                            </div>
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
                            <UserRoleBadge user={u} size="sm" showAll={true} />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                                u.active
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {u.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle Cabeza de Equipo */}
                              <button
                                type="button"
                                onClick={() => {
                                  void storageService.toggleUserCabezaDeEquipo(u.id).then((saved) => {
                                    if (!saved) {
                                      alert('La base de datos no confirmó el cambio de liderazgo.');
                                      return;
                                    }
                                    showSuccess(
                                      u.isCabezaDeEquipo
                                        ? `Se retiró el liderazgo de Cabeza de Equipo a ${u.name}`
                                        : `¡${u.name} ha sido designado como Cabeza de Equipo!`
                                    );
                                  });
                                }}
                                className={`p-1 transition-colors cursor-pointer rounded-2xs ${
                                  u.isCabezaDeEquipo
                                    ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                                    : 'text-[#637568] hover:text-amber-700 hover:bg-amber-50'
                                }`}
                                title={
                                  u.isCabezaDeEquipo
                                    ? 'Quitar rol de Cabeza de Equipo'
                                    : 'Designar como Cabeza de Equipo (Líder del Grupo con acceso a Actas y Gastos)'
                                }
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Fiduciante */}
                              <button
                                type="button"
                                onClick={() => {
                                  storageService.toggleUserFiduciante(u.id);
                                  showSuccess(
                                    u.isFiduciante
                                      ? `Se retiró el rol de Fiduciante a ${u.name}`
                                      : `¡${u.name} ha sido designado como Fiduciante del Fideicomiso!`
                                  );
                                }}
                                className={`p-1 transition-colors cursor-pointer rounded-2xs ${
                                  u.isFiduciante
                                    ? 'text-indigo-800 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300'
                                    : 'text-[#637568] hover:text-indigo-700 hover:bg-indigo-50'
                                }`}
                                title={
                                  u.isFiduciante
                                    ? 'Quitar rol de Fiduciante'
                                    : 'Designar como Fiduciante del Fideicomiso (Acceso a Actas y Gastos)'
                                }
                              >
                                <Landmark className="w-3.5 h-3.5" />
                              </button>

                              {canViewAccountPasswords && <button
                                onClick={() => setPasswordModalUser(u)}
                                className="p-1 hover:bg-[#EFEAE0] text-[#163323] transition-colors cursor-pointer"
                                title="Cambiar contraseña"
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
                                className="p-1 hover:bg-[#EFEAE0] text-[#163323] transition-colors cursor-pointer"
                                title="Modificar datos"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isCurrentUser && (
                                <>
                                  <button
                                    onClick={() => handleToggleUserActive(u)}
                                    className={`p-1 transition-colors cursor-pointer ${
                                      u.active
                                        ? 'text-amber-700 hover:bg-amber-50'
                                        : 'text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title={u.active ? 'Desactivar usuario' : 'Activar usuario'}
                                  >
                                    {u.active ? <Lock className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUserConfirm(u)}
                                    className="p-1 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. MOTOR DE RESERVAS & OPERATORIA                         */}
          {/* ========================================================= */}
          {activeTab === 'engine' && (
            <form onSubmit={handleSaveSettingsGeneral} className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FBF9F5] p-3 border border-[#E3DFC8]">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Parámetros del Motor de Reservas & Operatoria</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Configure los límites automáticos de ocupación, márgenes de limpieza y políticas de turno.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshFromDatabase}
                    disabled={isRefreshingFromDb}
                    className="px-3 py-2 bg-white hover:bg-[#F2EDE1] text-[#163323] border border-[#DCD4C0] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Consultar y cargar los ajustes más recientes directamente desde la base de datos central"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#2A4D32] ${isRefreshingFromDb ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingFromDb ? 'Actualizando...' : 'Recargar de BD'}</span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-4 h-4 text-[#BFA270]" />
                    <span>Guardar en BD</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span>Margen de Sanitización / Limpieza</span>
                  </h4>
                  <label className="block text-[#4F6254] leading-relaxed">
                    Horas de inhabilitación automática posterior al check-out para reacondicionamiento:
                  </label>
                  <select
                    value={settingsFormData.autoCleaningBufferHours}
                    onChange={(e) =>
                      setSettingsFormData({
                        ...settingsFormData,
                        autoCleaningBufferHours: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                  >
                    <option value={0}>0 horas (Sin bloqueo de limpieza)</option>
                    <option value={12}>12 horas (Mismo día)</option>
                    <option value={24}>24 horas (Día siguiente completo - Recomendado)</option>
                    <option value={48}>48 horas (Sanitización profunda fin de semana)</option>
                  </select>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#BFA270]" />
                    <span>Horarios Oficiales</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#4F6254] mb-1">Check-in</label>
                      <input
                        type="time"
                        value={settingsFormData.checkInTime}
                        onChange={(e) =>
                          setSettingsFormData({ ...settingsFormData, checkInTime: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-[#DCD4C0] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#4F6254] mb-1">Check-out</label>
                      <input
                        type="time"
                        value={settingsFormData.checkOutTime}
                        onChange={(e) =>
                          setSettingsFormData({ ...settingsFormData, checkOutTime: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-[#DCD4C0] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>Cancelaciones & Penalidades</span>
                  </h4>
                  <label className="block text-[#4F6254] leading-relaxed">
                    Días mínimos de anticipación para que un socio cancele sin penalidad:
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
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#163323]" />
                    <span>Límite de Ocupantes & Pernocte</span>
                  </h4>
                  <label className="block text-[#4F6254] leading-relaxed">
                    Capacidad máxima simultánea en la estancia (pax):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={settingsFormData.maxGuestsLimit}
                    onChange={(e) =>
                      setSettingsFormData({
                        ...settingsFormData,
                        maxGuestsLimit: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFEAE0] flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Save className="w-4 h-4 text-[#BFA270]" />
                  <span>Guardar Parámetros Operativos</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. REGLAS DE CONVIVENCIA & NORMAS                         */}
          {/* ========================================================= */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Reglas de Convivencia & Normas de la Casa</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Agregue o modifique las directivas visibles para todos los propietarios en su portal.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingRule(null);
                    setRuleFormData({
                      category: 'convivencia',
                      title: '',
                      description: '',
                      iconName: 'Volume2',
                    });
                    setIsNewRuleModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Nueva Regla</span>
                </button>
              </div>

              <div className="space-y-3">
                {rulesList.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="p-2 bg-[#EDE7D9] text-[#163323] shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#E4DEC9] text-[#163323]">
                            {rule.category}
                          </span>
                          <h4 className="font-bold text-xs text-[#163323]">{rule.title}</h4>
                        </div>
                        <p className="text-xs text-[#4F6254] mt-1 leading-relaxed">
                          {rule.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setRuleFormData({
                            category: rule.category,
                            title: rule.title,
                            description: rule.description,
                            iconName: rule.iconName,
                          });
                        }}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-[#F2EDE1] text-[#163323] text-xs cursor-pointer"
                        title="Editar regla"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-red-50 text-red-700 text-xs cursor-pointer"
                        title="Eliminar regla"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. ESTANCIA & WI-FI                                       */}
          {/* ========================================================= */}
          {activeTab === 'property' && (
            <form onSubmit={handleSaveSettingsGeneral} className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FBF9F5] p-3 border border-[#E3DFC8]">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <Home className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Estancia, Ubicación & Conectividad Wi-Fi</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Parámetros edilicios y credenciales de conexión visibles en la guía del huésped y en toda la red.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshFromDatabase}
                    disabled={isRefreshingFromDb}
                    className="px-3 py-2 bg-white hover:bg-[#F2EDE1] text-[#163323] border border-[#DCD4C0] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Consultar y cargar los ajustes más recientes directamente desde la base de datos central"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#2A4D32] ${isRefreshingFromDb ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingFromDb ? 'Actualizando...' : 'Recargar de BD'}</span>
                  </button>

                  <span
                    className={`text-[11px] font-mono px-2.5 py-1 rounded border flex items-center gap-1.5 ${
                      propertySaveStatus === 'saving'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        propertySaveStatus === 'saving' ? 'bg-blue-600 animate-pulse' : 'bg-emerald-600'
                      }`}
                    />
                    <span>
                      {propertySaveStatus === 'saving' ? 'Guardando en BD...' : '✓ Sincronizado en BD'}
                    </span>
                  </span>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-4 h-4 text-[#BFA270]" />
                    <span>Guardar en BD</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Nombre Oficial del Inmueble
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.houseName}
                    onChange={(e) => handlePropertyFieldChange('houseName', e.target.value)}
                    onBlur={handlePropertyFieldBlur}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-serif font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Lema / Slogan del Fideicomiso
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.slogan || 'Cuatro Partes, Un Mismo Objetivo'}
                    onChange={(e) => handlePropertyFieldChange('slogan', e.target.value)}
                    onBlur={handlePropertyFieldBlur}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold uppercase text-[#35483A] mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-700" />
                    <span>Ubicación y Acceso Legal</span>
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.location}
                    onChange={(e) => handlePropertyFieldChange('location', e.target.value)}
                    onBlur={handlePropertyFieldBlur}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#1B3B2B]" />
                    <span>Red Wi-Fi Principal (SSID)</span>
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.wifiSsid}
                    onChange={(e) => handlePropertyFieldChange('wifiSsid', e.target.value)}
                    onBlur={handlePropertyFieldBlur}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Contraseña Wi-Fi Principal
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.wifiPassword}
                    onChange={(e) => handlePropertyFieldChange('wifiPassword', e.target.value)}
                    onBlur={handlePropertyFieldBlur}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold uppercase text-[#35483A] mb-1 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#1B3B2B]" />
                    <span>Cobertura del Servicio & Detalles de la Red Wi-Fi</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="La red cuenta con repetidores mesh cubriendo la Casa Principal, Quincho, Solárium y Galerías Exteriores. Velocidad simétrica por enlace de fibra rural."
                    value={settingsFormData.wifiCoverageNotes || ''}
                    onChange={(e) => handlePropertyFieldChange('wifiCoverageNotes', e.target.value)}
                    onBlur={handlePropertyFieldBlur}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-xs text-[#163323] focus:outline-none focus:border-[#163323]"
                  />
                  <span className="text-[10px] text-[#7A8E7E] mt-1 block">
                    Modifique este texto para actualizar la información sobre alcance, repetidores y velocidad que leen todos los usuarios en la sección de Wi-Fi & Reglamento.
                  </span>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-[#EFEAE0]">
                  <h4 className="font-bold text-sm text-[#163323] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#BFA270]" />
                    <span>Datos Bancarios para Recibir Transferencias de Expensas (CBU / CVU / ALIAS)</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold uppercase text-[#35483A] mb-1">
                        Número CBU / CVU (22 Dígitos)
                      </label>
                      <input
                        type="text"
                        placeholder="0070123430000012345678"
                        value={settingsFormData.cbu || ''}
                        onChange={(e) => handlePropertyFieldChange('cbu', e.target.value)}
                        onBlur={handlePropertyFieldBlur}
                        className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-[#163323]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold uppercase text-[#35483A] mb-1">
                        ALIAS Bancario / MercadoPago
                      </label>
                      <input
                        type="text"
                        placeholder="EL.DESAYUNO.FIDEICOMISO"
                        value={settingsFormData.aliasBancario || ''}
                        onChange={(e) => handlePropertyFieldChange('aliasBancario', e.target.value)}
                        onBlur={handlePropertyFieldBlur}
                        className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-[#163323]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold uppercase text-[#35483A] mb-1">
                        Banco / Entidad Financiera
                      </label>
                      <input
                        type="text"
                        placeholder="Banco Galicia / MercadoPago"
                        value={settingsFormData.bancoNombre || ''}
                        onChange={(e) => handlePropertyFieldChange('bancoNombre', e.target.value)}
                        onBlur={handlePropertyFieldBlur}
                        className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold uppercase text-[#35483A] mb-1">
                        Titular de la Cuenta
                      </label>
                      <input
                        type="text"
                        placeholder="Fideicomiso Estancia El Desayuno"
                        value={settingsFormData.titularCuenta || ''}
                        onChange={(e) => handlePropertyFieldChange('titularCuenta', e.target.value)}
                        onBlur={handlePropertyFieldBlur}
                        className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold uppercase text-[#35483A] mb-1">
                        CUIT del Fideicomiso
                      </label>
                      <input
                        type="text"
                        placeholder="30-71829304-5"
                        value={settingsFormData.cuitFideicomiso || ''}
                        onChange={(e) => handlePropertyFieldChange('cuitFideicomiso', e.target.value)}
                        onBlur={handlePropertyFieldBlur}
                        className="w-full p-2.5 bg-[#FAF8F5] border border-[#DDD5BF] font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFEAE0] flex justify-between items-center">
                <span className="text-[11px] text-[#7A8E7E]">
                  Todos los cambios se respaldan y sincronizan automáticamente con la Base de Datos central.
                </span>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Save className="w-4 h-4 text-[#BFA270]" />
                  <span>Guardar en Base de Datos</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 5. DIRECTORIO DE ASISTENCIA & CONTACTOS                   */}
          {/* ========================================================= */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Directorio de Asistencia, Personal & Emergencias</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Teléfonos del casero, servicio de mucamas, guardia médica y seguridad rural.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingContact(null);
                    setContactFormData({
                      category: 'personal',
                      name: '',
                      role: '',
                      phone: '',
                      availableHours: '08:00 a 18:00 hs',
                      notes: '',
                      isEmergency: false,
                    });
                    setIsNewContactModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Nuevo Contacto</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contactsList.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-4 border flex flex-col justify-between ${
                      contact.isEmergency
                        ? 'bg-red-50/50 border-red-200'
                        : 'bg-[#FAF8F5] border-[#E3DFC8]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-2xs ${
                            contact.isEmergency
                              ? 'bg-red-100 text-red-800'
                              : 'bg-[#E4DEC9] text-[#163323]'
                          }`}
                        >
                          {contact.category}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingContact(contact);
                              setContactFormData({
                                category: contact.category,
                                name: contact.name,
                                role: contact.role,
                                phone: contact.phone,
                                availableHours: contact.availableHours,
                                notes: contact.notes || '',
                                isEmergency: Boolean(contact.isEmergency),
                              });
                            }}
                            className="p-1 hover:bg-white text-[#163323]"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1 hover:bg-red-100 text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-xs text-[#163323] mt-2">{contact.name}</h4>
                      <p className="text-[11px] text-[#55695B] font-medium">{contact.role}</p>

                      <div className="mt-3 p-2 bg-white border border-[#E8E2D2] text-xs font-mono font-bold text-[#163323] flex items-center justify-between">
                        <span>{contact.phone}</span>
                        <span className="text-[10px] font-sans font-normal text-[#7A8E7E]">
                          {contact.availableHours}
                        </span>
                      </div>

                      {contact.notes && (
                        <p className="text-[11px] text-[#637568] mt-2 italic">{contact.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. DOCUMENTACIÓN OFICIAL DEL FIDEICOMISO                 */}
          {/* ========================================================= */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Repositorio de Documentación Fiduciaria</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Actas notariales, contratos constitutivos, planos y manuales de equipamiento.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingDoc(null);
                    setDocFormData({
                      title: '',
                      category: 'reglamento',
                      version: 'v1.0',
                      date: new Date().toLocaleDateString('es-AR'),
                      fileSize: '1.2 MB',
                      description: '',
                      downloadUrl: '',
                    });
                    setIsNewDocModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Nuevo Documento</span>
                </button>
              </div>

              <div className="space-y-3">
                {documentsList.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#E4DEC9] text-[#163323]">
                          {doc.category}
                        </span>
                        <span className="text-[11px] text-[#7A8E7E]">{doc.version} · {doc.date}</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#163323] mt-1">{doc.title}</h4>
                      <p className="text-xs text-[#4F6254] mt-1 leading-relaxed">
                        {doc.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingDoc(doc);
                          setDocFormData({
                            title: doc.title,
                            category: doc.category,
                            version: doc.version,
                            date: doc.date,
                            fileSize: doc.fileSize,
                            description: doc.description,
                            downloadUrl: doc.downloadUrl || '',
                          });
                        }}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-[#F2EDE1] text-[#163323] text-xs cursor-pointer"
                        title="Editar documento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-red-50 text-red-700 text-xs cursor-pointer"
                        title="Eliminar documento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. IDENTIDAD, MARCA & LOGO                                */}
          {/* ========================================================= */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0]">
                <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#1B3B2B]" />
                  <span>Identidad Visual & Personalización de Logo</span>
                </h3>
                <p className="text-xs text-[#7A8E7E] mt-0.5">
                  Cargue la imagen corporativa oficial del Fideicomiso El Desayuno.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 p-5 bg-[#FAF8F5] border border-[#E3DFC8] flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#637568] mb-3">
                    Vista Previa Actual
                  </span>
                  <div className="p-4 bg-white border border-[#DDD5BF] shadow-xs flex items-center justify-center">
                    <BrandLogo size="xl" variant="seal-only" logoUrl={currentLogoUrl || undefined} />
                  </div>
                  <span className="font-serif font-bold text-sm tracking-wider text-[#163323] mt-3">
                    EL DESAYUNO SOCIEDAD
                  </span>
                  <span className="text-[10px] text-[#A68853] uppercase font-semibold">
                    Cuatro Partes, Un Mismo Objetivo
                  </span>
                </div>

                <div className="lg:col-span-7 space-y-4 text-xs">
                  <div className="p-4 bg-white border border-[#E3DFC8]">
                    <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-[#BFA270]" />
                      <span>Cargar Archivo de Imagen desde su Computadora</span>
                    </h4>
                    <p className="text-[#637568] mt-1 leading-snug">
                      Suba un archivo PNG, JPG o SVG. Se guardará de manera permanente.
                    </p>
                    <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
                      <span>{isUploadingLogo ? 'Subiendo Logo a Cloudflare R2...' : 'Seleccionar Archivo de Logo'}</span>
                      <input type="file" accept="image/*" onChange={handleFileUploadLogo} disabled={isUploadingLogo} className="hidden" />
                    </label>
                  </div>

                  <div className="p-4 bg-white border border-[#E3DFC8]">
                    <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-[#BFA270]" />
                      <span>O ingresar URL Externa de Imagen</span>
                    </h4>
                    <form onSubmit={handleSaveLogoUrl} className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={logoInputUrl}
                        onChange={(e) => setLogoInputUrl(e.target.value)}
                        placeholder="https://... o ruta de imagen"
                        className="flex-1 p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-mono text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#EFEAE0] border border-[#DCD4C0] font-semibold uppercase text-[#163323]"
                      >
                        Guardar
                      </button>
                    </form>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] border border-[#E3DFC8] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#163323]">
                      Restablecer al emblema heráldico vectorial original:
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToDefaultLogo}
                      className="px-3 py-1 bg-white hover:bg-red-50 border border-[#DDD5BF] text-xs font-semibold text-red-700"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* CATEGORÍAS OPERATIVAS                                      */}
          {/* ========================================================= */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Configuración de Categorías Operativas</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Personalice y administre las categorías utilizadas en Gastos, Cajas, Cobranzas e Inventario.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Expenses Categories */}
                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#163323] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Categorías de Gastos</span>
                    </h4>
                    <button
                      onClick={() => {
                        setCategoryModal({ isOpen: true, type: 'expense', itemToEdit: null });
                        setCategoryNameInput('');
                      }}
                      className="px-2.5 py-1 bg-[#1B3B2B] text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {expenseCategoriesList.map((cat) => (
                      <div key={cat.id} className="p-2.5 bg-white border border-[#E3DFC8] flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#163323]">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setCategoryModal({ isOpen: true, type: 'expense', itemToEdit: cat });
                              setCategoryNameInput(cat.name);
                            }}
                            className="p-1 hover:bg-[#F2EDE1] text-[#163323]"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory('expense', cat.id, cat.name)}
                            className="p-1 hover:bg-red-50 text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Cash Flow Categories */}
                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#163323] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Categorías de Cajas & Cuentas</span>
                    </h4>
                    <button
                      onClick={() => {
                        setCategoryModal({ isOpen: true, type: 'cashflow', itemToEdit: null });
                        setCategoryNameInput('');
                      }}
                      className="px-2.5 py-1 bg-[#1B3B2B] text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {cashFlowCategoriesList.map((cat) => (
                      <div key={cat.id} className="p-2.5 bg-white border border-[#E3DFC8] flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#163323]">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setCategoryModal({ isOpen: true, type: 'cashflow', itemToEdit: cat });
                              setCategoryNameInput(cat.name);
                            }}
                            className="p-1 hover:bg-[#F2EDE1] text-[#163323]"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory('cashflow', cat.id, cat.name)}
                            className="p-1 hover:bg-red-50 text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Fee Collection Categories */}
                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#163323] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Categorías de Cobranzas</span>
                    </h4>
                    <button
                      onClick={() => {
                        setCategoryModal({ isOpen: true, type: 'fee', itemToEdit: null });
                        setCategoryNameInput('');
                      }}
                      className="px-2.5 py-1 bg-[#1B3B2B] text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {feeCategoriesList.map((cat) => (
                      <div key={cat.id} className="p-2.5 bg-white border border-[#E3DFC8] flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#163323]">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setCategoryModal({ isOpen: true, type: 'fee', itemToEdit: cat });
                              setCategoryNameInput(cat.name);
                            }}
                            className="p-1 hover:bg-[#F2EDE1] text-[#163323]"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory('fee', cat.id, cat.name)}
                            className="p-1 hover:bg-red-50 text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Inventory Categories */}
                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#163323] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Categorías de Inventario</span>
                    </h4>
                    <button
                      onClick={() => {
                        setCategoryModal({ isOpen: true, type: 'inventory', itemToEdit: null });
                        setCategoryNameInput('');
                      }}
                      className="px-2.5 py-1 bg-[#1B3B2B] text-white text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {inventoryCategoriesList.map((cat) => (
                      <div key={cat.id} className="p-2.5 bg-white border border-[#E3DFC8] flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#163323]">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setCategoryModal({ isOpen: true, type: 'inventory', itemToEdit: cat });
                              setCategoryNameInput(cat.name);
                            }}
                            className="p-1 hover:bg-[#F2EDE1] text-[#163323]"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory('inventory', cat.id, cat.name)}
                            className="p-1 hover:bg-red-50 text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal for Category Add/Edit */}
              {categoryModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
                  <div className="bg-white border border-[#DCD4C0] w-full max-w-md shadow-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
                      <h4 className="font-bold text-sm text-[#163323] uppercase tracking-wider">
                        {categoryModal.itemToEdit ? 'Editar Categoría' : 'Nueva Categoría'}
                      </h4>
                      <button
                        onClick={() => setCategoryModal({ isOpen: false, type: 'expense', itemToEdit: null })}
                        className="p-1 text-[#4F6254] hover:text-[#163323]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveCategory} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-[#35483A] mb-1">Nombre de la Categoría *</label>
                        <input
                          type="text"
                          required
                          value={categoryNameInput}
                          onChange={(e) => setCategoryNameInput(e.target.value)}
                          placeholder="ej. Mantenimiento especial"
                          className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] text-xs font-medium text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E8E2D2]">
                        <button
                          type="button"
                          onClick={() => setCategoryModal({ isOpen: false, type: 'expense', itemToEdit: null })}
                          className="px-4 py-2 bg-white border border-[#DCD4C0] text-[#163323] text-xs font-semibold uppercase tracking-wider hover:bg-[#FAF8F5]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider"
                        >
                          Guardar Categoría
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. CLOUDFLARE D1 & BACKUP                                 */}
          {/* ========================================================= */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              {/* ⚡ SUPABASE INTEGRATION CARD */}
              <div className="p-5 bg-gradient-to-br from-[#122E1E] to-[#1B3B2B] text-white border border-[#2B543D] shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold">
                      ⚡
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Sincronización y Base de Datos Supabase</span>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded">
                          Recomendado
                        </span>
                      </h3>
                      <p className="text-xs text-emerald-200/80">
                        Base de datos PostgreSQL en la nube con soporte en tiempo real y sin límites de lecturas diarias.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border ${
                      supabaseService.isConnected()
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        supabaseService.isConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <span>{supabaseService.isConnected() ? 'Supabase Conectado' : 'Supabase No Configurado'}</span>
                  </span>
                </div>

                <form onSubmit={handleSaveSupabaseConfig} className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-emerald-200 mb-1">
                      🌐 URL del Proyecto Supabase (Project URL) *
                    </label>
                    <input
                      type="url"
                      required
                      value={supabaseConfigForm.url}
                      onChange={(e) => setSupabaseConfigForm({ ...supabaseConfigForm, url: e.target.value.trim() })}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full p-2.5 bg-black/30 border border-emerald-600/50 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 rounded"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-200 mb-1">
                      🔑 Clave de API Pública / Anon Key *
                    </label>
                    <input
                      type="password"
                      required
                      value={supabaseConfigForm.anonKey}
                      onChange={(e) => setSupabaseConfigForm({ ...supabaseConfigForm, anonKey: e.target.value.trim() })}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full p-2.5 bg-black/30 border border-emerald-600/50 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 rounded"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-emerald-800/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSupabaseConnection}
                        disabled={supabaseLoading}
                        className="px-4 py-2 bg-emerald-800/60 hover:bg-emerald-700/80 border border-emerald-500/50 text-white font-semibold uppercase tracking-wider text-xs flex items-center gap-2 cursor-pointer rounded transition-colors"
                      >
                        {supabaseLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-emerald-300" />}
                        <span>Probar Conexión</span>
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0E2417] font-bold uppercase tracking-wider text-xs cursor-pointer rounded transition-colors shadow-sm"
                      >
                        Guardar Credenciales
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePushDataToSupabase}
                        disabled={supabaseLoading || !supabaseService.isConnected()}
                        className="px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-600/60 text-xs font-semibold cursor-pointer rounded disabled:opacity-50"
                      >
                        📤 Migrar Datos a Supabase
                      </button>

                      <button
                        type="button"
                        onClick={handlePullDataFromSupabase}
                        disabled={supabaseLoading || !supabaseService.isConnected()}
                        className="px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-600/60 text-xs font-semibold cursor-pointer rounded disabled:opacity-50"
                      >
                        📥 Descargar de Supabase
                      </button>
                    </div>
                  </div>

                  {supabaseStatusMsg && (
                    <div className="md:col-span-2 p-2.5 bg-emerald-950/80 border border-emerald-700/50 text-emerald-200 text-xs rounded flex items-center gap-2">
                      <span>{supabaseStatusMsg}</span>
                    </div>
                  )}
                </form>
              </div>












              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Base de Datos Cloudflare D1 & Copias de Respaldo</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Motor relacional SQLite serverless en el Edge de Cloudflare con latencia ultra baja.
                  </p>
                </div>

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
                        ? `D1 Conectado (${d1StatusInfo?.latencyMs || 0.3}ms)`
                        : 'Modo Local'}
                    </span>
                  </span>
                </div>
              </div>

              {/* D1 Credentials & Test */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4 text-xs">
                <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#BFA270]" />
                  <span>Credenciales y Enlace Cloudflare API</span>
                </h4>

                <form onSubmit={handleSaveD1Config} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Account ID</label>
                    <input
                      type="text"
                      value={d1ConfigForm.accountId}
                      onChange={(e) => setD1ConfigForm({ ...d1ConfigForm, accountId: e.target.value.trim() })}
                      placeholder="b36aef318f..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Database ID</label>
                    <input
                      type="text"
                      value={d1ConfigForm.databaseId}
                      onChange={(e) => setD1ConfigForm({ ...d1ConfigForm, databaseId: e.target.value.trim() })}
                      placeholder="f0474948-373a..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">API Token</label>
                    <input
                      type="password"
                      value={d1ConfigForm.apiToken}
                      onChange={(e) => setD1ConfigForm({ ...d1ConfigForm, apiToken: e.target.value.trim() })}
                      placeholder="••••••••••••••••"
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>

                  <div className="md:col-span-3 pt-2 flex items-center justify-between gap-2 border-t border-[#E8E2D2]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestD1Connection}
                        disabled={d1Loading}
                        className="px-3.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C0] text-[#163323] font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                      >
                        {d1Loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-emerald-800" />}
                        <span>Probar Conexión</span>
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>

                    <span className="text-[11px] text-[#7A8E7E]">
                      {d1StatusInfo?.message || 'Verificado con el servidor.'}
                    </span>
                  </div>
                </form>
              </div>

              {/* Cloudflare R2 Object Storage Card (Bucket: el-desayuno) */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#BFA270]" />
                    <span>Almacenamiento de Fotos: Cloudflare R2 (Bucket: el-desayuno)</span>
                  </h4>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      r2Status?.connected
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {r2Status?.connected ? 'R2 Activo' : 'R2 Pendiente de Credenciales'}
                  </span>
                </div>

                <form onSubmit={handleSaveR2Config} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Nombre del Bucket</label>
                    <input
                      type="text"
                      value={r2ConfigForm.bucketName || 'el-desayuno'}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, bucketName: e.target.value.trim() })}
                      placeholder="el-desayuno"
                      required
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs font-bold text-[#163323]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Account ID</label>
                    <input
                      type="text"
                      value={r2ConfigForm.accountId}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, accountId: e.target.value.trim() })}
                      placeholder="b36aef318f..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">R2 Access Key ID</label>
                    <input
                      type="text"
                      value={r2ConfigForm.accessKeyId}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, accessKeyId: e.target.value.trim() })}
                      placeholder="e.j. 4a2b8c9..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">R2 Secret Access Key</label>
                    <input
                      type="password"
                      value={r2ConfigForm.secretAccessKey}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, secretAccessKey: e.target.value.trim() })}
                      placeholder="••••••••••••••••"
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>

                  <div className="md:col-span-4 pt-2 flex items-center justify-between gap-2 border-t border-[#E8E2D2]">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer"
                    >
                      Guardar R2 Bucket 'el-desayuno'
                    </button>
                    <span className="text-[11px] text-[#7A8E7E]">
                      {r2Status?.message || "Conexión S3-compatible lista para el Bucket 'el-desayuno'."}
                    </span>
                  </div>
                </form>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <button
                  onClick={handleInitD1Schema}
                  disabled={d1Loading}
                  className="p-3.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C0] text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold text-[#163323] block">1. Verificar Tablas DDL</span>
                  <span className="text-[11px] text-[#637568] block mt-1">
                    Crea users, bookings, date_blocks y settings en SQLite.
                  </span>
                </button>

                <button
                  onClick={handlePushDataToD1}
                  disabled={d1Loading}
                  className="p-3.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-left transition-colors cursor-pointer shadow-xs"
                >
                  <span className="font-bold block flex items-center justify-between">
                    <span>2. Migrar a Cloudflare D1</span>
                    <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
                  </span>
                  <span className="text-[11px] text-[#D0C7B2] block mt-1">
                    Envía todos los socios, reglas y turnos locales a la nube.
                  </span>
                </button>

                <button
                  onClick={handlePullDataFromD1}
                  disabled={d1Loading}
                  className="p-3.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C0] text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold text-[#163323] block flex items-center justify-between">
                    <span>3. Descargar de D1</span>
                    <Download className="w-3.5 h-3.5 text-emerald-800" />
                  </span>
                  <span className="text-[11px] text-[#637568] block mt-1">
                    Sincroniza el estado más reciente desde la nube.
                  </span>
                </button>
              </div>

              {/* SQL Console */}
              <div className="p-4 bg-[#16291C] text-white rounded-none space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#BFA270]">
                    Consola Interactiva SQL D1
                  </span>
                  <button
                    onClick={handleExecuteSQL}
                    disabled={d1Loading}
                    className="px-3 py-1 bg-[#2D4A35] hover:bg-[#3D6247] text-white text-xs font-mono font-bold uppercase transition-colors cursor-pointer"
                  >
                    Ejecutar Query
                  </button>
                </div>
                <textarea
                  value={sqlQueryText}
                  onChange={(e) => setSqlQueryText(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-[#0E1B12] border border-[#2D4A35] font-mono text-xs text-emerald-300 focus:outline-none"
                />

                {sqlError && (
                  <div className="p-2 bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono">
                    {sqlError}
                  </div>
                )}

                {sqlResults && (
                  <div className="max-h-48 overflow-auto border border-[#2D4A35] bg-[#0E1B12] p-2 text-xs font-mono">
                    <pre className="text-emerald-300">{JSON.stringify(sqlResults, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 9. DIAGNOSTICS & LOGS CONSOLE                             */}
          {/* ========================================================= */}
          {activeTab === 'diagnostics' && <DiagnosticsLogTab />}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODALS: USER, RULE, CONTACT, DOC                          */}
      {/* ========================================================= */}

      {/* Modal: User Add / Edit */}
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

      {/* Modal: House Rule Add / Edit */}
      {(isNewRuleModalOpen || editingRule) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingRule ? 'Modificar Regla de Convivencia' : 'Nueva Regla de Convivencia'}
            </h3>

            <form onSubmit={handleSaveRule} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={ruleFormData.category}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, category: e.target.value as HouseRule['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="convivencia">Convivencia General</option>
                    <option value="horarios">Horarios & Descanso</option>
                    <option value="capacidad">Capacidad & Invitados</option>
                    <option value="mascotas">Política de Mascotas</option>
                    <option value="pileta">Piscina & Parque</option>
                    <option value="quincho">Quincho & Asador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Título de la Regla</label>
                  <input
                    type="text"
                    value={ruleFormData.title}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, title: e.target.value })}
                    placeholder="ej. Cuidado de la Piscina"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Descripción y Directiva</label>
                <textarea
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Detalle de la pauta de uso..."
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewRuleModalOpen(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Regla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Useful Contact Add / Edit */}
      {(isNewContactModalOpen || editingContact) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingContact ? 'Modificar Contacto' : 'Nuevo Contacto de Asistencia'}
            </h3>

            <form onSubmit={handleSaveContact} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Nombre o Institución</label>
                  <input
                    type="text"
                    value={contactFormData.name}
                    onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Rol / Función</label>
                  <input
                    type="text"
                    value={contactFormData.role}
                    onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
                    placeholder="ej. Casero / Limpieza"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Disponibilidad</label>
                  <input
                    type="text"
                    value={contactFormData.availableHours}
                    onChange={(e) => setContactFormData({ ...contactFormData, availableHours: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={contactFormData.category}
                    onChange={(e) => setContactFormData({ ...contactFormData, category: e.target.value as UsefulContact['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="personal">Personal del Campo</option>
                    <option value="emergencia">Emergencias Médicas / Fuego</option>
                    <option value="seguridad">Seguridad Rural</option>
                    <option value="servicios">Técnicos & Mantenimiento</option>
                  </select>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#163323]">
                    <input
                      type="checkbox"
                      checked={contactFormData.isEmergency}
                      onChange={(e) => setContactFormData({ ...contactFormData, isEmergency: e.target.checked })}
                      className="w-4 h-4 text-red-600 cursor-pointer"
                    />
                    <span>¿Es Guardia de Emergencia 24h?</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Notas Adicionales</label>
                <input
                  type="text"
                  value={contactFormData.notes || ''}
                  onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                  placeholder="Ubicación o instrucciones de contacto..."
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewContactModalOpen(false);
                    setEditingContact(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Document Add / Edit */}
      {(isNewDocModalOpen || editingDoc) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingDoc ? 'Modificar Documento' : 'Nuevo Documento Fiduciario'}
            </h3>

            <form onSubmit={handleSaveDocument} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Título del Documento</label>
                <input
                  type="text"
                  value={docFormData.title}
                  onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={docFormData.category}
                    onChange={(e) => setDocFormData({ ...docFormData, category: e.target.value as DocumentItem['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="reglamento">Reglamento</option>
                    <option value="acta">Acta Notarial</option>
                    <option value="contrato">Contrato Fiduciario</option>
                    <option value="manual">Manual Técnico</option>
                    <option value="mantenimiento">Protocolo de Salida</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Versión</label>
                  <input
                    type="text"
                    value={docFormData.version}
                    onChange={(e) => setDocFormData({ ...docFormData, version: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Descripción</label>
                <textarea
                  value={docFormData.description}
                  onChange={(e) => setDocFormData({ ...docFormData, description: e.target.value })}
                  rows={2}
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewDocModalOpen(false);
                    setEditingDoc(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            showSuccess(`Poder de administración transferido exitosamente a ${newAdmin.name}.`);
          }}
        />
      )}

      {/* Modal: Matriz % de Acciones y Aporte Social */}
      {isSharesMatrixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-[#FFFFFF] w-full max-w-3xl border border-[#DED7C2] shadow-2xl flex flex-col my-6 max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <PieChart className="w-5 h-5 text-[#BFA270]" />
                <div>
                  <h3
                    className="text-base font-bold tracking-wide"
                    style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                  >
                    Matriz de Acciones & % de Participación Social
                  </h3>
                  <p className="text-[11px] text-[#C9D6CC]">
                    Configure la proporción de cada socio para la liquidación automática de gastos, facturas y expensas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSharesMatrixModalOpen(false)}
                className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSharesMatrix} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* Summary / Balance Status */}
                {(() => {
                  const total = Object.values(sharesMatrixData).reduce((acc, v) => acc + (Number(v) || 0), 0);
                  const isBalanced = Math.abs(total - 100) < 0.05;
                  const diff = 100 - total;

                  return (
                    <div
                      className={`p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                        isBalanced
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <span>Total de Acciones Asignadas:</span>
                          <span
                            className={`px-2.5 py-0.5 rounded font-mono text-sm ${
                              isBalanced ? 'bg-emerald-200 text-emerald-950' : 'bg-amber-200 text-amber-950'
                            }`}
                          >
                            {total.toFixed(4)}%
                          </span>
                        </div>
                        <p className="text-[11px] mt-1 opacity-90">
                          {isBalanced ? (
                            '✓ Las acciones suman exactamente el 100.0000%. Toda expensa o gasto liquidado se dividirá de forma armónica.'
                          ) : (
                            <>
                              ⚠️ Atención: Hay una diferencia de{' '}
                              <strong>{Math.abs(diff).toFixed(4)}%</strong> ({diff > 0 ? 'Falta asignar' : 'Excedente'}).
                              Para un reparto exacto, la suma debe ser 100.0000%.
                            </>
                          )}
                        </p>
                      </div>

                      {/* Quick Auto-balance Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            // Auto balance: 25% for each Cabeza 1..4 divided equally among its members
                            const newMap: Record<string, number> = {};
                            const cabezasMap: Record<number, User[]> = { 1: [], 2: [], 3: [], 4: [] };
                            users.forEach((u) => {
                              const cNum = u.cabezaNumber || 1;
                              if (!cabezasMap[cNum]) cabezasMap[cNum] = [];
                              cabezasMap[cNum].push(u);
                            });

                            [1, 2, 3, 4].forEach((cNum) => {
                              const members = cabezasMap[cNum] || [];
                              if (members.length > 0) {
                                const perMember = Math.round((25 / members.length) * 10000) / 10000;
                                members.forEach((m) => {
                                  newMap[m.id] = perMember;
                                });
                              }
                            });
                            setSharesMatrixData(newMap);
                          }}
                          className="px-2.5 py-1.5 bg-white border border-current text-[11px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer shadow-2xs"
                        >
                          Auto 25% por Cabeza
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            // Equal among all active users
                            const newMap: Record<string, number> = {};
                            const count = users.length;
                            if (count > 0) {
                              const perUser = Math.round((100 / count) * 10000) / 10000;
                              users.forEach((u) => {
                                newMap[u.id] = perUser;
                              });
                            }
                            setSharesMatrixData(newMap);
                          }}
                          className="px-2.5 py-1.5 bg-white border border-current text-[11px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer shadow-2xs"
                        >
                          Partes Iguales (1/N)
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Grouped by Cabeza */}
                {(() => {
                  const cabezasKeys = Array.from(new Set(users.map((u) => u.cabezaNumber || 1))).sort((a, b) => a - b);

                  return (
                    <div className="space-y-4">
                      {cabezasKeys.map((cNum) => {
                        const members = users.filter((u) => (u.cabezaNumber || 1) === cNum);
                        const cabezaSubtotal = members.reduce(
                          (acc, m) => acc + (Number(sharesMatrixData[m.id]) || 0),
                          0
                        );
                        const sampleColor = members[0]?.color || '#163323';

                        return (
                          <div
                            key={cNum}
                            className="bg-[#FAF8F5] border border-[#DDD5BF] overflow-hidden shadow-2xs"
                          >
                            <div className="p-3 bg-[#F2EDE1] border-b border-[#DDD5BF] flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                                  style={{ backgroundColor: sampleColor }}
                                />
                                <h4 className="font-bold text-xs uppercase tracking-wider text-[#163323]">
                                  Cabeza {cNum} ({members.length} {members.length === 1 ? 'Socio' : 'Socios'})
                                </h4>
                              </div>

                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const share = Math.round((25 / members.length) * 10000) / 10000;
                                    setSharesMatrixData((prev) => {
                                      const next = { ...prev };
                                      members.forEach((m) => {
                                        next[m.id] = share;
                                      });
                                      return next;
                                    });
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-wider text-[#1B3B2B] hover:underline cursor-pointer"
                                >
                                  Dividir 25% equitativo entre miembros
                                </button>

                                <span className="px-2 py-0.5 bg-white border border-[#D5CDBC] font-mono font-bold text-xs text-[#163323]">
                                  Subtotal Cabeza: {cabezaSubtotal.toFixed(4)}%
                                </span>
                              </div>
                            </div>

                            <div className="divide-y divide-[#EAE4D5] bg-white">
                              {members.map((u) => {
                                const currentVal = sharesMatrixData[u.id] ?? u.sharePercentage ?? 6.25;

                                return (
                                  <div
                                    key={u.id}
                                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-2xs"
                                        style={{ backgroundColor: u.color }}
                                      >
                                        {u.avatarInitials || u.name.slice(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-[#163323] text-xs">{u.name}</span>
                                          {u.role === 'admin' && (
                                            <span className="px-1.5 py-0.2 bg-[#1B3B2B] text-[#FAF8F5] text-[9px] font-bold uppercase rounded">
                                              Admin
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-[#637568]">
                                          {u.email} • <span className="font-medium text-[#46574B]">{u.partName}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                      {/* Quick Presets */}
                                      <div className="hidden md:flex items-center gap-1">
                                        {[25, 12.5, 6.25, 2.7778].map((preset) => (
                                          <button
                                            key={preset}
                                            type="button"
                                            onClick={() =>
                                              setSharesMatrixData((prev) => ({
                                                ...prev,
                                                [u.id]: preset,
                                              }))
                                            }
                                            className={`px-1.5 py-0.5 text-[10px] border transition-colors cursor-pointer ${
                                              Math.abs(currentVal - preset) < 0.0001
                                                ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                                                : 'bg-white hover:bg-[#FAF8F5] text-[#55695B] border-[#DDD5BF]'
                                            }`}
                                          >
                                            {preset}%
                                          </button>
                                        ))}
                                      </div>

                                      <div className="flex items-center">
                                        <input
                                          type="number"
                                          step="any"
                                          min="0"
                                          max="100"
                                          value={currentVal}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setSharesMatrixData((prev) => ({
                                              ...prev,
                                              [u.id]: val,
                                            }));
                                          }}
                                          required
                                          className="w-24 p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-xs text-right text-[#163323] focus:outline-none focus:border-[#1B3B2B] focus:bg-white"
                                        />
                                        <span className="p-2 bg-[#EFE9DB] border border-l-0 border-[#DCD4C0] font-mono font-bold text-xs text-[#163323]">
                                          %
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-[#FAF8F5] border-t border-[#DDD5BF] flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSharesMatrixModalOpen(false)}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-4 h-4 text-[#BFA270]" />
                  <span>Guardar Matriz de Acciones en la Nube</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CustomDialogModal
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type || 'warning'}
        confirmText={dialogState.confirmText || 'Aceptar'}
        cancelText={dialogState.cancelText || 'Cancelar'}
        onConfirm={dialogState.onConfirm}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
