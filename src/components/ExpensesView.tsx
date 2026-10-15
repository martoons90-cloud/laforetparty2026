import React, { useState, useEffect } from 'react';
import { User, ExpenseItem, ExpenseCategory, TrustSettings, FeeCollection, OwnerFeeAllocation, DistributionMode } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import { CustomDialogModal } from './CustomDialogModal';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Calendar,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  Building2,
  ArrowRight,
  TrendingUp,
  Receipt,
  Tag,
  ShieldCheck,
  X,
  Send,
  PieChart,
  Users,
  Check,
  Eye,
  ExternalLink,
} from 'lucide-react';

// Automatic color palette generator for dynamic expenses and categories
export const EXPENSE_COLOR_PALETTES = [
  { name: 'emerald', bg: 'bg-emerald-50/90', text: 'text-emerald-900', border: 'border-emerald-200', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-900', badgeBorder: 'border-emerald-300', dot: 'bg-emerald-500', bar: 'border-l-emerald-500' },
  { name: 'blue', bg: 'bg-blue-50/90', text: 'text-blue-900', border: 'border-blue-200', badgeBg: 'bg-blue-100', badgeText: 'text-blue-900', badgeBorder: 'border-blue-300', dot: 'bg-blue-500', bar: 'border-l-blue-500' },
  { name: 'purple', bg: 'bg-purple-50/90', text: 'text-purple-900', border: 'border-purple-200', badgeBg: 'bg-purple-100', badgeText: 'text-purple-900', badgeBorder: 'border-purple-300', dot: 'bg-purple-500', bar: 'border-l-purple-500' },
  { name: 'amber', bg: 'bg-amber-50/90', text: 'text-amber-900', border: 'border-amber-200', badgeBg: 'bg-amber-100', badgeText: 'text-amber-900', badgeBorder: 'border-amber-300', dot: 'bg-amber-500', bar: 'border-l-amber-500' },
  { name: 'rose', bg: 'bg-rose-50/90', text: 'text-rose-900', border: 'border-rose-200', badgeBg: 'bg-rose-100', badgeText: 'text-rose-900', badgeBorder: 'border-rose-300', dot: 'bg-rose-500', bar: 'border-l-rose-500' },
  { name: 'teal', bg: 'bg-teal-50/90', text: 'text-teal-900', border: 'border-teal-200', badgeBg: 'bg-teal-100', badgeText: 'text-teal-900', badgeBorder: 'border-teal-300', dot: 'bg-teal-500', bar: 'border-l-teal-500' },
  { name: 'indigo', bg: 'bg-indigo-50/90', text: 'text-indigo-900', border: 'border-indigo-200', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-900', badgeBorder: 'border-indigo-300', dot: 'bg-indigo-500', bar: 'border-l-indigo-500' },
  { name: 'orange', bg: 'bg-orange-50/90', text: 'text-orange-900', border: 'border-orange-200', badgeBg: 'bg-orange-100', badgeText: 'text-orange-900', badgeBorder: 'border-orange-300', dot: 'bg-orange-500', bar: 'border-l-orange-500' },
  { name: 'cyan', bg: 'bg-cyan-50/90', text: 'text-cyan-900', border: 'border-cyan-200', badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-900', badgeBorder: 'border-cyan-300', dot: 'bg-cyan-500', bar: 'border-l-cyan-500' },
  { name: 'violet', bg: 'bg-violet-50/90', text: 'text-violet-900', border: 'border-violet-200', badgeBg: 'bg-violet-100', badgeText: 'text-violet-900', badgeBorder: 'border-violet-300', dot: 'bg-violet-500', bar: 'border-l-violet-500' },
  { name: 'sky', bg: 'bg-sky-50/90', text: 'text-sky-900', border: 'border-sky-200', badgeBg: 'bg-sky-100', badgeText: 'text-sky-900', badgeBorder: 'border-sky-300', dot: 'bg-sky-500', bar: 'border-l-sky-500' },
  { name: 'fuchsia', bg: 'bg-fuchsia-50/90', text: 'text-fuchsia-900', border: 'border-fuchsia-200', badgeBg: 'bg-fuchsia-100', badgeText: 'text-fuchsia-900', badgeBorder: 'border-fuchsia-300', dot: 'bg-fuchsia-500', bar: 'border-l-fuchsia-500' },
];

export function getAutoExpenseColor(strKey: string) {
  let hash = 0;
  const s = strKey || 'default';
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EXPENSE_COLOR_PALETTES.length;
  return EXPENSE_COLOR_PALETTES[index];
}

interface ExpensesViewProps {
  currentUser: User;
  settings: TrustSettings;
  isAdmin: boolean;
  onNavigateToCobranzas?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  currentUser,
  settings,
  isAdmin,
  onNavigateToCobranzas,
}) => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Modals
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
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

  // Form State
  const [expenseForm, setExpenseForm] = useState<{
    concept: string;
    category: ExpenseCategory;
    amount: number;
    currency: 'ARS' | 'USD';
    periodMonth: string;
    date: string;
    provider: string;
    invoiceNumber: string;
    userId: string;
    userName: string;
    partName: string;
    status: 'paid' | 'pending';
    paymentMethod: string;
    receiptUrl: string;
    notes: string;
  }>({
    concept: '',
    category: 'servicios',
    amount: 0,
    currency: 'ARS',
    periodMonth: '2026-10',
    date: new Date().toISOString().split('T')[0],
    provider: '',
    invoiceNumber: '',
    userId: '',
    userName: '',
    partName: '',
    status: 'paid',
    paymentMethod: 'transfer',
    receiptUrl: '',
    notes: '',
  });

  const [isUploadingBill, setIsUploadingBill] = useState(false);

  // Transfer Modal State
  const [transferTarget, setTransferTarget] = useState<'selected_expense' | 'all_period'>('all_period');
  const [selectedExpenseForTransfer, setSelectedExpenseForTransfer] = useState<ExpenseItem | null>(null);
  const [transferPercentage, setTransferPercentage] = useState<number>(100); // 100%, 75%, 50%, 25%, 10%, or custom
  const [installmentsCount, setInstallmentsCount] = useState<number>(1); // 1, 2, 3, 6, 12, 24
  const [installmentInterestPercentage, setInstallmentInterestPercentage] = useState<number>(0);
  const [transferDueDate, setTransferDueDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [transferDistributionMode, setTransferDistributionMode] = useState<DistributionMode>('share_percentage');
  const [transferCustomPercentages, setTransferCustomPercentages] = useState<Record<string, number>>({});
  const [transferCustomAmounts, setTransferCustomAmounts] = useState<Record<string, number>>({});
  const [transferSuccessMsg, setTransferSuccessMsg] = useState(false);
  const [isSharesBreakdownModalOpen, setIsSharesBreakdownModalOpen] = useState(false);

  const [feeCollections, setFeeCollections] = useState<FeeCollection[]>([]);
  const [viewingExpenseCollections, setViewingExpenseCollections] = useState<ExpenseItem | null>(null);

  const loadExpenses = async () => {
    const fresh = await storageService.fetchExpensesFromDatabase();
    if (fresh && Array.isArray(fresh)) {
      setExpenses(fresh);
    }
  };

  const loadFeeCollections = async () => {
    const fresh = await storageService.fetchFeesFromDatabase();
    if (Array.isArray(fresh)) {
      setFeeCollections(fresh);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadFeeCollections();
    const unsub = storageService.subscribe(() => {
      void loadExpenses();
      void loadFeeCollections();
    });
    return () => {
      unsub();
    };
  }, []);

  // Distinct Periods available in expenses
  const availablePeriods = Array.from(
    new Set(expenses.map((e) => e.periodMonth || '2026-10'))
  ).sort().reverse();

  if (!availablePeriods.includes('2026-10')) availablePeriods.unshift('2026-10');

  // Filtered Expenses
  const filteredExpenses = expenses.filter((exp) => {
    if (selectedPeriod !== 'all' && exp.periodMonth !== selectedPeriod) return false;
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && exp.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        exp.concept.toLowerCase().includes(q) ||
        (exp.provider && exp.provider.toLowerCase().includes(q)) ||
        (exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(q)) ||
        (exp.userName && exp.userName.toLowerCase().includes(q)) ||
        (exp.notes && exp.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Financial Metrics for Selected Period
  const periodTotalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const periodPaidAmount = filteredExpenses
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0);
  const periodPendingAmount = periodTotalAmount - periodPaidAmount;

  // Dynamic Expense Categories from Settings
  const expenseCategories = storageService.getExpenseCategories();

  // Breakdown per Category
  const categoryTotals: Record<string, number> = {};
  expenseCategories.forEach((cat) => {
    categoryTotals[cat.id] = 0;
  });

  filteredExpenses.forEach((e) => {
    if (categoryTotals[e.category] !== undefined) {
      categoryTotals[e.category] += e.amount;
    } else {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    }
  });

  // Projections
  const allCurrentUsers = storageService.getUsers().filter((u) => u.active !== false);
  const activeOwnersCount = allCurrentUsers.length || 1;
  const costPerCabeza = Math.round(periodTotalAmount / 4);
  const costPerOwner = Math.round(periodTotalAmount / activeOwnersCount);
  const mySharePct = currentUser?.sharePercentage ?? 6.25;
  const myEstimatedCost = Math.round((periodTotalAmount * (mySharePct / 100)) * 100) / 100;



  // Dynamic Category Badges
  const getCategoryBadge = (catId: string) => {
    const matched = expenseCategories.find((c) => c.id === catId);
    const label = matched ? matched.name : catId;
    const palette = getAutoExpenseColor(catId);
    return (
      <span className={`px-2 py-0.5 ${palette.badgeBg} ${palette.badgeText} ${palette.badgeBorder} border text-[10px] font-bold uppercase rounded inline-flex items-center gap-1.5 shadow-2xs`}>
        <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
        {label}
      </span>
    );
  };

  // Upload Bill / Factura Voucher
  const handleBillFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBill(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await r2Service.uploadPhoto(base64, `factura-${Date.now()}-${file.name}`, 'facturas');
        if (res.success && res.url) {
          setExpenseForm((prev) => ({ ...prev, receiptUrl: res.url! }));
        } else {
          setExpenseForm((prev) => ({ ...prev, receiptUrl: base64 }));
        }
      } catch {
        setExpenseForm((prev) => ({ ...prev, receiptUrl: base64 }));
      } finally {
        setIsUploadingBill(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Open Edit Expense
  const handleEditExpense = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setExpenseForm({
      concept: exp.concept,
      category: exp.category,
      amount: exp.amount,
      currency: exp.currency || 'ARS',
      periodMonth: exp.periodMonth || '2026-10',
      date: exp.date || new Date().toISOString().split('T')[0],
      provider: exp.provider || '',
      invoiceNumber: exp.invoiceNumber || '',
      userId: exp.userId || '',
      userName: exp.userName || '',
      partName: exp.partName || '',
      status: exp.status,
      paymentMethod: exp.paymentMethod || 'transfer',
      receiptUrl: exp.receiptUrl || '',
      notes: exp.notes || '',
    });
    setIsNewExpenseModalOpen(true);
  };

  // Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.concept.trim()) {
      setDialog({
        isOpen: true,
        title: 'Campo Requerido',
        message: 'Por favor, ingrese un concepto para el gasto.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    if (expenseForm.amount <= 0) {
      setDialog({
        isOpen: true,
        title: 'Monto Inválido',
        message: 'El monto del gasto debe ser mayor a cero.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    const foundUser = allCurrentUsers.find((u) => u.id === expenseForm.userId || u.name === expenseForm.userId);
    const finalUserId = foundUser ? foundUser.id : (expenseForm.userId || undefined);
    const finalUserName = foundUser ? foundUser.name : (expenseForm.userName || (expenseForm.userId ? expenseForm.userId : undefined));
    const finalPartName = foundUser ? foundUser.partName : (expenseForm.partName || undefined);

    const itemToSave: ExpenseItem = {
      id: editingExpense ? editingExpense.id : 'exp-' + Date.now(),
      concept: expenseForm.concept.trim(),
      category: expenseForm.category,
      amount: expenseForm.amount,
      currency: expenseForm.currency,
      periodMonth: expenseForm.periodMonth,
      date: expenseForm.date,
      provider: expenseForm.provider.trim(),
      invoiceNumber: expenseForm.invoiceNumber.trim() || undefined,
      userId: finalUserId,
      userName: finalUserName,
      partName: finalPartName,
      status: expenseForm.status,
      paymentMethod: expenseForm.paymentMethod,
      receiptUrl: expenseForm.receiptUrl,
      notes: expenseForm.notes.trim(),
      createdBy: currentUser.name,
      createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
    };

    const saved = await storageService.saveExpense(itemToSave);
    if (!saved) {
      setDialog({
        isOpen: true,
        title: 'No se pudo guardar',
        message: 'La base de datos no confirmó el gasto. No se aplicaron cambios.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }
    setIsNewExpenseModalOpen(false);
    setEditingExpense(null);
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    setDialog({
      isOpen: true,
      title: 'Eliminar Gasto',
      message: '¿Está seguro de eliminar este registro de gasto?',
      type: 'warning',
      confirmText: 'Eliminar',
      onConfirm: () => {
        void storageService.deleteExpense(id).then((deleted) => {
          if (!deleted) {
            setDialog({
              isOpen: true,
              title: 'No se pudo eliminar',
              message: 'La base de datos no confirmó la eliminación. El gasto sigue vigente.',
              type: 'alert',
              confirmText: 'Aceptar',
              onConfirm: () => {},
            });
          }
        });
      },
    });
  };

  // Calculate base amount and total to collect
  const currentBaseAmount =
    transferTarget === 'selected_expense' && selectedExpenseForTransfer
      ? selectedExpenseForTransfer.amount
      : periodTotalAmount;

  const currentTotalToCollect = Math.round((currentBaseAmount * (transferPercentage / 100)) * 100) / 100;
  const currentFinancingCharge = installmentsCount > 1
    ? Math.round((currentTotalToCollect * (installmentInterestPercentage / 100)) * 100) / 100
    : 0;
  const currentFinancedTotal = Math.round((currentTotalToCollect + currentFinancingCharge) * 100) / 100;
  const currentAmountPerInstallment = Math.round((currentFinancedTotal / Math.max(1, installmentsCount)) * 100) / 100;

  // Calculate allocations for transfer modal
  const calculateTransferAllocations = (amountToDistribute: number): OwnerFeeAllocation[] => {
    const activeUsers = storageService.getUsers().filter((u) => u.active !== false);
    if (activeUsers.length === 0) return [];

    if (transferDistributionMode === 'share_percentage') {
      const registeredShares = activeUsers.map((user) => Math.max(0, Number(user.sharePercentage) || 0));
      const totalRegisteredShares = registeredShares.reduce((sum, share) => sum + share, 0);
      return activeUsers.map((m) => {
        const index = activeUsers.findIndex((user) => user.id === m.id);
        // Si la matriz no suma exactamente 100, conservamos la proporción registrada
        // y normalizamos para que el total de la cuota nunca quede incompleto ni excedido.
        const pct = totalRegisteredShares > 0
          ? (registeredShares[index] / totalRegisteredShares) * 100
          : (100 / activeUsers.length);
        const assigned = index === activeUsers.length - 1
          ? Math.round((amountToDistribute - activeUsers.slice(0, -1).reduce((sum, user, priorIndex) => {
              const priorPct = totalRegisteredShares > 0
                ? (registeredShares[priorIndex] / totalRegisteredShares) * 100
                : (100 / activeUsers.length);
              return sum + Math.round((amountToDistribute * (priorPct / 100)) * 100) / 100;
            }, 0)) * 100) / 100
          : Math.round((amountToDistribute * (pct / 100)) * 100) / 100;
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
    } else if (transferDistributionMode === 'equal_cabezas') {
      const cabezaGroups: Record<number, User[]> = { 1: [], 2: [], 3: [], 4: [] };
      activeUsers.forEach((u) => {
        const cNum = u.cabezaNumber || 1;
        if (!cabezaGroups[cNum]) cabezaGroups[cNum] = [];
        cabezaGroups[cNum].push(u);
      });

      const allocations: OwnerFeeAllocation[] = [];
      const amountPerCabeza = amountToDistribute / 4;
      const pctPerCabeza = 100 / 4;

      for (let cNum = 1; cNum <= 4; cNum++) {
        const members = cabezaGroups[cNum] || [];
        if (members.length > 0) {
          const amtPerMember = Math.round((amountPerCabeza / members.length) * 100) / 100;
          const pctPerMember = Math.round((pctPerCabeza / members.length) * 10000) / 10000;
          members.forEach((m) => {
            allocations.push({
              userId: m.id,
              userName: m.name,
              partName: m.partName,
              cabezaNumber: m.cabezaNumber,
              percentage: pctPerMember,
              assignedAmount: amtPerMember,
              paidAmount: 0,
              status: 'pending',
            });
          });
        }
      }
      return allocations;
    } else if (transferDistributionMode === 'equal_owners') {
      const N = activeUsers.length;
      const amtPerOwner = Math.round((amountToDistribute / N) * 100) / 100;
      const pctPerOwner = Math.round((100 / N) * 10000) / 10000;
      return activeUsers.map((m) => ({
        userId: m.id,
        userName: m.name,
        partName: m.partName,
        cabezaNumber: m.cabezaNumber,
        percentage: pctPerOwner,
        assignedAmount: amtPerOwner,
        paidAmount: 0,
        status: 'pending',
      }));
    } else if (transferDistributionMode === 'percentage') {
      return activeUsers.map((m) => {
        const pct = transferCustomPercentages[m.id] ?? Math.round((100 / activeUsers.length) * 10000) / 10000;
        const assigned = Math.round((amountToDistribute * (pct / 100)) * 100) / 100;
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
        const assigned = transferCustomAmounts[m.id] ?? Math.round(amountToDistribute / activeUsers.length);
        const pct = amountToDistribute > 0 ? Math.round((assigned / amountToDistribute) * 10000) / 100 : 0;
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

  const liveTransferAllocations = calculateTransferAllocations(currentAmountPerInstallment);
  const liveTransferTotalPct = liveTransferAllocations.reduce((s, a) => s + a.percentage, 0);
  const liveTransferTotalAmt = liveTransferAllocations.reduce((s, a) => s + a.assignedAmount, 0);

  // TRANSFER TO COBRANZA (GENERATE FEE COLLECTION FROM MONTHLY EXPENSES OR INDIVIDUAL INVOICE)
  const handleTransferToCobranza = async () => {
    if (currentTotalToCollect <= 0) {
      setDialog({
        isOpen: true,
        title: 'Sin Monto a Cobrar',
        message: 'El monto total a cobrar debe ser mayor a cero.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    const formattedPeriodLabel = selectedPeriod === '2026-10' ? 'Octubre 2026' : selectedPeriod;
    const createdCount = Math.max(1, installmentsCount);
    const baseDueDateObj = new Date(transferDueDate || Date.now());

    for (let i = 1; i <= createdCount; i++) {
      const issueDateObj = new Date();
      issueDateObj.setMonth(issueDateObj.getMonth() + (i - 1));
      const issueDateStr = issueDateObj.toISOString().split('T')[0];

      const dueDateObj = new Date(baseDueDateObj);
      dueDateObj.setMonth(dueDateObj.getMonth() + (i - 1));
      const dueDateStr = dueDateObj.toISOString().split('T')[0];

      const instSuffix = createdCount > 1 ? ` - Cuota ${i} de ${createdCount}` : '';
      const pctSuffix = transferPercentage < 100 ? ` (${transferPercentage}% de $${currentBaseAmount.toLocaleString()})` : '';

      let conceptTitle = '';
      let notesDetail = '';

      if (transferTarget === 'selected_expense' && selectedExpenseForTransfer) {
        conceptTitle = `${selectedExpenseForTransfer.concept}${instSuffix}${pctSuffix}`;
        notesDetail = `Factura individual trasladada a cobranza (${transferPercentage}% en ${createdCount} cuotas).\nProveedor: ${selectedExpenseForTransfer.provider || 'S/D'}`;
      } else {
        conceptTitle = `Expensas Ordinarias ${formattedPeriodLabel}${instSuffix}${pctSuffix}`;
        notesDetail = `Gastos consolidados del mes (${transferPercentage}% en ${createdCount} cuotas):\n` +
          filteredExpenses.map((e) => `• ${e.concept}: $${e.amount.toLocaleString()} ARS`).join('\n');
      }

      const installmentAmount = i === createdCount
        ? Math.round((currentFinancedTotal - currentAmountPerInstallment * (createdCount - 1)) * 100) / 100
        : currentAmountPerInstallment;
      const allocations = calculateTransferAllocations(installmentAmount).map((allocation) => ({
        ...allocation,
        financingInterestPercentage: installmentInterestPercentage,
        baseInstallmentAmount: Math.round((currentTotalToCollect / createdCount) * 100) / 100,
      }));

      const newFeeCollection: FeeCollection = {
        id: `fee-exp-${Date.now()}-${i}`,
        concept: conceptTitle,
        category: 'expensas_ordinarias',
        totalAmount: installmentAmount,
        currency: 'ARS',
        recurrence: createdCount > 1 ? 'monthly' : 'one_time',
        issueDate: issueDateStr,
        dueDate: dueDateStr,
        distributionMode: transferDistributionMode,
        allocations,
        status: 'active',
        createdBy: `${currentUser.name} (Administración)`,
        createdAt: new Date().toISOString(),
        notes: `${notesDetail}${installmentsCount > 1 ? `\nFinanciación: ${installmentInterestPercentage.toFixed(2)}% de recargo total ($${currentFinancingCharge.toLocaleString()} ARS).` : ''}`,
        installmentsCount: createdCount,
        installmentNumber: i,
        transferredPercentage: transferPercentage,
        originalExpenseId: selectedExpenseForTransfer?.id,
      };

      const saved = await storageService.saveFeeCollection(newFeeCollection);
      if (!saved) {
        setDialog({
          isOpen: true,
          title: 'Cobranza no emitida',
          message: 'La base de datos no confirmó todas las cuotas. No se marcará el gasto como enviado.',
          type: 'alert',
          confirmText: 'Aceptar',
          onConfirm: () => {},
        });
        return;
      }
    }

    // Mark expenses transferred
    if (transferTarget === 'selected_expense' && selectedExpenseForTransfer) {
      const expenseSaved = await storageService.saveExpense({
        ...selectedExpenseForTransfer,
        transferredToFeeCollectionId: 'transferred-multi-' + Date.now(),
        transferredPercentage: transferPercentage,
        transferredInstallments: createdCount,
      });
      if (!expenseSaved) return;
    } else {
      for (const expense of filteredExpenses) {
        const expenseSaved = await storageService.saveExpense({
          ...expense,
          transferredToFeeCollectionId: 'transferred-multi-' + Date.now(),
          transferredPercentage: transferPercentage,
          transferredInstallments: createdCount,
        });
        if (!expenseSaved) return;
      }
    }

    const savedCollections = await storageService.fetchFeesFromDatabase();
    setFeeCollections(savedCollections);
    setTransferSuccessMsg(true);
    setTimeout(() => {
      setTransferSuccessMsg(false);
      setIsTransferModalOpen(false);
      if (onNavigateToCobranzas) onNavigateToCobranzas();
    }, 2000);
  };

  const getLinkedCollections = (exp: ExpenseItem) => feeCollections.filter(
    (collection) => collection.originalExpenseId === exp.id ||
      collection.id === exp.transferredToFeeCollectionId ||
      (!collection.originalExpenseId && collection.notes?.includes(exp.concept))
  );

  const getExpenseCollectionStatus = (exp: ExpenseItem) => {
    const matchingCollections = getLinkedCollections(exp);
    if (matchingCollections.length === 0) {
      return exp.transferredPercentage
        ? { label: `Enviado (${exp.transferredPercentage}%)`, color: 'bg-blue-100 text-blue-800 border border-blue-300' }
        : { label: 'Aún No', color: 'bg-neutral-100 text-neutral-600 border border-neutral-300' };
    }
    const totalEmitted = matchingCollections.reduce((sum, collection) => sum + collection.totalAmount, 0);
    const totalCollected = matchingCollections.reduce(
      (sum, collection) => sum + collection.allocations.reduce((allocSum, allocation) => allocSum + (Number(allocation.paidAmount) || 0), 0),
      0
    );
    const collectedPercentage = totalEmitted > 0 ? Math.round((totalCollected / totalEmitted) * 100) : 0;
    if (totalEmitted > 0 && totalCollected >= totalEmitted - 0.01) {
      return { label: 'Cobrado (100%)', color: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold' };
    } else if (totalCollected > 0) {
      return { label: `Cobrado (${collectedPercentage}%)`, color: 'bg-amber-100 text-amber-800 border border-amber-300' };
    } else {
      return { label: 'Pendiente Cobro', color: 'bg-indigo-100 text-indigo-800 border border-indigo-300' };
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white border border-[#E3DFC8] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[10px] font-bold uppercase tracking-wider">
                Administración Fiduciaria
              </span>
              <span className="text-xs font-medium text-[#637568]">● Libro de Gastos y Facturas</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#163323]"
              style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Gestor de Gastos y Costos Operativos
            </h1>
            <p className="text-xs sm:text-sm text-[#46574B] mt-1 max-w-2xl">
              Registro auditado de facturas de luz, sueldo de casero, mantenimiento de parque, impuestos e insumos. Cálculo automático del número mensual y traslado en 1-clic a Cobranzas de Expensas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => {
                    setEditingExpense(null);
                    setExpenseForm({
                      concept: '',
                      category: 'servicios',
                      amount: 0,
                      currency: 'ARS',
                      periodMonth: selectedPeriod === 'all' ? '2026-10' : selectedPeriod,
                      date: new Date().toISOString().split('T')[0],
                      provider: '',
                      invoiceNumber: '',
                      userId: '',
                      userName: '',
                      partName: '',
                      status: 'paid',
                      paymentMethod: 'transfer',
                      receiptUrl: '',
                      notes: '',
                    });
                    setIsNewExpenseModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#BFA270]" />
                  <span>+ Registrar Gasto / Factura</span>
                </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card 1: Total Gastos */}
        <div className="md:col-span-3 bg-white border border-[#E3DFC8] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#637568] font-bold uppercase tracking-wider mb-2">
            <span>Total Gastos ({selectedPeriod === 'all' ? 'Todos' : selectedPeriod})</span>
            <Receipt className="w-4 h-4 text-[#163323]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#163323]">
            ${periodTotalAmount.toLocaleString()} <span className="text-xs font-sans text-[#7A8E7E]">ARS</span>
          </div>
          <p className="text-[11px] text-[#7A8E7E] mt-1 font-medium">
            {filteredExpenses.length} facturas/gastos registrados
          </p>
        </div>

        {/* Card 2: Estado de Pago de Facturas */}
        <div className="md:col-span-3 bg-[#FAF8F5] border border-[#DDD5BF] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#163323] font-bold uppercase tracking-wider mb-2">
            <span>Estado de Pago de Facturas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-emerald-800">
              ${periodPaidAmount.toLocaleString()} pagados
            </div>
            {periodPendingAmount > 0 ? (
              <p className="text-xs text-amber-700 font-mono font-bold mt-1">
                ${periodPendingAmount.toLocaleString()} pendiente de pago
              </p>
            ) : (
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                ✓ Todas las facturas del mes están pagadas
              </p>
            )}
          </div>
          <span className="text-[10px] text-[#7A8E7E] block mt-1">
            Control de liquidación de proveedores
          </span>
        </div>

        {/* Card 3: Gastos por Categoría (Dinámico) */}
        <div className="md:col-span-6 bg-white border border-[#E3DFC8] p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#637568] font-bold uppercase tracking-wider mb-2">
            <span>Gastos por Categoría ({expenseCategories.length})</span>
            <Tag className="w-3.5 h-3.5 text-[#BFA270]" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs max-h-40 overflow-y-auto">
            {expenseCategories.map((cat) => {
              const total = categoryTotals[cat.id] || 0;
              const palette = getAutoExpenseColor(cat.id);
              return (
                <div key={cat.id} className={`p-2 ${palette.bg} ${palette.border} border border-l-4 ${palette.bar} flex flex-col justify-center transition-all hover:shadow-xs rounded-r`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${palette.dot} shrink-0`} />
                    <span className={`text-[10px] font-bold ${palette.text} truncate`} title={cat.name}>
                      {cat.name}
                    </span>
                  </div>
                  <span className={`font-mono text-xs font-bold ${palette.text} mt-1`}>
                    ${total.toLocaleString()} ARS
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Period Filter & Controls Bar */}
      <div className="bg-white border border-[#E3DFC8] p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-[#163323] uppercase tracking-wider whitespace-nowrap">
            Período:
          </span>
          {availablePeriods.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1 text-xs font-bold font-mono transition-colors cursor-pointer ${
                selectedPeriod === p
                  ? 'bg-[#1B3B2B] text-white'
                  : 'bg-[#FAF8F5] text-[#56685B] border border-[#DDD5BF] hover:bg-[#F4EFE6]'
              }`}
            >
              {p === '2026-10' ? 'Octubre 2026' : p === '2026-09' ? 'Septiembre 2026' : p}
            </button>
          ))}
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
              selectedPeriod === 'all'
                ? 'bg-[#1B3B2B] text-white'
                : 'bg-[#FAF8F5] text-[#56685B] border border-[#DDD5BF] hover:bg-[#F4EFE6]'
            }`}
          >
            Todos los Meses
          </button>
        </div>

        {/* Category & Search Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-[#7A8E7E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por concepto o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
          >
            <option value="all">Todas las Categorías</option>
            {expenseCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List Table */}
      <div className="bg-white border border-[#E3DFC8] shadow-xs overflow-hidden">
        <div className="p-3 bg-[#FAF8F5] border-b border-[#E3DFC8] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#163323] uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#BFA270]" />
            Detalle Auditado de Gastos del Fideicomiso ({filteredExpenses.length} Ítems)
          </h3>

          <span className="text-xs text-[#637568]">
            Suma Total: <strong className="font-mono text-[#163323]">${periodTotalAmount.toLocaleString()} ARS</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1B3B2B] text-[#FAF8F5] font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Fecha / Mes</th>
                <th className="py-2.5 px-3">Concepto del Gasto</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Proveedor / Entidad</th>
                <th className="py-2.5 px-3">Realizado por</th>
                <th className="py-2.5 px-3 text-right">Monto ($ ARS)</th>
                <th className="py-2.5 px-3 text-center">Estado Pago</th>
                <th className="py-2.5 px-3 text-center">Estado Cobro</th>
                <th className="py-2.5 px-3 text-center">Factura / Comprobante</th>
                {isAdmin && <th className="py-2.5 px-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DFC8]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#7A8E7E]">
                    No se encontraron registros de gastos para el período seleccionado.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const expPalette = getAutoExpenseColor(exp.id || exp.concept);
                  const linkedCollections = getLinkedCollections(exp);
                  return (
                    <tr key={exp.id} className={`hover:${expPalette.bg} transition-colors border-l-4 ${expPalette.bar}`}>
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[#56685B]">
                        {exp.date}
                        <span className="block text-[10px] text-[#7A8E7E]">Mes: {exp.periodMonth}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#163323]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2.5 h-2.5 rounded-full ${expPalette.dot} shrink-0 shadow-2xs`} title="Color automático del gasto" />
                          <span className="text-[#163323]">{exp.concept}</span>
                          {exp.invoiceNumber && (
                            <span className="px-1.5 py-0.5 bg-[#FAF8F5] text-[#163323] border border-[#DDD5BF] font-mono text-[10px] font-bold rounded shrink-0">
                              Factura N° {exp.invoiceNumber}
                            </span>
                          )}
                          {exp.transferredPercentage && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold font-mono rounded">
                              ✓ {exp.transferredPercentage}% enviados ({exp.transferredInstallments || 1} {exp.transferredInstallments === 1 ? 'cuota' : 'cuotas'})
                            </span>
                          )}
                        </div>
                        {exp.notes && <span className="block text-[10px] text-[#637568] font-normal italic pl-4">"{exp.notes}"</span>}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getCategoryBadge(exp.category)}
                      </td>
                      <td className="py-3 px-3 text-[#46574B]">
                        <div>
                          <span className="font-semibold text-[#163323]">{exp.provider || '-'}</span>
                          {exp.invoiceNumber && (
                            <span className="block font-mono text-[10px] font-bold text-[#56685B] mt-0.5">
                              N° {exp.invoiceNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#46574B]">
                        {exp.userName ? (
                          <div>
                            <span className="font-semibold text-[#163323]">{exp.userName}</span>
                            {exp.partName && <span className="block text-[10px] text-[#7A8E7E]">{exp.partName}</span>}
                          </div>
                        ) : (
                          <span className="text-[#7A8E7E] italic">Fideicomiso</span>
                        )}
                      </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#163323]">
                      ${exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {exp.status === 'paid' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
                          Pagado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {(() => {
                        const colStatus = getExpenseCollectionStatus(exp);
                        return (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${colStatus.color}`}>
                            {colStatus.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {exp.receiptUrl ? (
                        <a
                          href={exp.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center justify-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver Factura</span>
                        </a>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">Sin adjunto</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {linkedCollections.length > 0 && (
                            <button
                              onClick={() => setViewingExpenseCollections(exp)}
                              className="p-1 text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Ver cobranzas y cuotas vinculadas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedExpenseForTransfer(exp);
                              setTransferTarget('selected_expense');
                              setTransferPercentage(100);
                              setInstallmentsCount(1);
                              setInstallmentInterestPercentage(0);
                              setIsTransferModalOpen(true);
                            }}
                            className="px-2 py-1 bg-[#1B3B2B] hover:bg-[#132A1F] text-[#FAF8F5] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-xs cursor-pointer rounded"
                            title="Enviar esta factura individual a Cobranza"
                          >
                            <Send className="w-3 h-3 text-[#BFA270]" />
                            <span>Enviar a Cobranza</span>
                          </button>

                          <button
                            onClick={() => handleEditExpense(exp)}
                            className="p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
                            title="Editar gasto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-neutral-400 hover:text-red-700 cursor-pointer"
                            title="Eliminar gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New / Edit Expense */}
      {isNewExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-lg w-full p-6 shadow-xl relative">
            <button
              onClick={() => setIsNewExpenseModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
              <div className="w-8 h-8 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">
                  {editingExpense ? 'Modificar Gasto Registrado' : 'Registrar Nuevo Gasto / Factura'}
                </h3>
                <p className="text-xs text-[#637568]">Ingrese los detalles del gasto operativo del fideicomiso.</p>
              </div>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#163323] mb-1">Concepto del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Factura Luz EPEC Octubre / Sueldo Casero"
                  value={expenseForm.concept}
                  onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Categoría</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                  >
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Monto ($ ARS) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="150000.50"
                    value={expenseForm.amount || ''}
                    onChange={(e) => {
                      const valStr = e.target.value.replace(',', '.');
                      setExpenseForm({ ...expenseForm, amount: parseFloat(valStr) || 0 });
                    }}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Período / Mes (YYYY-MM)</label>
                  <input
                    type="text"
                    placeholder="2026-10"
                    value={expenseForm.periodMonth}
                    onChange={(e) => setExpenseForm({ ...expenseForm, periodMonth: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Fecha de Facturación / Pago</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              {/* Selector de quién realizó el gasto y Número de Factura */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAF8F5] p-2.5 border border-[#DDD5BF]">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">
                    👤 ¿Quién realizó / pagó el gasto?
                  </label>
                  <select
                    value={expenseForm.userId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const foundUser = allCurrentUsers.find((u) => u.id === selectedId);
                      setExpenseForm({
                        ...expenseForm,
                        userId: selectedId,
                        userName: foundUser ? foundUser.name : '',
                        partName: foundUser ? foundUser.partName : '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#DDD5BF] text-xs font-semibold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="">-- Fideicomiso / Fondo Común --</option>
                    {allCurrentUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.partName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">
                    🧾 Número de Factura / Comprobante
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 0001-0004812 o Factura B-84920"
                    value={expenseForm.invoiceNumber}
                    onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#DDD5BF] font-mono text-xs font-bold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Proveedor / Entidad</label>
                <input
                  type="text"
                  placeholder="Ej: EPEC, Telecom, Casero Ramón"
                  value={expenseForm.provider}
                  onChange={(e) => setExpenseForm({ ...expenseForm, provider: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163323] mb-1">Estado</label>
                  <select
                    value={expenseForm.status}
                    onChange={(e) => setExpenseForm({ ...expenseForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="paid">Pagado</option>
                    <option value="pending">Pendiente de Pago</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Medio de Pago</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="transfer">Transferencia Bancaria</option>
                    <option value="cash">Efectivo</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="check">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Adjuntar Factura / Comprobante (Imagen o PDF)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#F4EFE6] transition-colors">
                    <Upload className="w-4 h-4 text-[#BFA270]" />
                    <span>{isUploadingBill ? 'Subiendo factura...' : 'Cargar Comprobante / Factura'}</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleBillFileUpload} className="hidden" />
                  </label>
                </div>
                {expenseForm.receiptUrl && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
                    ✓ Adjunto guardado correctamente
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#163323] mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Detalles adicionales del comprobante..."
                  className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Expenses to Fee Collection */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-[#E3DFC8] max-w-xl w-full p-5 sm:p-6 shadow-xl relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-[#E3DFC8] pb-3">
              <div className="w-8 h-8 bg-[#BFA270] text-[#163323] rounded flex items-center justify-center font-bold">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">Emisión de Cobranza / Plan de Pago</h3>
                <p className="text-xs text-[#637568]">Configure la factura, el porcentaje a cobrar, cuotas mensuales y prorrateo entre socios.</p>
              </div>
            </div>

            {transferSuccessMsg ? (
              <div className="p-6 bg-emerald-50 border border-emerald-300 text-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold">¡Cobranza(s) Generada(s) Exitosamente!</p>
                <p className="text-xs">Se emitieron las cuotas requeridas y el plan de pago fue registrado en el módulo de Cobranzas.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* 1. Target Selector */}
                <div>
                  <label className="block font-bold text-[#163323] mb-1">1. Origen de los Gastos *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferTarget('all_period');
                        setSelectedExpenseForTransfer(null);
                      }}
                      className={`p-2 border text-left cursor-pointer transition-all ${
                        transferTarget === 'all_period'
                          ? 'bg-[#1B3B2B] text-white border-[#1B3B2B] font-bold'
                          : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                      }`}
                    >
                      <div className="text-xs font-bold">Todos los Gastos del Mes</div>
                      <div className="text-[10px] opacity-80 mt-0.5 font-mono">${periodTotalAmount.toLocaleString()} ARS</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTransferTarget('selected_expense');
                        if (!selectedExpenseForTransfer && filteredExpenses.length > 0) {
                          setSelectedExpenseForTransfer(filteredExpenses[0]);
                        }
                      }}
                      className={`p-2 border text-left cursor-pointer transition-all ${
                        transferTarget === 'selected_expense'
                          ? 'bg-[#1B3B2B] text-white border-[#1B3B2B] font-bold'
                          : 'bg-[#FAF8F5] text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                      }`}
                    >
                      <div className="text-xs font-bold">Factura Individual</div>
                      <div className="text-[10px] opacity-80 mt-0.5 truncate font-mono">
                        {selectedExpenseForTransfer ? `$${selectedExpenseForTransfer.amount.toLocaleString()} - ${selectedExpenseForTransfer.concept}` : 'Seleccionar factura...'}
                      </div>
                    </button>
                  </div>
                </div>

                {/* If selected_expense, show selector dropdown */}
                {transferTarget === 'selected_expense' && (
                  <div className="bg-[#FAF8F5] p-2.5 border border-[#DDD5BF] space-y-1">
                    <label className="block font-bold text-[#163323] text-[11px]">Seleccionar Factura / Gasto:</label>
                    <select
                      value={selectedExpenseForTransfer?.id || ''}
                      onChange={(e) => {
                        const found = filteredExpenses.find((ex) => ex.id === e.target.value);
                        setSelectedExpenseForTransfer(found || null);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DDD5BF] font-semibold text-xs text-[#163323] focus:outline-none"
                    >
                      {filteredExpenses.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.concept} — ${ex.amount.toLocaleString()} ARS ({ex.provider || 'S/D'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 2. Porcentaje o Monto Manual a Cobrar */}
                <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2.5">
                  <div className="flex justify-between items-center font-bold text-[#163323]">
                    <span className="text-xs">2. Porcentaje o Monto Manual a Cobrar de la Factura:</span>
                    <span className="font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 border border-[#DDD5BF] text-xs">
                      {transferPercentage.toFixed(2)}% ($ {currentTotalToCollect.toLocaleString()} ARS)
                    </span>
                  </div>

                  {/* Dual Manual Input Boxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2 border border-[#DDD5BF]">
                    <div>
                      <label className="block text-[10px] font-bold text-[#637568] mb-0.5">Monto Manual a Cobrar ($ ARS):</label>
                      <div className="flex items-center gap-1 border border-[#DDD5BF] px-2 py-1 bg-[#FAF8F5]">
                        <span className="font-mono font-bold text-[#163323] text-xs">$</span>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={currentBaseAmount || 99999999}
                          value={Math.round(currentTotalToCollect * 100) / 100}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (currentBaseAmount > 0) {
                              const calculatedPct = Math.min(100, Math.max(0, (val / currentBaseAmount) * 100));
                              setTransferPercentage(calculatedPct);
                            }
                          }}
                          className="w-full font-mono text-xs font-bold text-[#163323] bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#637568] mb-0.5">Porcentaje Manual (%):</label>
                      <div className="flex items-center gap-1 border border-[#DDD5BF] px-2 py-1 bg-[#FAF8F5]">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={100}
                          value={transferPercentage}
                          onChange={(e) => {
                            const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                            setTransferPercentage(pct);
                          }}
                          className="w-full font-mono text-xs font-bold text-[#163323] bg-transparent focus:outline-none"
                        />
                        <span className="font-mono font-bold text-[#163323] text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Shortcut Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-[#637568]">Atajos Rápidos:</span>
                    {[100, 75, 50, 25, 10].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTransferPercentage(pct)}
                        className={`px-2.5 py-0.5 font-mono font-bold text-[11px] border transition-colors cursor-pointer ${
                          Math.abs(transferPercentage - pct) < 0.1
                            ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                            : 'bg-white text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-[#637568] flex justify-between pt-1.5 border-t border-[#E3DFC8]">
                    <span>Valor Total Factura Original: <strong className="font-mono text-[#163323]">${currentBaseAmount.toLocaleString()} ARS</strong></span>
                    <span>Total a Emitir en Cobranza: <strong className="font-mono text-emerald-800 font-bold">${currentTotalToCollect.toLocaleString()} ARS</strong></span>
                  </div>
                </div>

                {/* 3. Installments / Plan de Pago Manual */}
                <div className="bg-[#FAF8F5] border border-[#DDD5BF] p-3 space-y-2.5">
                  <div className="flex justify-between items-center font-bold text-[#163323]">
                    <span className="text-xs">3. Plan de Pago en Cuotas Mensuales (Manual):</span>
                    <span className="font-mono text-[#1B3B2B] font-bold bg-white px-2 py-0.5 border border-[#DDD5BF] text-xs">
                      {installmentsCount} {installmentsCount === 1 ? 'Cuota (Pago Único)' : 'Cuotas Mensuales'}
                    </span>
                  </div>

                  {/* Manual Cuotas Number Input Box */}
                  <div className="flex items-center gap-3 bg-white p-2 border border-[#DDD5BF]">
                    <label className="text-[11px] font-bold text-[#163323]">Ingresar Cantidad de Cuotas:</label>
                    <div className="flex items-center gap-1 border border-[#DDD5BF] px-2 py-1 bg-[#FAF8F5]">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 font-mono text-xs font-bold text-center text-[#163323] bg-transparent focus:outline-none"
                      />
                      <span className="text-[10px] font-bold text-[#637568]">cuota(s)</span>
                    </div>

                    <div className="flex flex-wrap gap-1 ml-auto">
                      {[1, 2, 3, 6, 12, 24].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setInstallmentsCount(count)}
                          className={`px-2 py-0.5 font-mono font-bold text-[10px] border transition-colors cursor-pointer ${
                            installmentsCount === count
                              ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                              : 'bg-white text-[#163323] border-[#DDD5BF] hover:bg-[#F4EFE6]'
                          }`}
                        >
                          {count === 1 ? '1 Pago' : `${count} C.`}
                        </button>
                      ))}
                    </div>
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
                        <span className="text-[#637568]">Monto base a cobrar:</span>
                        <strong className="font-mono text-[#163323]">${currentTotalToCollect.toLocaleString()} ARS</strong>
                      </div>
                      <div className="flex justify-between text-amber-800">
                        <span>Recargo por financiación:</span>
                        <strong className="font-mono">+${currentFinancingCharge.toLocaleString()} ARS</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#637568]">Valor de cada cuota:</span>
                        <strong className="font-mono text-[#163323]">${currentAmountPerInstallment.toLocaleString()} ARS / mes</strong>
                      </div>
                      <div className="flex justify-between text-emerald-800">
                        <span>Total financiado a emitir:</span>
                        <strong className="font-mono">${currentFinancedTotal.toLocaleString()} ARS</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Modo de División */}
                <div>
                  <label className="block font-bold text-[#163323] mb-1">4. Modo de División entre Copropietarios *</label>
                  <select
                    value={transferDistributionMode}
                    onChange={(e) => setTransferDistributionMode(e.target.value as DistributionMode)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="share_percentage">Según % de Acciones del Perfil (Recomendado)</option>
                    <option value="equal_cabezas">Por Cabezas (4 partes iguales de 25%)</option>
                    <option value="equal_owners">Por Copropietario (Partes iguales 1/N)</option>
                    <option value="percentage">Porcentaje Personalizado Manual (% para cada socio)</option>
                    <option value="custom_amount">Monto Fijo Personalizado ($ para cada socio)</option>
                  </select>
                </div>

                {/* Tabla Interactiva de Previsualización y Edición Manual por Socio */}
                <div>
                  <label className="block font-bold text-[#163323] mb-1">
                    Previsualización / Asignación por Socio ({installmentsCount > 1 ? `Cuota Mensual (${installmentsCount} cuotas)` : 'Pago Único'})
                  </label>
                  <div className="border border-[#E3DFC8] max-h-48 overflow-y-auto bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1B3B2B] text-white font-mono text-[10px] sticky top-0">
                        <tr>
                          <th className="p-1.5">Copropietario</th>
                          <th className="p-1.5">Parte</th>
                          <th className="p-1.5 text-right">% Asignado</th>
                          <th className="p-1.5 text-right">Monto Cuota ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3DFC8]">
                        {liveTransferAllocations.map((alloc) => (
                          <tr key={alloc.userId} className="hover:bg-[#FAF8F5]">
                            <td className="p-1.5 font-semibold text-[#163323]">{alloc.userName}</td>
                            <td className="p-1.5 text-[#56685B] text-[11px]">{alloc.partName}</td>
                            <td className="p-1.5 text-right font-mono text-[#56685B]">
                              {transferDistributionMode === 'percentage' ? (
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  max={100}
                                  value={transferCustomPercentages[alloc.userId] ?? alloc.percentage}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setTransferCustomPercentages((prev) => ({ ...prev, [alloc.userId]: val }));
                                  }}
                                  className="w-16 px-1 py-0.5 border border-[#DDD5BF] font-mono text-xs text-right font-bold text-[#163323] focus:outline-none"
                                />
                              ) : (
                                `${alloc.percentage.toFixed(4)}%`
                              )}
                            </td>
                            <td className="p-1.5 text-right font-mono font-bold text-[#163323]">
                              {transferDistributionMode === 'custom_amount' ? (
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={transferCustomAmounts[alloc.userId] ?? alloc.assignedAmount}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setTransferCustomAmounts((prev) => ({ ...prev, [alloc.userId]: val }));
                                  }}
                                  className="w-24 px-1 py-0.5 border border-[#DDD5BF] font-mono text-xs text-right font-bold text-[#163323] focus:outline-none"
                                />
                              ) : (
                                `$${alloc.assignedAmount.toLocaleString()}`
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#163323] mb-1">Fecha de Vencimiento de la Primera Cuota</label>
                  <input
                    type="date"
                    value={transferDueDate}
                    onChange={(e) => setTransferDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] font-mono text-xs focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DFC8]">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 border border-[#DDD5BF] text-xs font-bold text-[#637568] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleTransferToCobranza}
                    className="px-5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>{installmentsCount > 1 ? `Emitir ${installmentsCount} Cuotas` : 'Emitir Cobranza Ahora'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {viewingExpenseCollections && (() => {
        const linkedCollections = getLinkedCollections(viewingExpenseCollections);
        const totalEmitted = linkedCollections.reduce((sum, collection) => sum + collection.totalAmount, 0);
        const totalCollected = linkedCollections.reduce(
          (sum, collection) => sum + collection.allocations.reduce((allocationSum, allocation) => allocationSum + (Number(allocation.paidAmount) || 0), 0),
          0
        );
        const totalPending = Math.max(0, totalEmitted - totalCollected);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white border border-[#E3DFC8] max-w-5xl w-full p-6 shadow-xl relative my-8 max-h-[90vh] flex flex-col">
              <button
                onClick={() => setViewingExpenseCollections(null)}
                className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-8 pb-4 border-b border-[#E3DFC8]">
                <h3 className="text-lg font-bold text-[#163323] flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-700" />
                  Cobranzas vinculadas al gasto
                </h3>
                <p className="text-xs text-[#637568] mt-1">
                  {viewingExpenseCollections.concept} {viewingExpenseCollections.invoiceNumber ? `· Factura ${viewingExpenseCollections.invoiceNumber}` : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 py-4 text-xs">
                <div className="border border-[#E3DFC8] bg-[#FAF8F5] p-3">
                  <span className="block text-[10px] uppercase font-bold text-[#637568]">Gasto original</span>
                  <strong className="font-mono text-base text-[#163323]">${viewingExpenseCollections.amount.toLocaleString()} ARS</strong>
                  <span className="block mt-1 text-[10px] text-[#637568]">Proveedor: {viewingExpenseCollections.status === 'paid' ? 'pagado' : 'pendiente'}</span>
                </div>
                <div className="border border-blue-200 bg-blue-50 p-3">
                  <span className="block text-[10px] uppercase font-bold text-blue-700">Emitido a cobrar</span>
                  <strong className="font-mono text-base text-blue-900">${totalEmitted.toLocaleString()} ARS</strong>
                  <span className="block mt-1 text-[10px] text-blue-700">{linkedCollections.length} {linkedCollections.length === 1 ? 'cuota' : 'cuotas'} vinculadas</span>
                </div>
                <div className="border border-emerald-200 bg-emerald-50 p-3">
                  <span className="block text-[10px] uppercase font-bold text-emerald-700">Cobrado de copropietarios</span>
                  <strong className="font-mono text-base text-emerald-900">${totalCollected.toLocaleString()} ARS</strong>
                  <span className="block mt-1 text-[10px] text-emerald-700">Importes de pago confirmados</span>
                </div>
                <div className="border border-amber-200 bg-amber-50 p-3">
                  <span className="block text-[10px] uppercase font-bold text-amber-800">Pendiente de cobro</span>
                  <strong className="font-mono text-base text-amber-900">${totalPending.toLocaleString()} ARS</strong>
                  <span className="block mt-1 text-[10px] text-amber-800">Sobre las cuotas emitidas</span>
                </div>
              </div>

              <div className="overflow-y-auto border border-[#E3DFC8]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1B3B2B] text-white font-mono text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2">Cobranza / cuota</th>
                      <th className="p-2">Vencimiento</th>
                      <th className="p-2 text-right">Emitido</th>
                      <th className="p-2 text-right">Cobrado</th>
                      <th className="p-2 text-right">Pendiente</th>
                      <th className="p-2 text-right">Copropietarios</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DFC8]">
                    {linkedCollections.map((collection) => {
                      const collected = collection.allocations.reduce((sum, allocation) => sum + (Number(allocation.paidAmount) || 0), 0);
                      const pending = Math.max(0, collection.totalAmount - collected);
                      const paidOwners = collection.allocations.filter((allocation) => (Number(allocation.paidAmount) || 0) >= allocation.assignedAmount - 0.01).length;
                      const financingRate = collection.allocations[0]?.financingInterestPercentage || 0;

                      return (
                        <tr key={collection.id} className="hover:bg-[#FAF8F5]">
                          <td className="p-2">
                            <strong className="block text-[#163323]">{collection.concept}</strong>
                            <span className="text-[10px] text-[#637568]">
                              Cuota {collection.installmentNumber || 1} de {collection.installmentsCount || 1}
                              {financingRate > 0 ? ` · Recargo ${financingRate.toFixed(2)}%` : ''}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-[#56685B]">{collection.dueDate || 'Sin fecha'}</td>
                          <td className="p-2 text-right font-mono font-bold text-[#163323]">${collection.totalAmount.toLocaleString()}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-800">${collected.toLocaleString()}</td>
                          <td className="p-2 text-right font-mono font-bold text-amber-800">${pending.toLocaleString()}</td>
                          <td className="p-2 text-right text-[#56685B]">{paidOwners} / {collection.allocations.length} al día</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Shares Breakdown Table */}
      {isSharesBreakdownModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white border border-[#E3DFC8] max-w-2xl w-full p-6 shadow-xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsSharesBreakdownModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3 border-b border-[#E3DFC8] pb-3 shrink-0">
              <div className="w-9 h-9 bg-[#1B3B2B] text-[#BFA270] rounded flex items-center justify-center font-bold">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">Reparto Teórico de Gastos según % de Acciones</h3>
                <p className="text-xs text-[#637568]">
                  Total a Distribuir ({selectedPeriod === 'all' ? 'Meses Acumulados' : selectedPeriod}):{' '}
                  <strong className="font-mono text-[#163323]">${periodTotalAmount.toLocaleString()} ARS</strong>
                </p>
              </div>
            </div>

            {/* My Share Banner */}
            {currentUser && (
              <div className="mb-3 p-3 bg-[#FAF8F5] border border-[#DDD5BF] flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#637568] block">Tu Participación Personal</span>
                  <span className="text-xs font-bold text-[#163323]">{currentUser.name} ({currentUser.partName})</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono font-bold text-[#BFA270] bg-[#1B3B2B] px-2 py-0.5 rounded">
                    {(currentUser.sharePercentage ?? 6.25).toFixed(4)}% de Acciones
                  </span>
                  <span className="block text-sm font-bold font-mono text-[#163323] mt-0.5">
                    ${Math.round((periodTotalAmount * ((currentUser.sharePercentage ?? 6.25) / 100))).toLocaleString()} ARS
                  </span>
                </div>
              </div>
            )}

            {/* Detailed Table */}
            <div className="overflow-y-auto flex-1 border border-[#E3DFC8] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1B3B2B] text-white font-mono text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2">Copropietario</th>
                    <th className="p-2">Parte / Cabeza</th>
                    <th className="p-2 text-right">% Acciones</th>
                    <th className="p-2 text-right">Gasto Imputable ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DFC8]">
                  {storageService.getUsers().filter((u) => u.active !== false).map((u) => {
                    const isMe = u.id === currentUser.id;
                    const pct = typeof u.sharePercentage === 'number' && u.sharePercentage > 0 ? u.sharePercentage : (100 / 15);
                    const amt = Math.round((periodTotalAmount * (pct / 100)) * 100) / 100;

                    return (
                      <tr key={u.id} className={`hover:bg-[#FAF8F5] transition-colors ${isMe ? 'bg-amber-50/70 font-semibold' : ''}`}>
                        <td className="p-2 flex items-center gap-1.5 text-[#163323]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: u.color }}
                          />
                          <span>{u.name}</span>
                          {isMe && <span className="text-[9px] px-1 py-0.2 bg-[#1B3B2B] text-white rounded">Tú</span>}
                        </td>
                        <td className="p-2 text-[#56685B]">{u.partName}</td>
                        <td className="p-2 text-right font-mono text-[#56685B]">{pct.toFixed(4)}%</td>
                        <td className="p-2 text-right font-mono font-bold text-[#163323]">
                          ${amt.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-[#E3DFC8] flex items-center justify-between shrink-0 mt-3">
              <p className="text-[11px] text-[#637568]">
                Los porcentajes de acciones se configuran en <strong>Ajustes &gt; Copropietarios &gt; Matriz de Acciones</strong>.
              </p>
              <button
                type="button"
                onClick={() => setIsSharesBreakdownModalOpen(false)}
                className="px-4 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
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
