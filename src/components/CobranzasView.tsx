import React, { useState, useEffect, useRef } from 'react';
import { User, TrustSettings, FeeCollection, OwnerFeeAllocation, DistributionMode, RecurrenceType, PaymentStatus } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import { CustomDialogModal } from './CustomDialogModal';
import {
  DollarSign,
  CreditCard,
  Calendar,
  PieChart,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Upload,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  Building,
  ArrowRight,
  Edit3,
  Trash2,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  X,
  Wallet,
} from 'lucide-react';

interface CobranzasViewProps {
  currentUser: User;
  users: User[];
  settings: TrustSettings;
  isAdmin: boolean;
}

export const CobranzasView: React.FC<CobranzasViewProps> = ({
  currentUser,
  users,
  settings,
  isAdmin,
}) => {
  const [feeCollections, setFeeCollections] = useState<FeeCollection[]>([]);
  const collectionsRequestRef = useRef(0);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'active' | 'completed' | 'my_pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);

  // Copy Feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<FeeCollection | null>(null);
  const [dialog, setDialog] = useState<{
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

  // Bank Details Editing Modal (Admin)
  const [isEditBankModalOpen, setIsEditBankModalOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    cbu: settings.cbu || '',
    aliasBancario: settings.aliasBancario || '',
    cuitFideicomiso: settings.cuitFideicomiso || '',
    bancoNombre: settings.bancoNombre || '',
    titularCuenta: settings.titularCuenta || 'Fideicomiso Estancia El Desayuno',
  });

  useEffect(() => {
    setBankFormData({
      cbu: settings.cbu || '',
      aliasBancario: settings.aliasBancario || '',
      cuitFideicomiso: settings.cuitFideicomiso || '',
      bancoNombre: settings.bancoNombre || '',
      titularCuenta: settings.titularCuenta || 'Fideicomiso Estancia El Desayuno',
    });
  }, [settings]);

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await storageService.saveSettingsAsync({
      ...settings,
      cbu: bankFormData.cbu.trim(),
      aliasBancario: bankFormData.aliasBancario.trim(),
      cuitFideicomiso: bankFormData.cuitFideicomiso.trim(),
      bancoNombre: bankFormData.bancoNombre.trim(),
      titularCuenta: bankFormData.titularCuenta.trim(),
    });
    setIsEditBankModalOpen(false);
  };

  // Payment Recording Modal
  const [recordPaymentState, setRecordPaymentState] = useState<{
    open: boolean;
    collectionId: string;
    userAllocation: OwnerFeeAllocation | null;
  }>({
    open: false,
    collectionId: '',
    userAllocation: null,
  });

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash' | 'check' | 'mercadopago' | 'other'>('transfer');
  const [paidAtDate, setPaidAtDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingVoucher, setIsUploadingVoucher] = useState(false);

  // Load collections
  const loadCollections = async () => {
    const requestId = ++collectionsRequestRef.current;
    const fresh = await storageService.fetchFeesFromDatabase();
    // Si hubo otra consulta después, ignoramos esta respuesta anterior.
    if (requestId === collectionsRequestRef.current && Array.isArray(fresh)) {
      setFeeCollections(fresh);
    }
  };

  useEffect(() => {
    loadCollections();
    const unsub = storageService.subscribe(loadCollections);
    return () => unsub();
  }, []);

  // Copy helper
  const handleCopyText = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Helper calculation for equal cabezas, equal owners, and share percentage
  const calculateAllocationsForMode = (
    mode: DistributionMode,
    total: number,
    allUsers: User[],
    customPercentages?: Record<string, number>,
    customAmounts?: Record<string, number>
  ): OwnerFeeAllocation[] => {
    const activeUsers = allUsers.filter((u) => u.active !== false);
    if (activeUsers.length === 0) return [];

    if (mode === 'share_percentage') {
      // Divided according to co-owner's registered % de acciones / participación in profile
      const registeredShares = activeUsers.map((user) => Math.max(0, Number(user.sharePercentage) || 0));
      const totalRegisteredShares = registeredShares.reduce((sum, share) => sum + share, 0);
      return activeUsers.map((m, index) => {
        const pct = totalRegisteredShares > 0
          ? (registeredShares[index] / totalRegisteredShares) * 100
          : (100 / activeUsers.length);
        const assigned = index === activeUsers.length - 1
          ? Math.round((total - activeUsers.slice(0, -1).reduce((sum, _user, priorIndex) => {
              const priorPct = totalRegisteredShares > 0
                ? (registeredShares[priorIndex] / totalRegisteredShares) * 100
                : (100 / activeUsers.length);
              return sum + Math.round((total * (priorPct / 100)) * 100) / 100;
            }, 0)) * 100) / 100
          : Math.round((total * (pct / 100)) * 100) / 100;
        return {
          userId: m.id,
          userName: m.name,
          partName: m.partName,
          cabezaNumber: m.cabezaNumber,
          percentage: Math.round(pct * 10000) / 10000,
          assignedAmount: assigned,
          paidAmount: 0,
          status: 'pending',
        };
      });
    } else if (mode === 'equal_cabezas') {
      // Divided into 4 Cabezas equal parts (25% per Cabeza)
      // Group users by cabezaNumber (1, 2, 3, 4)
      const cabezaGroups: Record<number, User[]> = { 1: [], 2: [], 3: [], 4: [] };
      activeUsers.forEach((u) => {
        const cNum = u.cabezaNumber || 1;
        if (!cabezaGroups[cNum]) cabezaGroups[cNum] = [];
        cabezaGroups[cNum].push(u);
      });

      const allocations: OwnerFeeAllocation[] = [];
      const cabezasCount = 4;
      const amountPerCabeza = total / cabezasCount;
      const percentagePerCabeza = 100 / cabezasCount;

      [1, 2, 3, 4].forEach((cNum) => {
        const members = cabezaGroups[cNum] || [];
        if (members.length > 0) {
          const amountPerMember = Math.round((amountPerCabeza / members.length) * 100) / 100;
          const pctPerMember = Math.round((percentagePerCabeza / members.length) * 10000) / 10000;

          members.forEach((m) => {
            allocations.push({
              userId: m.id,
              userName: m.name,
              partName: m.partName,
              cabezaNumber: m.cabezaNumber,
              percentage: pctPerMember,
              assignedAmount: amountPerMember,
              paidAmount: 0,
              status: 'pending',
            });
          });
        }
      });
      return allocations;
    } else if (mode === 'equal_owners') {
      // Divided in N equal parts
      const N = activeUsers.length;
      const amountPerOwner = Math.round((total / N) * 100) / 100;
      const pctPerOwner = Math.round((100 / N) * 10000) / 10000;

      return activeUsers.map((m) => ({
        userId: m.id,
        userName: m.name,
        partName: m.partName,
        cabezaNumber: m.cabezaNumber,
        percentage: pctPerOwner,
        assignedAmount: amountPerOwner,
        paidAmount: 0,
        status: 'pending',
      }));
    } else if (mode === 'percentage') {
      return activeUsers.map((m) => {
        const pct = customPercentages?.[m.id] || 0;
        const assigned = Math.round((total * (pct / 100)) * 100) / 100;
        return {
          userId: m.id,
          userName: m.name,
          partName: m.partName,
          cabezaNumber: m.cabezaNumber,
          percentage: pct,
          assignedAmount: assigned,
          paidAmount: 0,
          status: 'pending',
        };
      });
    } else {
      // custom_amount
      return activeUsers.map((m) => {
        const assigned = customAmounts?.[m.id] || 0;
        const pct = total > 0 ? Math.round((assigned / total) * 10000) / 100 : 0;
        return {
          userId: m.id,
          userName: m.name,
          partName: m.partName,
          cabezaNumber: m.cabezaNumber,
          percentage: pct,
          assignedAmount: assigned,
          paidAmount: 0,
          status: 'pending',
        };
      });
    }
  };

  // Open Payment Recording Modal
  const handleOpenRecordPayment = (collectionId: string, alloc: OwnerFeeAllocation) => {
    setRecordPaymentState({
      open: true,
      collectionId,
      userAllocation: alloc,
    });
    setPaymentAmount(alloc.assignedAmount);
    setPaymentStatus(alloc.status === 'pending' ? 'paid' : alloc.status);
    setPaymentMethod(alloc.paymentMethod || 'transfer');
    setPaidAtDate(alloc.paidAt || new Date().toISOString().split('T')[0]);
    setPaymentNotes(alloc.notes || '');
    setReceiptUrl(alloc.receiptUrl || '');
  };

  // Save Payment
  const handleSavePaymentRecord = async () => {
    if (!recordPaymentState.userAllocation) return;

    const saved = await storageService.updateOwnerAllocationStatus(
      recordPaymentState.collectionId,
      recordPaymentState.userAllocation.userId,
      {
        assignedAmount: recordPaymentState.userAllocation.assignedAmount,
        paidAmount: paymentAmount,
        status: paymentStatus,
        paidAt: paidAtDate,
        paymentMethod,
        notes: paymentNotes,
        receiptUrl,
      }
    );

    if (!saved) {
      setDialog({
        isOpen: true,
        title: 'Pago no guardado',
        message: 'La base de datos no confirmó el pago. La pantalla conserva el estado confirmado.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    await loadCollections();
    setRecordPaymentState({ open: false, collectionId: '', userAllocation: null });
  };

  // Upload Voucher / Receipt
  const handleVoucherFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVoucher(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await r2Service.uploadPhoto(base64, `voucher-${Date.now()}-${file.name}`, 'comprobantes');
        if (res.success && res.url) {
          setReceiptUrl(res.url);
        } else {
          setReceiptUrl(base64);
        }
      } catch {
        setReceiptUrl(base64);
      } finally {
        setIsUploadingVoucher(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const isDueThisMonth = (collection: FeeCollection) => collection.dueDate?.slice(0, 7) === currentMonthKey;
  const myCollectionsThisMonth = feeCollections.filter((collection) =>
    isDueThisMonth(collection) && collection.allocations.some((allocation) => allocation.userId === currentUser.id)
  );
  const collectionsInScope = isAdmin ? feeCollections : myCollectionsThisMonth;

  // Los copropietarios solo ven su cuota vigente del mes, nunca cuotas futuras de otros perfiles.
  const filteredCollections = collectionsInScope.filter((c) => {
    // Search
    const matchesSearch =
      c.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.allocations.some((a) => a.userName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Category
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;

    // Active Tab Filter
    if (activeTabFilter === 'active') return c.status === 'active';
    if (activeTabFilter === 'completed') return c.status === 'completed';
    if (activeTabFilter === 'my_pending') {
      return c.allocations.some(
        (a) => a.userId === currentUser.id && (a.status === 'pending' || a.status === 'overdue' || a.status === 'partial')
      );
    }

    return true;
  });

  // Calculate Metrics
  const totalCollectionsAmount = collectionsInScope.reduce((sum, collection) => {
    if (isAdmin) return sum + collection.totalAmount;
    const myAllocation = collection.allocations.find((allocation) => allocation.userId === currentUser.id);
    return sum + (myAllocation?.assignedAmount || 0);
  }, 0);
  const totalCollectedAmount = collectionsInScope.reduce((sum, collection) => {
    if (isAdmin) return sum + collection.allocations.reduce((allocSum, allocation) => allocSum + (allocation.paidAmount || 0), 0);
    const myAllocation = collection.allocations.find((allocation) => allocation.userId === currentUser.id);
    return sum + (myAllocation?.paidAmount || 0);
  }, 0);
  const totalPendingAmount = totalCollectionsAmount - totalCollectedAmount;
  const overallCollectionProgress = totalCollectionsAmount > 0
    ? Math.round((totalCollectedAmount / totalCollectionsAmount) * 100)
    : 100;

  // My pending fees summary
  const myPendingAllocations = myCollectionsThisMonth.flatMap((c) =>
    c.allocations
      .filter((a) => a.userId === currentUser.id && a.status !== 'paid')
      .map((a) => ({ collection: c, allocation: a }))
  );
  const myTotalPending = myPendingAllocations.reduce((sum, item) => sum + (item.allocation.assignedAmount - item.allocation.paidAmount), 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[10px] font-bold uppercase tracking-wider">
                Fideicomiso El Desayuno
              </span>
              <span className="text-xs font-medium text-[#637568]">● Módulo de Cobranzas y Expensas</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#163323]"
              style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Gestión de Cobranzas y Gastos
            </h1>
            <p className="text-xs sm:text-sm text-[#46574B] mt-1 max-w-2xl">
              Control transparente de expensas ordinarias, fondos extraordinarios y servicios. Distribución de cuotas por Cabezas o partes en partes iguales o proporcionales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingCollection(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#BFA270]" />
                <span>+ Nueva Cobranza</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CBU & Bank Account Box */}
      <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#163323] uppercase tracking-wider">
              Datos Bancarios para Transferencias de Cuotas
            </p>
            <p className="text-xs text-[#56685B] mt-0.5">
              Titular: <span className="font-semibold text-[#163323]">{settings.titularCuenta || 'Fideicomiso Estancia El Desayuno'}</span>
              {settings.cuitFideicomiso && <span className="ml-2">• CUIT: <span className="font-mono">{settings.cuitFideicomiso}</span></span>}
              {settings.bancoNombre && <span className="ml-2">• Banco: <span className="font-semibold text-[#163323]">{settings.bancoNombre}</span></span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {isAdmin && (
            <button
              onClick={() => setIsEditBankModalOpen(true)}
              className="px-3 py-1.5 bg-[#F4EFE6] border border-[#DDD5BF] hover:border-[#1B3B2B] text-xs font-semibold text-[#163323] flex items-center gap-1 transition-colors cursor-pointer"
              title="Editar CBU, Alias y datos de la cuenta"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Editar Datos</span>
            </button>
          )}

          {settings.cbu && (
            <button
              onClick={() => handleCopyText(settings.cbu!, 'cbu')}
              className="px-3 py-1.5 bg-white border border-[#DDD5BF] hover:border-[#1B3B2B] text-xs font-mono font-medium text-[#163323] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copiar CBU al portapapeles"
            >
              {copiedField === 'cbu' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-sans font-bold">¡CBU Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>CBU: {settings.cbu}</span>
                </>
              )}
            </button>
          )}

          {settings.aliasBancario && (
            <button
              onClick={() => handleCopyText(settings.aliasBancario!, 'alias')}
              className="px-3 py-1.5 bg-[#1B3B2B] text-[#FAF8F5] hover:bg-[#132A1F] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copiar ALIAS Bancario"
            >
              {copiedField === 'alias' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-sans font-bold">¡Alias Copiado!</span>
                </>
              ) : (
                <>
                  <Wallet className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>ALIAS: {settings.aliasBancario}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#637568] font-semibold uppercase tracking-wider mb-2">
            <span>{isAdmin ? 'Total Emitido' : 'Mi cuota del mes'}</span>
            <DollarSign className="w-4 h-4 text-[#163323]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#163323]">
            ${totalCollectionsAmount.toLocaleString()} <span className="text-xs font-sans text-[#7A8E7E]">ARS</span>
          </div>
          <p className="text-[11px] text-[#7A8E7E] mt-1">
            {isAdmin
              ? `${feeCollections.length} cobranzas registradas`
              : `${collectionsInScope.length} cuota(s) vigente(s) en ${currentMonthKey}`}
          </p>
        </div>

        <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold uppercase tracking-wider mb-2">
            <span>{isAdmin ? 'Recaudado / Cobrado' : 'Mis pagos registrados'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">
            ${totalCollectedAmount.toLocaleString()} <span className="text-xs font-sans text-emerald-600">ARS</span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-600 h-full transition-all duration-500"
              style={{ width: `${overallCollectionProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold uppercase tracking-wider mb-2">
            <span>{isAdmin ? 'Pendiente de Cobro' : 'Pendiente este mes'}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700">
            ${totalPendingAmount.toLocaleString()} <span className="text-xs font-sans text-amber-600">ARS</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">
            {isAdmin ? `${100 - overallCollectionProgress}% por cobrar` : `${100 - overallCollectionProgress}% de mi cuota mensual`}
          </p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#163323] font-semibold uppercase tracking-wider mb-2">
            <span>{isAdmin ? 'Mi Estado Personal' : 'Mi próxima obligación'}</span>
            <Users className="w-4 h-4 text-[#BFA270]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#163323]">
            {myTotalPending > 0 ? (
              <span className="text-amber-700">${myTotalPending.toLocaleString()} ARS</span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <Check className="w-5 h-5 text-emerald-600" /> $0 (Al día)
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#637568] mt-1">
            {myPendingAllocations.length > 0
              ? `${myPendingAllocations.length} cuota(s) pendiente(s) este mes`
              : 'Sin cuotas pendientes este mes'}
          </p>
        </div>
      </div>

      {/* Main Filter & Search Toolbar */}
      <div className="bg-white border border-[#E3DFC8] p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Navigation Filter Tabs */}
        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTabFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'all'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#56685B] hover:bg-[#F4EFE6]'
            }`}
          >
            Todas ({collectionsInScope.length})
          </button>
          <button
            onClick={() => setActiveTabFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'active'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#56685B] hover:bg-[#F4EFE6]'
            }`}
          >
            En Curso ({collectionsInScope.filter((c) => c.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'completed'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#56685B] hover:bg-[#F4EFE6]'
            }`}
          >
            Completadas ({collectionsInScope.filter((c) => c.status === 'completed').length})
          </button>
          <button
            onClick={() => setActiveTabFilter('my_pending')}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
              activeTabFilter === 'my_pending'
                ? 'bg-[#2563EB] text-white'
                : 'text-blue-800 hover:bg-blue-50'
            }`}
          >
            Mis Cuotas Pendientes ({myPendingAllocations.length})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-[#7A8E7E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por concepto o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
          >
            <option value="all">Todas las Categorías</option>
            {storageService.getFeeCategories().map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fee Collections Accordion List */}
      <div className="space-y-4">
        {filteredCollections.length === 0 ? (
          <div className="bg-white border border-[#E3DFC8] p-8 text-center">
            <CreditCard className="w-10 h-10 text-[#BFA270] mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-[#163323]">No se encontraron cobranzas registradas</p>
            <p className="text-xs text-[#637568] mt-1">
              Pruebe ajustando los filtros de búsqueda o cree una nueva emisión de cobranza.
            </p>
          </div>
        ) : (
          filteredCollections.map((collection) => {
            const isExpanded = expandedCollectionId === collection.id;
            const collectedAmount = collection.allocations.reduce((sum, a) => sum + (a.paidAmount || 0), 0);
            const myAlloc = collection.allocations.find((a) => a.userId === currentUser.id);
            const visibleAllocations = isAdmin ? collection.allocations : (myAlloc ? [myAlloc] : []);
            const displayedAmount = isAdmin ? collection.totalAmount : (myAlloc?.assignedAmount || 0);
            const displayedCollected = isAdmin ? collectedAmount : (myAlloc?.paidAmount || 0);
            const progressPct = displayedAmount > 0 ? Math.round((displayedCollected / displayedAmount) * 100) : 0;
            const paidCount = collection.allocations.filter((a) => a.status === 'paid').length;

            // Recurrence Badge
            const getRecurrenceLabel = (rec: RecurrenceType, days?: number) => {
              switch (rec) {
                case 'monthly':
                  return 'Mensual (Cada 30 días)';
                case 'days_45':
                  return 'Cada 45 días';
                case 'days_60':
                  return 'Cada 60 días';
                case 'custom_days':
                  return `Personalizado: Cada ${days || 30} días`;
                case 'one_time':
                  return 'Pago Único / Extraordinario';
                default:
                  return 'Periódico';
              }
            };

            // Distribution Mode Badge
            const getDistributionLabel = (mode: DistributionMode) => {
              switch (mode) {
                case 'share_percentage':
                  return '% Acciones del Perfil (Cuota Social)';
                case 'equal_cabezas':
                  return 'Por Cabezas (4 partes)';
                case 'equal_owners':
                  return 'Partes Iguales por Copropietario (1/15)';
                case 'percentage':
                  return 'Porcentual Asignado';
                case 'custom_amount':
                  return 'Monto Fijo Individual';
                default:
                  return mode;
              }
            };

            return (
              <div
                key={collection.id}
                className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden transition-all"
              >
                {/* Collection Summary Header */}
                <div className="p-4 bg-white hover:bg-[#FAF8F5] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E3DFC8]">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[10px] font-bold uppercase tracking-wider">
                        {storageService.getFeeCategories().find((c) => c.id === collection.category)?.name || collection.category.replace('_', ' ')}
                      </span>

                      <span className="px-2 py-0.5 bg-[#F4EFE6] border border-[#DDD5BF] text-[10px] font-bold text-[#163323] flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 text-[#BFA270]" />
                        {getRecurrenceLabel(collection.recurrence, collection.customRecurrenceDays)}
                      </span>

                      <span className="px-2 py-0.5 bg-[#F4EFE6] border border-[#DDD5BF] text-[10px] font-medium text-[#56685B]">
                        {getDistributionLabel(collection.distributionMode)}
                      </span>

                      {collection.installmentsCount && collection.installmentsCount > 1 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 font-mono text-[10px] font-bold rounded">
                          Cuota {collection.installmentNumber || 1} de {collection.installmentsCount}
                        </span>
                      )}

                      {(isAdmin ? collection.status === 'completed' : myAlloc?.status === 'paid') ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                          100% Cobrado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                          {isAdmin ? `En Cobranza (${progressPct}%)` : `Mi cuota pendiente (${progressPct}%)`}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#163323]">
                      {collection.concept}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#637568]">
                      <span>Emisión: <strong className="text-[#163323] font-mono">{collection.issueDate}</strong></span>
                      <span>Vencimiento: <strong className="text-[#163323] font-mono">{collection.dueDate}</strong></span>
                      {collection.notes && <span className="italic text-[#7A8E7E]">"{collection.notes}"</span>}
                    </div>
                  </div>

                  {/* Financial Breakdown Summary */}
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E3DFC8]">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A8E7E]">{isAdmin ? 'Monto Total' : 'Mi cuota'}</div>
                      <div className="text-lg font-bold font-mono text-[#163323]">
                        ${displayedAmount.toLocaleString()} {collection.currency}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-medium">
                        ${displayedCollected.toLocaleString()} {isAdmin ? 'cobrados' : 'pagados por mí'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A8E7E]">{isAdmin ? 'Copropietarios' : 'Mi porcentaje'}</div>
                      <div className="text-sm font-bold text-[#163323]">
                        {isAdmin ? `${paidCount} / ${collection.allocations.length} al día` : `${(myAlloc?.percentage || 0).toFixed(4)}%`}
                      </div>
                      <div className="text-[11px] text-amber-700 font-medium">
                        {isAdmin ? `${collection.allocations.length - paidCount} pendientes` : `$${Math.max(0, displayedAmount - displayedCollected).toLocaleString()} pendiente`}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {myAlloc && myAlloc.status !== 'paid' && (
                        <button
                          onClick={() => handleOpenRecordPayment(collection.id, myAlloc)}
                          className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Informar Mi Pago (${(myAlloc.assignedAmount - myAlloc.paidAmount).toLocaleString()})</span>
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedCollectionId(isExpanded ? null : collection.id)}
                        className="px-3 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DB] border border-[#DDD5BF] text-xs font-bold text-[#163323] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Ocultar Detalle' : isAdmin ? 'Ver Padrón Completo' : 'Ver mi detalle'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setDialog({
                              isOpen: true,
                              title: 'Eliminar Orden de Cobranza',
                              message: '¿Está seguro de eliminar esta orden de cobranza y su registro de asignaciones?',
                              type: 'warning',
                              confirmText: 'Eliminar',
                              onConfirm: async () => {
                                const deleted = await storageService.deleteFeeCollection(collection.id);
                                if (deleted) {
                                  await loadCollections();
                                  return;
                                }
                                setDialog({
                                  isOpen: true,
                                  title: 'Cobranza no eliminada',
                                  message: 'La base de datos no confirmó la eliminación. El registro se mantiene visible.',
                                  type: 'alert',
                                  confirmText: 'Aceptar',
                                  onConfirm: () => {},
                                });
                              },
                            });
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Eliminar Cobranza"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-100 h-1">
                  <div
                    className="bg-[#1B3B2B] h-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Expanded Detail Table of All 15 Owners */}
                {isExpanded && (
                  <div className="p-4 bg-[#FAF8F5] border-t border-[#E3DFC8] space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#163323] uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#BFA270]" />
                        {isAdmin
                          ? `Padrón de Distribución y Estado de Pago Individual (${collection.allocations.length} Copropietarios)`
                          : 'Mi cuota y estado de pago'}
                      </h4>

                      <span className="text-[11px] text-[#637568]">
                        Modo de división: <strong>{getDistributionLabel(collection.distributionMode)}</strong>
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-[#E3DFC8] bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[11px]">
                          <tr>
                            <th className="py-2 px-3">Copropietario</th>
                            <th className="py-2 px-3">Cabeza / Parte</th>
                            <th className="py-2 px-3 text-right">% Asignado</th>
                            <th className="py-2 px-3 text-right">Monto Cuota ($)</th>
                            <th className="py-2 px-3 text-right">Monto Pagado ($)</th>
                            <th className="py-2 px-3 text-center">Estado</th>
                            <th className="py-2 px-3">Método / Fecha</th>
                            <th className="py-2 px-3 text-center">Comprobante</th>
                            <th className="py-2 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E3DFC8]">
                          {visibleAllocations.map((alloc) => {
                            const isMe = alloc.userId === currentUser.id;

                            return (
                              <tr
                                key={alloc.userId}
                                className={`hover:bg-[#FAF8F5] transition-colors ${
                                  isMe ? 'bg-amber-50/60 font-medium' : ''
                                }`}
                              >
                                <td className="py-2 px-3 font-semibold text-[#163323] flex items-center gap-1.5">
                                  <span>{alloc.userName}</span>
                                  {isMe && (
                                    <span className="px-1.5 py-0.2 bg-[#1B3B2B] text-white text-[9px] uppercase rounded">
                                      Tú
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[#56685B]">{alloc.partName}</td>
                                <td className="py-2 px-3 text-right font-mono text-[#56685B]">
                                  {alloc.percentage.toFixed(4)}%
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-[#163323]">
                                  ${alloc.assignedAmount.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                  ${alloc.paidAmount.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {alloc.status === 'paid' && (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
                                      Pagado
                                    </span>
                                  )}
                                  {alloc.status === 'pending' && (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full">
                                      Pendiente
                                    </span>
                                  )}
                                  {alloc.status === 'partial' && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-full">
                                      Parcial
                                    </span>
                                  )}
                                  {alloc.status === 'overdue' && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold uppercase rounded-full">
                                      Vencido
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[#637568] text-[11px]">
                                  {alloc.paidAt ? (
                                    <div>
                                      <span className="font-mono">{alloc.paidAt}</span>
                                      {alloc.paymentMethod && <span className="block text-[10px] uppercase text-[#7A8E7E]">{alloc.paymentMethod}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 italic">Sin fecha</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {alloc.receiptUrl ? (
                                    <a
                                      href={alloc.receiptUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center justify-center gap-1"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>Ver</span>
                                    </a>
                                  ) : (
                                    <span className="text-neutral-300">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {(isAdmin || isMe) && (
                                    <button
                                      onClick={() => handleOpenRecordPayment(collection.id, alloc)}
                                      className="px-2 py-1 bg-white border border-[#DDD5BF] hover:border-[#1B3B2B] text-[11px] font-semibold text-[#163323] transition-colors cursor-pointer"
                                    >
                                      {isAdmin ? 'Editar Pago' : 'Cargar Pago'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create or Edit Fee Collection */}
      {isCreateModalOpen && (
        <CreateFeeCollectionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          users={users}
          currentUser={currentUser}
          onSave={async (col) => storageService.saveFeeCollection(col)}
          calculateAllocationsForMode={calculateAllocationsForMode}
        />
      )}

      {/* Modal: Record / Update Payment Details */}
      {recordPaymentState.open && recordPaymentState.userAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setRecordPaymentState({ open: false, collectionId: '', userAllocation: null })}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold text-xs">
                $
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">
                  Registrar Pago de Cuota
                </h3>
                <p className="text-xs text-[#637568]">
                  Copropietario: <strong>{recordPaymentState.userAllocation.userName}</strong> ({recordPaymentState.userAllocation.partName})
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Transfer Details Card for easy copy */}
              <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-[#E3DFC8] pb-1.5">
                  <span className="font-bold text-[#163323] text-[11px] uppercase tracking-wider flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-[#BFA270]" />
                    Datos para Transferencia
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsEditBankModalOpen(true)}
                      className="text-[10px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
                    >
                      Editar CBU / Alias
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-[#46574B] space-y-1">
                  <p>
                    Titular: <strong>{settings.titularCuenta || 'Fideicomiso Estancia El Desayuno'}</strong>
                    {settings.cuitFideicomiso && <span className="ml-1">• CUIT: {settings.cuitFideicomiso}</span>}
                  </p>
                  {settings.bancoNombre && <p>Banco: <strong>{settings.bancoNombre}</strong></p>}
                </div>

                {settings.cbu && (
                  <div className="flex items-center justify-between text-[11px] bg-white p-2 border border-[#DDD5BF]">
                    <span>CBU: <strong className="font-mono text-[#163323]">{settings.cbu}</strong></span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(settings.cbu!, 'modal_cbu')}
                      className="text-[10px] font-bold text-[#1B3B2B] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'modal_cbu' ? (
                        <span className="text-emerald-700 font-bold">¡Copiado!</span>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#BFA270]" />
                          <span>Copiar CBU</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {settings.aliasBancario && (
                  <div className="flex items-center justify-between text-[11px] bg-[#1B3B2B] text-white p-2">
                    <span>ALIAS: <strong className="font-mono text-[#FAF8F5]">{settings.aliasBancario}</strong></span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(settings.aliasBancario!, 'modal_alias')}
                      className="text-[10px] font-bold text-[#BFA270] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'modal_alias' ? (
                        <span className="text-emerald-300 font-bold">¡Copiado!</span>
                      ) : (
                        <>
                          <Wallet className="w-3 h-3 text-[#BFA270]" />
                          <span>Copiar Alias</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-[#FFFFFF] border border-[#DDD5BF] p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#637568]">Cuota Asignada:</span>
                  <span className="font-mono font-bold text-[#163323]">
                    ${recordPaymentState.userAllocation.assignedAmount.toLocaleString()} ARS
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637568]">Porcentaje de la Cobranza:</span>
                  <span className="font-mono text-[#56685B]">
                    {recordPaymentState.userAllocation.percentage.toFixed(4)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Monto Pagado ($ ARS)</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={paymentAmount || ''}
                  onChange={(e) => {
                    const valStr = e.target.value.replace(',', '.');
                    setPaymentAmount(parseFloat(valStr) || 0);
                  }}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-sm font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Estado de Pago</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-semibold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="paid">Pagado (100%)</option>
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Medio de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="transfer">Transferencia Bancaria</option>
                    <option value="cash">Efectivo</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="check">Cheque</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Fecha de Pago</label>
                <input
                  type="date"
                  value={paidAtDate}
                  onChange={(e) => setPaidAtDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Comprobante / Voucher (Foto o PDF)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#F4EFE6] transition-colors">
                    <Upload className="w-4 h-4 text-[#BFA270]" />
                    <span>{isUploadingVoucher ? 'Subiendo...' : 'Adjuntar Comprobante'}</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleVoucherFileUpload} className="hidden" />
                  </label>
                </div>
                {receiptUrl && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                    ✓ Comprobante cargado correctamente
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Notas o Referencia</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Nro de comprobante o referencia de transferencia..."
                  className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E3DFC8]">
                <button
                  onClick={() => setRecordPaymentState({ open: false, collectionId: '', userAllocation: null })}
                  className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePaymentRecord}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                >
                  Guardar Registro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Bank Details (Admin) */}
      {isEditBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-lg w-full p-6 shadow-xl relative">
            <button
              onClick={() => setIsEditBankModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
              <div className="w-8 h-8 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">Configurar Datos Bancarios de la Estancia</h3>
                <p className="text-xs text-[#637568]">Información visible para transferencias de cuotas y expensas.</p>
              </div>
            </div>

            <form onSubmit={handleSaveBankDetails} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#163323] mb-1">Titular de la Cuenta</label>
                <input
                  type="text"
                  value={bankFormData.titularCuenta}
                  onChange={(e) => setBankFormData({ ...bankFormData, titularCuenta: e.target.value })}
                  placeholder="Fideicomiso Estancia El Desayuno"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">CUIT del Fideicomiso</label>
                  <input
                    type="text"
                    value={bankFormData.cuitFideicomiso}
                    onChange={(e) => setBankFormData({ ...bankFormData, cuitFideicomiso: e.target.value })}
                    placeholder="30-71234567-8"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Banco / Entidad</label>
                  <input
                    type="text"
                    value={bankFormData.bancoNombre}
                    onChange={(e) => setBankFormData({ ...bankFormData, bancoNombre: e.target.value })}
                    placeholder="Banco Galicia"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">ALIAS Bancario *</label>
                <input
                  type="text"
                  required
                  value={bankFormData.aliasBancario}
                  onChange={(e) => setBankFormData({ ...bankFormData, aliasBancario: e.target.value })}
                  placeholder="EL.DESAYUNO.ESTANCIA"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono font-bold text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">CBU / CVU (22 dígitos) *</label>
                <input
                  type="text"
                  required
                  value={bankFormData.cbu}
                  onChange={(e) => setBankFormData({ ...bankFormData, cbu: e.target.value })}
                  placeholder="0070123420000012345678"
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono font-bold text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
                <button
                  type="button"
                  onClick={() => setIsEditBankModalOpen(false)}
                  className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                >
                  Guardar Datos Bancarios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CustomDialogModal
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type || 'confirm'}
        confirmText={dialog.confirmText || 'Aceptar'}
        cancelText={dialog.cancelText || 'Cancelar'}
        onConfirm={dialog.onConfirm}
        onClose={() => setDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// Sub-component for Creating Fee Collection
interface CreateFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User;
  onSave: (collection: FeeCollection) => Promise<boolean>;
  calculateAllocationsForMode: (
    mode: DistributionMode,
    total: number,
    allUsers: User[],
    customPercentages?: Record<string, number>,
    customAmounts?: Record<string, number>
  ) => OwnerFeeAllocation[];
}

const CreateFeeCollectionModal: React.FC<CreateFeeModalProps> = ({
  onClose,
  users,
  currentUser,
  onSave,
  calculateAllocationsForMode,
}) => {
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<FeeCollection['category']>('expensas_ordinarias');
  const [totalAmount, setTotalAmount] = useState<number>(1500000);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('monthly');
  const [customRecurrenceDays, setCustomRecurrenceDays] = useState<number>(45);
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('share_percentage');
  const [installmentsCount, setInstallmentsCount] = useState<number>(1); // 1, 2, 3, 6, 12, 24
  const [installmentInterestPercentage, setInstallmentInterestPercentage] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Custom percentages & amounts mapping
  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [dialog, setDialog] = useState<{
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

  const activeUsers = users.filter((u) => u.active !== false);

  const financingCharge = installmentsCount > 1
    ? Math.round((totalAmount * (installmentInterestPercentage / 100)) * 100) / 100
    : 0;
  const financedTotal = Math.round((totalAmount + financingCharge) * 100) / 100;
  const currentAmountPerInstallment = Math.round((financedTotal / Math.max(1, installmentsCount)) * 100) / 100;

  // Computed allocations for live preview
  const liveAllocations = calculateAllocationsForMode(
    distributionMode,
    currentAmountPerInstallment,
    activeUsers,
    customPercentages,
    customAmounts
  );

  const totalCalculatedPercentages = liveAllocations.reduce((s, a) => s + a.percentage, 0);
  const totalCalculatedAmounts = liveAllocations.reduce((s, a) => s + a.assignedAmount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept.trim()) {
      setDialog({
        isOpen: true,
        title: 'Campo Requerido',
        message: 'Por favor, ingrese un concepto claro para la cobranza.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    if (totalAmount <= 0) {
      setDialog({
        isOpen: true,
        title: 'Monto Inválido',
        message: 'El monto total debe ser mayor a cero.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    const createdCount = Math.max(1, installmentsCount);
    const baseDueDateObj = new Date(dueDate || Date.now());

    for (let i = 1; i <= createdCount; i++) {
      const issueDateObj = new Date(issueDate || Date.now());
      issueDateObj.setMonth(issueDateObj.getMonth() + (i - 1));
      const issueDateStr = issueDateObj.toISOString().split('T')[0];

      const dueDateObj = new Date(baseDueDateObj);
      dueDateObj.setMonth(dueDateObj.getMonth() + (i - 1));
      const dueDateStr = dueDateObj.toISOString().split('T')[0];

      const instSuffix = createdCount > 1 ? ` - Cuota ${i} de ${createdCount}` : '';

      const installmentAmount = i === createdCount
        ? Math.round((financedTotal - currentAmountPerInstallment * (createdCount - 1)) * 100) / 100
        : currentAmountPerInstallment;
      const allocations = calculateAllocationsForMode(
        distributionMode,
        installmentAmount,
        activeUsers,
        customPercentages,
        customAmounts
      ).map((allocation) => ({
        ...allocation,
        financingInterestPercentage: installmentInterestPercentage,
        baseInstallmentAmount: Math.round((totalAmount / createdCount) * 100) / 100,
      }));

      const newCollection: FeeCollection = {
        id: `fee-${Date.now()}-${i}`,
        concept: `${concept.trim()}${instSuffix}`,
        category,
        totalAmount: installmentAmount,
        currency,
        recurrence: createdCount > 1 ? 'monthly' : recurrence,
        customRecurrenceDays: recurrence === 'custom_days' ? customRecurrenceDays : undefined,
        issueDate: issueDateStr,
        dueDate: dueDateStr,
        distributionMode,
        allocations,
        status: 'active',
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        notes: `${notes.trim()}${installmentsCount > 1 ? `${notes.trim() ? '\n' : ''}Financiación: ${installmentInterestPercentage.toFixed(2)}% de recargo total ($${financingCharge.toLocaleString()} ARS).` : ''}`,
        installmentsCount: createdCount,
        installmentNumber: i,
      };

      const saved = await onSave(newCollection);
      if (!saved) {
        setDialog({
          isOpen: true,
          title: 'Cobranza no guardada',
          message: 'La base de datos no confirmó la emisión. No se mostrará como creada.',
          type: 'alert',
          confirmText: 'Aceptar',
          onConfirm: () => {},
        });
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white border border-[#E3DFC8] max-w-3xl w-full p-6 shadow-xl relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
          <div className="w-9 h-9 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#163323]">Nueva Emisión de Cobranza / Expensa</h2>
            <p className="text-xs text-[#637568]">Defina el monto total, periodicidad y forma de división entre los 15 copropietarios.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Concept and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#163323] mb-1">Concepto de la Cobranza *</label>
              <input
                type="text"
                required
                placeholder="Ej: Expensas Ordinarias Noviembre 2026 - Mantenimiento General"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#163323] mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              >
                {storageService.getFeeCategories().map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount, Currency, Installments and Recurrence */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#163323] mb-1">Monto Total a Cobrar *</label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-[#EFE9DB] border border-r-0 border-[#DDD5BF] font-mono font-bold text-[#163323]">
                  $
                </span>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={totalAmount || ''}
                  onChange={(e) => {
                    const valStr = e.target.value.replace(',', '.');
                    setTotalAmount(parseFloat(valStr) || 0);
                  }}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-sm font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#163323] mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="ARS">ARS ($ Pesos)</option>
                <option value="USD">USD ($ Dólares)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#163323] mb-1">Periodicidad</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="monthly">Mensual (Cada 30 días)</option>
                <option value="days_45">Cada 45 Días</option>
                <option value="days_60">Cada 60 Días</option>
                <option value="custom_days">Personalizar Días</option>
                <option value="one_time">Pago Único / Extraordinario</option>
              </select>
            </div>
          </div>

          {/* Plan de Pago en Cuotas */}
          <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2">
            <div className="flex justify-between items-center font-bold text-[#163323]">
              <span>Plan de Pago en Cuotas Mensuales:</span>
              <span className="font-mono text-[#1B3B2B] font-bold bg-white px-2 py-0.5 border border-[#DDD5BF] text-xs">
                {installmentsCount} {installmentsCount === 1 ? 'Cuota (Única)' : 'Cuotas Mensuales'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 6, 12, 24].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setInstallmentsCount(count)}
                  className={`px-3 py-1 font-mono font-bold text-xs border transition-colors cursor-pointer ${
                    installmentsCount === count
                      ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                      : 'bg-white text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                  }`}
                >
                  {count === 1 ? '1 Pago' : `${count} Cuotas`}
                </button>
              ))}
            </div>

            {installmentsCount > 1 && (
              <div className="bg-white p-2.5 border border-[#DDD5BF] space-y-2.5 text-[11px]">
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#E3DFC8]">
                  <label className="font-bold text-[#163323]">Recargo / interés total por financiación:</label>
                  <div className="flex items-center gap-1 border border-[#DDD5BF] px-2 py-1 bg-[#FAF8F5]">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={installmentInterestPercentage}
                      onChange={(e) => setInstallmentInterestPercentage(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 text-right font-mono font-bold text-xs bg-transparent focus:outline-none"
                    />
                    <span className="font-mono font-bold text-xs">%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637568]">Monto base:</span>
                  <strong className="font-mono text-[#163323]">${totalAmount.toLocaleString()} ARS</strong>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>Recargo por financiación:</span>
                  <strong className="font-mono">+${financingCharge.toLocaleString()} ARS</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#637568]">Monto por cuota:</span>
                  <strong className="font-mono text-[#163323]">${currentAmountPerInstallment.toLocaleString()} ARS / mes</strong>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Total financiado:</span>
                  <strong className="font-mono">${financedTotal.toLocaleString()} ARS</strong>
                </div>
              </div>
            )}
          </div>

          {/* Custom Days Input if custom_days selected */}
          {recurrence === 'custom_days' && (
            <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 flex items-center gap-3">
              <label className="font-bold text-[#163323]">Frecuencia de Cobro en Días:</label>
              <input
                type="number"
                min={1}
                max={365}
                value={customRecurrenceDays}
                onChange={(e) => setCustomRecurrenceDays(parseInt(e.target.value) || 30)}
                className="w-24 px-3 py-1 bg-white border border-[#DDD5BF] font-mono font-bold text-[#163323]"
              />
              <span className="text-xs text-[#637568]">Días entre cada cuota</span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#163323] mb-1">Fecha de Emisión</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-[#163323]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#163323] mb-1">Fecha Limite de Vencimiento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-[#163323]"
              />
            </div>
          </div>

          {/* Distribution Mode */}
          <div>
            <label className="block font-bold text-[#163323] mb-1">Modo de División entre Copropietarios *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setDistributionMode('share_percentage')}
                className={`p-2.5 border text-left transition-all cursor-pointer relative ${
                  distributionMode === 'share_percentage'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">% de Acciones</span>
                  <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase rounded ${
                    distributionMode === 'share_percentage' ? 'bg-[#BFA270] text-[#163323]' : 'bg-[#1B3B2B] text-[#FAF8F5]'
                  }`}>
                    Recomendado
                  </span>
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">Divide según el % de participación cargado en cada perfil de Ajustes.</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('equal_cabezas')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'equal_cabezas'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Por Cabezas (25%)</div>
                <div className="text-[10px] opacity-80 mt-0.5">Divide el monto en 4 partes iguales (Cabeza 1, 2, 3, 4) y prorratea.</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('equal_owners')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'equal_owners'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Igual por Socio</div>
                <div className="text-[10px] opacity-80 mt-0.5">Divide el monto en partes exactas iguales para todos los socios.</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('percentage')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'percentage'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">% Manual</div>
                <div className="text-[10px] opacity-80 mt-0.5">Permite ingresar un % ad-hoc para esta emisión.</div>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('custom_amount')}
                className={`p-2.5 border text-left transition-all cursor-pointer ${
                  distributionMode === 'custom_amount'
                    ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                    : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                }`}
              >
                <div className="font-bold text-xs">Monto Fijo</div>
                <div className="text-[10px] opacity-80 mt-0.5">Permite ingresar un importe en pesos exacto para cada uno.</div>
              </button>
            </div>
          </div>

          {/* Inputs for Custom Percentage or Custom Amount */}
          {distributionMode === 'percentage' && (
            <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center font-bold text-[#163323]">
                <span>Ajustar Porcentajes Individuales:</span>
                <span className={`font-mono text-xs ${Math.abs(totalCalculatedPercentages - 100) < 0.005 ? 'text-emerald-700' : 'text-red-600'}`}>
                  Suma Total: {totalCalculatedPercentages.toFixed(4)}% / 100%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-white p-1.5 border border-[#DDD5BF]">
                    <span className="text-[11px] font-semibold text-[#163323] truncate flex-1">{u.name}</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      value={customPercentages[u.id] ?? 0}
                      onChange={(e) => {
                        const valStr = e.target.value.replace(',', '.');
                        setCustomPercentages({ ...customPercentages, [u.id]: parseFloat(valStr) || 0 });
                      }}
                      className="w-16 px-1 py-0.5 font-mono text-right border border-[#DDD5BF]"
                    />
                    <span className="text-[10px] text-[#7A8E7E]">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {distributionMode === 'custom_amount' && (
            <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center font-bold text-[#163323]">
                <span>Ajustar Montos Individuales ($):</span>
                <span className={`font-mono text-xs ${totalCalculatedAmounts === totalAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Suma Montos: ${totalCalculatedAmounts.toLocaleString()} / ${totalAmount.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-white p-1.5 border border-[#DDD5BF]">
                    <span className="text-[11px] font-semibold text-[#163323] truncate flex-1">{u.name}</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={customAmounts[u.id] ?? 0}
                      onChange={(e) => {
                        const valStr = e.target.value.replace(',', '.');
                        setCustomAmounts({ ...customAmounts, [u.id]: parseFloat(valStr) || 0 });
                      }}
                      className="w-20 px-1 py-0.5 font-mono text-right border border-[#DDD5BF]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Calculated Breakdown Table Preview */}
          <div>
            <label className="block font-bold text-[#163323] mb-1">
              Previsualización de la Distribución Calculada ({liveAllocations.length} Copropietarios)
            </label>
            <div className="border border-[#E3DFC8] max-h-40 overflow-y-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1B3B2B] text-white font-mono text-[10px] sticky top-0">
                  <tr>
                    <th className="p-1.5">Copropietario</th>
                    <th className="p-1.5">Cabeza</th>
                    <th className="p-1.5 text-right">% Asignado</th>
                    <th className="p-1.5 text-right">Monto Cuota ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DFC8]">
                  {liveAllocations.map((alloc) => (
                    <tr key={alloc.userId} className="hover:bg-[#FAF8F5]">
                      <td className="p-1.5 font-semibold text-[#163323]">{alloc.userName}</td>
                      <td className="p-1.5 text-[#56685B]">{alloc.partName}</td>
                      <td className="p-1.5 text-right font-mono text-[#56685B]">{alloc.percentage.toFixed(4)}%</td>
                      <td className="p-1.5 text-right font-mono font-bold text-[#163323]">
                        ${alloc.assignedAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#163323] mb-1">Observaciones o Instrucciones</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales, número de cuenta de destino o instrucciones de pago..."
              className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
            >
              Emitir Cobranza
            </button>
          </div>
        </form>
      </div>
      <CustomDialogModal
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type || 'confirm'}
        confirmText={dialog.confirmText || 'Aceptar'}
        cancelText={dialog.cancelText || 'Cancelar'}
        onConfirm={dialog.onConfirm}
        onClose={() => setDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
