import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { CustomDialogModal } from './CustomDialogModal';
import {
  Users,
  Plus,
  Check,
  X,
  Palette,
  Shield,
  ShieldCheck,
  Award,
  Landmark,
  KeyRound,
  Info,
  Layers,
  Sparkles,
  CheckCircle2,
  Wrench,
  User as UserIcon,
} from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
  allUsers: User[];
  onSaveUser: (userData: {
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
  }) => Promise<boolean>;
}

// Preset color options for new Cabezas
const PRESET_COLORS = [
  { name: 'Rojo Carmesí', hex: '#DC2626' },
  { name: 'Verde Bosque', hex: '#16A34A' },
  { name: 'Azul Real', hex: '#2563EB' },
  { name: 'Ámbar Cálido', hex: '#D97706' },
  { name: 'Púrpura Imperial', hex: '#7C3AED' },
  { name: 'Verde Azulado', hex: '#0D9488' },
  { name: 'Índigo Profundo', hex: '#4F46E5' },
  { name: 'Rosa Salmón', hex: '#DB2777' },
  { name: 'Naranja Fuego', hex: '#EA580C' },
  { name: 'Gris Grafito', hex: '#475569' },
];

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  editingUser,
  allUsers,
  onSaveUser,
}) => {
  if (!isOpen) return null;

  // Extract unique existing Cabezas from users list
  const existingCabezasMap = new Map<
    string,
    {
      key: string;
      partName: string;
      cabezaNumber?: number;
      color: string;
      members: User[];
    }
  >();

  allUsers.forEach((u) => {
    const key = u.partName || (u.cabezaNumber ? `Cabeza ${u.cabezaNumber}` : 'Sin Cabeza');
    if (!existingCabezasMap.has(key)) {
      existingCabezasMap.set(key, {
        key,
        partName: u.partName || key,
        cabezaNumber: u.cabezaNumber,
        color: u.color || '#DC2626',
        members: [],
      });
    }
    existingCabezasMap.get(key)!.members.push(u);
  });

  const existingCabezasList = Array.from(existingCabezasMap.values());

  // Form State
  const [cabezaMode, setCabezaSelectionMode] = useState<'existing' | 'new' | 'none'>('existing');
  const [selectedCabezaKey, setSelectedCabezaKey] = useState<string>(
    existingCabezasList.length > 0 ? existingCabezasList[0].key : ''
  );
  const [independentColor, setIndependentColor] = useState<string>('#475569');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [annualQuotaDays, setAnnualQuotaDays] = useState<number | string>(30);
  const [sharePercentage, setSharePercentage] = useState<number | string>(6.25);
  const [customCabezaNumber, setCustomCabezaNumber] = useState<number | string>(1);
  const [role, setRole] = useState<UserRole>('owner');
  const [isCabezaDeEquipo, setIsCabezaDeEquipo] = useState<boolean>(false);
  const [isFiduciante, setIsFiduciante] = useState<boolean>(false);
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

  // New Cabeza Form State
  const [newPartName, setNewPartName] = useState('');
  const [newCabezaColor, setNewCabezaColor] = useState('#7C3AED');

  // Helper to generate random 6-character password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Populate data when editing or opening modal
  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email);
      setPhone(editingUser.phone || '');
      setPassword(editingUser.password || '');
      
      // Preserve 0 explicitly for annualQuotaDays
      setAnnualQuotaDays(
        typeof editingUser.annualQuotaDays === 'number'
          ? editingUser.annualQuotaDays
          : (editingUser.annualQuotaDays !== undefined && editingUser.annualQuotaDays !== null ? Number(editingUser.annualQuotaDays) : 30)
      );

      // Preserve 0 explicitly for sharePercentage
      setSharePercentage(
        typeof editingUser.sharePercentage === 'number' && !isNaN(editingUser.sharePercentage)
          ? editingUser.sharePercentage
          : (editingUser.sharePercentage !== undefined && editingUser.sharePercentage !== null ? Number(editingUser.sharePercentage) : 0)
      );

      setRole(editingUser.role || 'owner');
      setIsCabezaDeEquipo(Boolean(editingUser.isCabezaDeEquipo));
      setIsFiduciante(Boolean(editingUser.isFiduciante || editingUser.role === 'fiduciante'));

      const userCabNum = typeof editingUser.cabezaNumber === 'number' 
        ? editingUser.cabezaNumber 
        : (editingUser.cabezaNumber !== undefined && editingUser.cabezaNumber !== null ? Number(editingUser.cabezaNumber) : 0);
      setCustomCabezaNumber(userCabNum);

      // Check if user belongs to no cabeza (independent / Cabeza 0)
      if (
        userCabNum === 0 ||
        (editingUser.partName && (
          editingUser.partName.toLowerCase().includes('sin') ||
          editingUser.partName.toLowerCase().includes('independiente')
        ))
      ) {
        setCabezaSelectionMode('none');
        setIndependentColor(editingUser.color || '#475569');
      } else {
        // Check if editingUser's partName matches an existing Cabeza
        const matched = existingCabezasList.find(
          (c) => c.partName === editingUser.partName || c.key === editingUser.partName || (c.cabezaNumber !== undefined && c.cabezaNumber === userCabNum)
        );
        if (matched) {
          setCabezaSelectionMode('existing');
          setSelectedCabezaKey(matched.key);
        } else {
          setCabezaSelectionMode('new');
          setNewPartName(editingUser.partName);
          setNewCabezaColor(editingUser.color || '#7C3AED');
        }
      }
    } else {
      // New user default
      setName('');
      setEmail('');
      setPhone('');
      setPassword(generateRandomPassword());
      setAnnualQuotaDays(30);
      setRole('owner');
      setIsCabezaDeEquipo(false);
      setIsFiduciante(false);
      setIndependentColor('#475569');

      if (existingCabezasList.length > 0) {
        setCabezaSelectionMode('existing');
        setSelectedCabezaKey(existingCabezasList[0].key);
        setCustomCabezaNumber(existingCabezasList[0].cabezaNumber ?? 1);
        const membersCount = existingCabezasList[0].members.length;
        setSharePercentage(Math.round((25 / Math.max(1, membersCount + 1)) * 10000) / 10000);
      } else {
        setCabezaSelectionMode('new');
        setNewPartName('Cabeza 1');
        setNewCabezaColor('#DC2626');
        setCustomCabezaNumber(1);
        setSharePercentage(25);
      }
    }
  }, [editingUser]);

  // Selected Cabeza Details
  const activeSelectedCabeza = existingCabezasList.find((c) => c.key === selectedCabezaKey);

  // Compute final Cabeza parameters based on current mode & customCabezaNumber
  const effectiveCabezaNumber =
    cabezaMode === 'none'
      ? (customCabezaNumber !== '' && !isNaN(Number(customCabezaNumber)) ? Number(customCabezaNumber) : 0)
      : customCabezaNumber !== '' && !isNaN(Number(customCabezaNumber))
      ? Number(customCabezaNumber)
      : cabezaMode === 'existing'
      ? activeSelectedCabeza?.cabezaNumber ?? 1
      : existingCabezasList.length + 1;

  const effectivePartName =
    cabezaMode === 'none'
      ? (effectiveCabezaNumber === 0 ? 'Sin Grupo / Independiente' : `Grupo Independiente ${effectiveCabezaNumber}`)
      : cabezaMode === 'existing'
      ? activeSelectedCabeza?.partName || selectedCabezaKey || `Cabeza ${effectiveCabezaNumber}`
      : newPartName.trim() || `Cabeza ${effectiveCabezaNumber}`;

  const effectiveColor =
    cabezaMode === 'none'
      ? independentColor
      : cabezaMode === 'existing'
      ? activeSelectedCabeza?.color || '#DC2626'
      : newCabezaColor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setDialog({
        isOpen: true,
        title: 'Nombre Requerido',
        message: 'Por favor ingrese el nombre del copropietario.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }
    if (!email.trim()) {
      setDialog({
        isOpen: true,
        title: 'Email Requerido',
        message: 'Por favor ingrese el email de acceso.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    // Allow 0 explicitly for annualQuotaDays (e.g. Intendente or Admins or non-staying owners)
    const parsedQuota = annualQuotaDays === '' || isNaN(Number(annualQuotaDays)) ? 0 : Number(annualQuotaDays);

    // Allow 0 explicitly for sharePercentage (e.g. non-contributing administrative staff)
    const parsedShare = sharePercentage === '' || isNaN(Number(String(sharePercentage).replace(',', '.')))
      ? 0
      : Math.max(0, Math.round(Number(String(sharePercentage).replace(',', '.')) * 10000) / 10000);

    const saved = await onSaveUser({
      id: editingUser?.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      partName: effectivePartName,
      cabezaNumber: effectiveCabezaNumber,
      annualQuotaDays: parsedQuota,
      sharePercentage: parsedShare,
      color: effectiveColor,
      password: password.trim().toUpperCase() || generateRandomPassword(),
      role,
      isCabezaDeEquipo,
      isFiduciante,
    });

    if (!saved) {
      setDialog({
        isOpen: true,
        title: 'No se pudieron guardar los cambios',
        message: 'La base de datos no confirmó la actualización del copropietario.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-[#FFFFFF] w-full max-w-xl border border-[#DED7C2] shadow-2xl overflow-hidden flex flex-col my-8 max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#BFA270]" />
            <div>
              <h3
                className="text-base font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                {editingUser ? 'Modificar Ficha de Copropietario' : 'Alta de Nuevo Copropietario'}
              </h3>
              <p className="text-[11px] text-[#C9D6CC]">
                {editingUser
                  ? `Editando registro de ${editingUser.name}`
                  : 'Asigne a una Cabeza existente o cree una nueva parte indivisa'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Section 1: Datos Personales */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] pb-1.5 border-b border-[#EFEAE0] flex items-center gap-1.5">
              <span>1. Identificación del Copropietario</span>
            </h4>

            <div>
              <label className="block font-semibold uppercase text-[#35483A] mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                placeholder="ej. Carlos Alberto Gómez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-sm focus:outline-none focus:border-[#163323]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Email de Acceso *
                </label>
                <input
                  type="email"
                  placeholder="ej. carlos.gomez@eldesayuno.com.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none focus:border-[#163323]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Teléfono Móvil
                </label>
                <input
                  type="text"
                  placeholder="ej. +54 9 11 4589-3210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none focus:border-[#163323]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Cabeza / Grupo Assignment */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#EFEAE0]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#BFA270]" />
                <span>2. Asignación de Cabeza / Grupo</span>
              </h4>
            </div>

            {/* Selector Mode Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-[#F4EFE6] border border-[#DDD5BF]">
              <button
                type="button"
                onClick={() => setCabezaSelectionMode('existing')}
                className={`py-2 px-2.5 text-center font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  cabezaMode === 'existing'
                    ? 'bg-[#1B3B2B] text-white shadow-2xs'
                    : 'text-[#56685B] hover:text-[#163323]'
                }`}
              >
                ● Cabeza Existente
              </button>
              <button
                type="button"
                onClick={() => setCabezaSelectionMode('new')}
                className={`py-2 px-2.5 text-center font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  cabezaMode === 'new'
                    ? 'bg-[#1B3B2B] text-white shadow-2xs'
                    : 'text-[#56685B] hover:text-[#163323]'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>+ Nueva Cabeza</span>
              </button>
              <button
                type="button"
                onClick={() => setCabezaSelectionMode('none')}
                className={`py-2 px-2.5 text-center font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  cabezaMode === 'none'
                    ? 'bg-[#1B3B2B] text-white shadow-2xs'
                    : 'text-[#56685B] hover:text-[#163323]'
                }`}
              >
                <span>○ Sin Grupo (Independiente)</span>
              </button>
            </div>

            {/* Mode A: Select Existing Cabeza */}
            {cabezaMode === 'existing' && (
              <div className="space-y-3">
                <label className="block font-semibold text-[#35483A]">
                  Seleccione la Cabeza a la que pertenecerá este socio:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {existingCabezasList.map((cabeza) => {
                    const isSelected = selectedCabezaKey === cabeza.key;
                    return (
                      <div
                        key={cabeza.key}
                        onClick={() => setSelectedCabezaKey(cabeza.key)}
                        className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#F4F8F5] border-[#1B3B2B] ring-1 ring-[#1B3B2B] shadow-2xs'
                            : 'bg-[#FAF8F5] border-[#DCD4C0] hover:border-[#1B3B2B]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                              style={{ backgroundColor: cabeza.color }}
                            />
                            <span className="font-bold text-xs text-[#163323]">
                              {cabeza.partName}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          )}
                        </div>

                        <div className="text-[10px] text-[#637568]">
                          <span>
                            {cabeza.members.length}{' '}
                            {cabeza.members.length === 1 ? 'socio' : 'socios'}:
                          </span>
                          <span className="block font-medium text-[#163323] truncate mt-0.5">
                            {cabeza.members.map((m) => m.name.split(' ')[0]).join(', ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status Callout for Existing Cabeza */}
                {activeSelectedCabeza && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-xs"
                      style={{ backgroundColor: activeSelectedCabeza.color }}
                    />
                    <div>
                      <span className="font-bold block">
                        Adopta el color oficial de {activeSelectedCabeza.partName}
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        El socio compartirá las reservas, cupos y color identificador en el calendario.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cabeza Number direct configuration */}
            <div className="p-3 bg-[#FAF8F5] border border-[#DDD5BF] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block font-bold uppercase text-[#163323] text-xs">
                    Número de Cabeza / Grupo Asignado *
                  </label>
                  <p className="text-[11px] text-[#637568]">
                    Ingrese <strong>0</strong> si el copropietario es independiente y no pertenece a ningún grupo, o el número correspondiente (1, 2, 3, etc.).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={customCabezaNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomCabezaNumber(val);
                      if (val === '0' || Number(val) === 0) {
                        setCabezaSelectionMode('none');
                      }
                    }}
                    className="w-20 p-2 bg-white border border-[#DCD4C0] font-mono font-bold text-center text-sm text-[#163323] focus:outline-none focus:border-[#163323]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCabezaNumber(0);
                      setCabezaSelectionMode('none');
                    }}
                    className="px-2.5 py-2 bg-[#F4EFE6] hover:bg-[#EFE7D5] border border-[#DDD5BF] text-[11px] font-bold uppercase tracking-wider text-[#163323] cursor-pointer whitespace-nowrap"
                  >
                    Fijar en 0 (Sin Grupo)
                  </button>
                </div>
              </div>
            </div>

            {/* Mode B: Create New Cabeza */}
            {cabezaMode === 'new' && (
              <div className="p-4 bg-[#FAF8F5] border border-[#DDD5BF] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">
                      Nombre de la Nueva Cabeza *
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Cabeza 5 / Familia Gómez"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      required
                      className="w-full p-2.5 bg-white border border-[#DCD4C0] font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">
                      Color Asignado a la Cabeza
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newCabezaColor}
                        onChange={(e) => setNewCabezaColor(e.target.value)}
                        className="w-10 h-9 border cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={newCabezaColor}
                        onChange={(e) => setNewCabezaColor(e.target.value)}
                        className="w-full p-2 bg-white border border-[#DCD4C0] font-mono font-bold text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Color Palette Presets */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#637568] mb-1.5">
                    Paleta de Colores Recomendada:
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_COLORS.map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setNewCabezaColor(p.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                          newCabezaColor.toLowerCase() === p.hex.toLowerCase()
                            ? 'scale-125 border-[#163323] shadow-xs'
                            : 'border-white hover:scale-110'
                        }`}
                        style={{ backgroundColor: p.hex }}
                        title={p.name}
                      >
                        {newCabezaColor.toLowerCase() === p.hex.toLowerCase() && (
                          <Check className="w-3 h-3 text-white drop-shadow-xs" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>
                    Se registrará una nueva Cabeza (Cabeza #{customCabezaNumber}) en el Fideicomiso.
                  </span>
                </div>
              </div>
            )}

            {/* Mode C: Independent Co-owner (Sin Grupo / Sin Cabeza) */}
            {cabezaMode === 'none' && (
              <div className="p-4 bg-[#FAF8F5] border border-[#DDD5BF] space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Copropietario Independiente (Cabeza 0 - Sin Grupo)</strong>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Este copropietario participa del condominio individualmente con <strong>Cabeza 0</strong>, sin pertenecer a ninguna de las cabezas indivisas. Tiene su propio color en el calendario de reservas, gestiona sus propias estadías y participa según sus acciones.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Color Propio para el Calendario de Reservas
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={independentColor}
                      onChange={(e) => setIndependentColor(e.target.value)}
                      className="w-10 h-9 border cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={independentColor}
                      onChange={(e) => setIndependentColor(e.target.value)}
                      className="w-32 p-2 bg-white border border-[#DCD4C0] font-mono font-bold text-xs uppercase"
                    />
                    <span className="text-[11px] text-[#637568]">
                      Color identificador individual en el almanaque.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#637568] mb-1.5">
                    Paleta de Colores Sugerida:
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_COLORS.map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setIndependentColor(p.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                          independentColor.toLowerCase() === p.hex.toLowerCase()
                            ? 'scale-125 border-[#163323] shadow-xs'
                            : 'border-white hover:scale-110'
                        }`}
                        style={{ backgroundColor: p.hex }}
                        title={p.name}
                      >
                        {independentColor.toLowerCase() === p.hex.toLowerCase() && (
                          <Check className="w-3 h-3 text-white drop-shadow-xs" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Quota & Credentials */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] pb-1.5 border-b border-[#EFEAE0] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#BFA270]" />
              <span>3. Cupo de Estadía y Contraseña de Acceso</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Cupo Anual Asignado (Días)
                </label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={annualQuotaDays}
                  onChange={(e) => setAnnualQuotaDays(e.target.value)}
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-xs"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setAnnualQuotaDays(0)}
                    className="px-2 py-0.5 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    0 días (Sin Cupo / Directivo o Intendente)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnualQuotaDays(15)}
                    className="px-2 py-0.5 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    15 días
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnualQuotaDays(30)}
                    className="px-2 py-0.5 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    30 días (Estándar)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Contraseña de Acceso (6 Caracteres)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.toUpperCase())}
                    maxLength={6}
                    required
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-xs uppercase tracking-widest text-[#163323]"
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generateRandomPassword())}
                    className="px-2.5 py-2 bg-[#F4EFE6] border border-[#DDD5BF] hover:bg-[#EDE6D7] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-[#163323] cursor-pointer"
                    title="Generar nueva clave aleatoria"
                  >
                    Generar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: % Acciones / Aporte para División de Gastos y Cobros */}
          <div className="space-y-3 pt-2 bg-[#FAF8F5] p-3 border border-[#E3DFC8]">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#E8E2D2]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#1B3B2B] text-[#FAF8F5] flex items-center justify-center text-[10px] font-bold">%</span>
                <span>4. Porcentaje de Acciones / Aporte (% División de Gastos)</span>
              </h4>
              <span className="px-2 py-0.5 bg-[#EFE9DB] border border-[#DCD4C0] text-[10px] font-mono font-bold text-[#163323]">
                {Number(String(sharePercentage).replace(',', '.') || 0).toFixed(4)}% de Acciones
              </span>
            </div>

            <p className="text-[11px] text-[#55695B] leading-relaxed">
              Define qué proporción de las <strong>expensas, facturas de servicios y gastos reales</strong> se le imputarán a este socio al liquidar cobros.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5">
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  % de Participación / Acciones *
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={sharePercentage}
                    onChange={(e) => setSharePercentage(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono font-bold text-sm text-[#163323] focus:outline-none focus:border-[#1B3B2B]"
                  />
                  <span className="p-2.5 bg-[#EFE9DB] border border-l-0 border-[#DCD4C0] font-mono font-bold text-sm text-[#163323]">
                    %
                  </span>
                </div>
              </div>

              <div className="sm:col-span-7 space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#637568]">
                  Valores Rápidos:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSharePercentage(0)}
                    className="px-2 py-1 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    0.000% (Sin Acciones / Operativo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePercentage(25)}
                    className="px-2 py-1 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    25.000% (Cabeza completa)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePercentage(12.5)}
                    className="px-2 py-1 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    12.500% (2 socios)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePercentage(6.25)}
                    className="px-2 py-1 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    6.250% (4 socios)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePercentage(2.7778)}
                    className="px-2 py-1 bg-white hover:bg-[#F2EDE1] border border-[#DCD4C0] text-[10px] font-semibold text-[#163323] cursor-pointer"
                  >
                    2.7778% (9 socios / 25%)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Rol Societario & Privilegios Especiales */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] pb-1.5 border-b border-[#EFEAE0] flex items-center justify-between">
              <span>5. Rol Societario, Liderazgo & Privilegios Especiales</span>
              <span className="text-[10px] font-normal text-[#8C7A53]">3 Figuras Clave + Copropietarios</span>
            </h4>

            <div className="space-y-3 bg-[#FAF8F5] p-3.5 border border-[#DCD4C0]">
              <label className="block font-semibold uppercase text-[#35483A] text-xs">
                Seleccione la Figura o Rol en la Estancia / Fideicomiso:
              </label>

              {/* 4 Interactive Visual Role Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Administrador */}
                <div
                  onClick={() => {
                    setRole('admin');
                  }}
                  className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                    role === 'admin'
                      ? 'bg-[#163323] text-white border-[#BFA270] shadow-sm ring-1 ring-[#BFA270]'
                      : 'bg-white text-[#163323] border-[#DCD4C0] hover:border-[#163323]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded-xs ${role === 'admin' ? 'bg-[#E5C378]/20 text-[#E5C378]' : 'bg-[#163323]/10 text-[#163323]'}`}>
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <strong className="text-xs font-bold uppercase tracking-wide">
                        Administrador
                      </strong>
                    </div>
                    {role === 'admin' && (
                      <span className="text-[9px] font-mono font-bold bg-[#E5C378] text-[#163323] px-1.5 py-0.5 rounded-2xs">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${role === 'admin' ? 'text-[#FAF8F5]/90' : 'text-[#637568]'}`}>
                    Poder exclusivo de gestión financiera: Gastos, Cobranzas & Expensas, y Cajas y Cuentas Corrientes. Para turnos y estadías opera como copropietario.
                  </p>
                </div>

                {/* 2. Fiduciante */}
                <div
                  onClick={() => {
                    setRole('fiduciante');
                    setIsFiduciante(true);
                  }}
                  className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                    role === 'fiduciante'
                      ? 'bg-[#2E285F] text-white border-[#818CF8] shadow-sm ring-1 ring-[#818CF8]'
                      : 'bg-white text-[#163323] border-[#DCD4C0] hover:border-[#2E285F]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded-xs ${role === 'fiduciante' ? 'bg-[#818CF8]/25 text-[#C7D2FE]' : 'bg-[#2E285F]/10 text-[#2E285F]'}`}>
                        <Landmark className="w-4 h-4" />
                      </span>
                      <strong className="text-xs font-bold uppercase tracking-wide">
                        Fiduciante
                      </strong>
                    </div>
                    {role === 'fiduciante' && (
                      <span className="text-[9px] font-mono font-bold bg-[#818CF8] text-white px-1.5 py-0.5 rounded-2xs">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${role === 'fiduciante' ? 'text-indigo-100' : 'text-[#637568]'}`}>
                    Órgano Fiduciario Constitutivo: control institucional, acceso al Libro de Gastos, balances y consulta de actas societarias.
                  </p>
                </div>

                {/* 3. Intendente */}
                <div
                  onClick={() => {
                    setRole('intendente');
                  }}
                  className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                    role === 'intendente'
                      ? 'bg-[#0F766E] text-white border-[#5EEAD4] shadow-sm ring-1 ring-[#5EEAD4]'
                      : 'bg-white text-[#163323] border-[#DCD4C0] hover:border-[#0F766E]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded-xs ${role === 'intendente' ? 'bg-[#5EEAD4]/25 text-[#99F6E4]' : 'bg-[#0F766E]/10 text-[#0F766E]'}`}>
                        <Wrench className="w-4 h-4" />
                      </span>
                      <strong className="text-xs font-bold uppercase tracking-wide">
                        Intendente (100% Acceso)
                      </strong>
                    </div>
                    {role === 'intendente' && (
                      <span className="text-[9px] font-mono font-bold bg-[#5EEAD4] text-[#0F766E] px-1.5 py-0.5 rounded-2xs">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${role === 'intendente' ? 'text-teal-100' : 'text-[#637568]'}`}>
                    Único rol con acceso al 100% del sistema: Consola máster, mantenimiento, stock e inventario, novedades, caseros y ajustes.
                  </p>
                </div>

                {/* 4. Copropietario Ordinario */}
                <div
                  onClick={() => {
                    setRole('owner');
                  }}
                  className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                    role === 'owner'
                      ? 'bg-[#35483A] text-white border-[#BFA270] shadow-sm ring-1 ring-[#BFA270]'
                      : 'bg-white text-[#163323] border-[#DCD4C0] hover:border-[#35483A]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded-xs ${role === 'owner' ? 'bg-[#BFA270]/25 text-[#E5C378]' : 'bg-[#35483A]/10 text-[#35483A]'}`}>
                        <UserIcon className="w-4 h-4" />
                      </span>
                      <strong className="text-xs font-bold uppercase tracking-wide">
                        Copropietario
                      </strong>
                    </div>
                    {role === 'owner' && (
                      <span className="text-[9px] font-mono font-bold bg-[#E5C378] text-[#163323] px-1.5 py-0.5 rounded-2xs">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${role === 'owner' ? 'text-emerald-100' : 'text-[#637568]'}`}>
                    Socio del condominio con derecho a cupo anual de estadías, calendario de reservas y pago de expensas según sus acciones.
                  </p>
                </div>
              </div>

              {/* Designation Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-[#EFEAE0]">
                {cabezaMode !== 'none' ? (
                  <label className="flex items-start gap-2.5 p-2 bg-white border border-[#DDD5BF] hover:border-[#F59E0B] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isCabezaDeEquipo}
                      onChange={(e) => setIsCabezaDeEquipo(e.target.checked)}
                      className="mt-0.5 accent-[#F59E0B] w-4 h-4 cursor-pointer"
                    />
                    <div className="leading-snug">
                      <strong className="text-xs text-[#163323] flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Designar como Cabeza de Equipo (Líder del Grupo)</span>
                      </strong>
                      <span className="text-[11px] text-[#637568] block mt-0.5">
                        Otorga distintivo dorado especial en su perfil y habilita acceso directo al Libro de Gastos y las Actas de Asamblea.
                      </span>
                    </div>
                  </label>
                ) : (
                  <div className="p-2 bg-[#F3EFE6] border border-[#DDD5BF] text-[11px] text-[#637568] flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#8C7A53] shrink-0" />
                    <span>Los copropietarios independientes no forman parte de una cabeza, por lo que no aplica el liderazgo de cabeza.</span>
                  </div>
                )}

                <label className="flex items-start gap-2.5 p-2 bg-white border border-[#DDD5BF] hover:border-[#6366F1] cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={isFiduciante || role === 'fiduciante'}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsFiduciante(checked);
                      if (checked && role === 'owner') setRole('fiduciante');
                      if (!checked && role === 'fiduciante') setRole('owner');
                    }}
                    className="mt-0.5 accent-[#4F46E5] w-4 h-4 cursor-pointer"
                  />
                  <div className="leading-snug">
                    <strong className="text-xs text-[#163323] flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Investir con Atributo de Fiduciante Constitutivo</span>
                    </strong>
                    <span className="text-[11px] text-[#637568] block mt-0.5">
                      Otorga insignia fiduciaria y habilita acceso completo a Actas societarias notariales y Libro de Gastos.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Check className="w-4 h-4 text-[#BFA270]" />
              <span>{editingUser ? 'Guardar Cambios' : 'Registrar Copropietario'}</span>
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
