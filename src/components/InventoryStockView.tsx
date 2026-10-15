import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryCategory, InventoryCondition, User, TrustSettings, isUserIntendente } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Home,
  UtensilsCrossed,
  Bed,
  Flame,
  Waves,
  Wrench,
  Shirt,
  Info,
  Layers,
  Camera,
  Upload,
} from 'lucide-react';

interface InventoryStockViewProps {
  currentUser: User;
  settings: TrustSettings;
}

export const InventoryStockView: React.FC<InventoryStockViewProps> = ({ currentUser, settings }) => {
  const isAdmin = isUserIntendente(currentUser);

  const [inventory, setInventory] = useState<InventoryItem[]>(storageService.getInventory());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setInventory(storageService.getInventory());
    });
    return unsubscribe;
  }, []);

  // Modal State for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    category: 'living_galeria',
    locationRoom: '',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: '',
    lastCheckedDate: new Date().toISOString().split('T')[0],
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleInventoryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) {
        setIsUploadingPhoto(true);
        try {
          const r2Res = await r2Service.uploadPhoto(base64, file.name || 'inventario', 'inventario');
          if (r2Res.success && r2Res.url) {
            setFormData((prev) => ({ ...prev, imageUrl: r2Res.url }));
          } else {
            setFormData((prev) => ({ ...prev, imageUrl: base64 }));
          }
        } catch {
          setFormData((prev) => ({ ...prev, imageUrl: base64 }));
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const categories: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'all', label: 'Todo el Inventario', icon: Boxes },
    { id: 'living_galeria', label: 'Living & Galerías', icon: Home },
    { id: 'cocina_vajilla', label: 'Cocina & Vajilla', icon: UtensilsCrossed },
    { id: 'suites_dormitorios', label: 'Suites & Dormitorios', icon: Bed },
    { id: 'quincho_asador', label: 'Quincho & Asador', icon: Flame },
    { id: 'piscina_parque', label: 'Piscina & Solárium', icon: Waves },
    { id: 'equipamiento_tecnico', label: 'Equipos & Grupo Electrógeno', icon: Wrench },
  ];

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      const updated: InventoryItem = {
        ...editingItem,
        ...formData,
      };
      const saved = await storageService.saveInventoryItem(updated);
      if (!saved) {
        alert('La base de datos no confirmó los cambios del inventario.');
        return;
      }
      setEditingItem(null);
    } else {
      const newItem: InventoryItem = {
        id: 'inv-' + Date.now(),
        ...formData,
      };
      const saved = await storageService.saveInventoryItem(newItem);
      if (!saved) {
        alert('La base de datos no confirmó el alta del inventario.');
        return;
      }
      setIsModalOpen(false);
    }
    setInventory(storageService.getInventory());
  };

  const handleOpenDeleteModal = (item: InventoryItem) => {
    setItemToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const deleted = await storageService.deleteInventoryItem(itemToDelete.id);
    if (!deleted) {
      alert('La base de datos no confirmó la eliminación. El artículo sigue vigente.');
      return;
    }
    setInventory(storageService.getInventory());
    setItemToDelete(null);
  };

  const handlePrintChecklist = () => {
    window.print();
  };

  const filteredItems = inventory.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedCondition !== 'all' && item.condition !== selectedCondition) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.name.toLowerCase().includes(q) ||
        item.locationRoom.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // KPIs
  const totalItemsCount = inventory.reduce((sum, i) => sum + i.quantity, 0);
  const totalDistinct = inventory.length;
  const excellentCount = inventory.filter((i) => i.condition === 'excelente').length;
  const attentionCount = inventory.filter(
    (i) => i.condition === 'regular' || i.condition === 'requiere_reparacion' || i.condition === 'faltante'
  ).length;

  const getConditionBadge = (cond: InventoryCondition) => {
    switch (cond) {
      case 'excelente':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            Excelente
          </span>
        );
      case 'bueno':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
            Bueno
          </span>
        );
      case 'regular':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            Regular
          </span>
        );
      case 'requiere_reparacion':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-800 border border-red-200">
            Requiere Revisión
          </span>
        );
      case 'faltante':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200">
            Faltante
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7A8E7E]">
            <span>{settings.houseName}</span>
            <span>·</span>
            <span className="font-semibold text-[#8C6D3B]">Patrimonio & Stock</span>
          </div>
          <h2
            className="text-2xl font-bold text-[#163323] mt-1"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
          >
            Inventario & Stock de la Estancia
          </h2>
          <p className="text-xs text-[#526657] mt-1">
            Registro oficial de mobiliario, vajilla, electrodomésticos, ropa blanca y equipamiento del campo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintChecklist}
            className="px-3.5 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Imprimir planilla de inventario para check-in/out"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-800" />
            <span>Imprimir Check-list</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  name: '',
                  category: 'living_galeria',
                  locationRoom: 'Living Principal',
                  quantity: 1,
                  unit: 'unidades',
                  condition: 'excelente',
                  notes: '',
                  lastCheckedDate: new Date().toISOString().split('T')[0],
                });
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Nuevo Ítem de Stock</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-[#E3DFC8] border-l-3 border-l-[#1B3B2B] shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
            Líneas de Inventario
          </span>
          <span className="text-2xl font-bold font-mono text-[#163323] mt-1 block">
            {totalDistinct} ítems
          </span>
          <span className="text-[10px] text-[#7A8E7E]">En 6 áreas de la estancia</span>
        </div>

        <div className="p-4 bg-white border border-[#E3DFC8] border-l-3 border-l-emerald-700 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
            Unidades Totales
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-800 mt-1 block">
            {totalItemsCount}
          </span>
          <span className="text-[10px] text-[#7A8E7E]">Piezas, juegos y unidades</span>
        </div>

        <div className="p-4 bg-white border border-[#E3DFC8] border-l-3 border-l-[#BFA270] shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
            En Estado Excelente
          </span>
          <span className="text-2xl font-bold font-mono text-[#8C6D3B] mt-1 block">
            {excellentCount}
          </span>
          <span className="text-[10px] text-[#7A8E7E]">
            {Math.round((excellentCount / (totalDistinct || 1)) * 100)}% del patrimonio
          </span>
        </div>

        <div className="p-4 bg-white border border-[#E3DFC8] border-l-3 border-l-amber-600 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
            Requiere Atención
          </span>
          <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">
            {attentionCount}
          </span>
          <span className="text-[10px] text-[#7A8E7E]">Para revisión del casero</span>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer border ${
                isSelected
                  ? 'bg-[#1B3B2B] text-white border-[#1B3B2B] shadow-xs'
                  : 'bg-white hover:bg-[#FAF8F5] text-[#4F6254] border-[#E3DFC8]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#BFA270]' : 'text-[#7A8E7E]'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8E7E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por mueble, vajilla o ambiente..."
            className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none focus:border-[#1B3B2B]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[11px] font-semibold text-[#637568] whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Condición:</span>
          </span>
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="px-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none"
          >
            <option value="all">Todas las condiciones</option>
            <option value="excelente">Excelente</option>
            <option value="bueno">Bueno</option>
            <option value="regular">Regular</option>
            <option value="requiere_reparacion">Requiere Revisión</option>
            <option value="faltante">Faltante</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Elemento / Descripción</th>
              <th className="py-3 px-3">Ubicación / Ambiente</th>
              <th className="py-3 px-3 text-right">Cantidad</th>
              <th className="py-3 px-3">Estado de Conservación</th>
              <th className="py-3 px-3">Último Relevamiento</th>
              <th className="py-3 px-3">Observaciones Técnicas</th>
              {isAdmin && <th className="py-3 px-4 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEAE0]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-[#7A8E7E]">
                  No se encontraron elementos de stock con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#163323] max-w-sm">
                    <span>{item.name}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-medium text-[#2E4233] bg-[#F2EDE1] px-2 py-0.5 rounded-2xs text-[11px]">
                      {item.locationRoom}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-[#163323] whitespace-nowrap">
                    {item.quantity} <span className="text-[10px] text-[#7A8E7E] font-normal">{item.unit}</span>
                  </td>
                  <td className="py-3.5 px-3">{getConditionBadge(item.condition)}</td>
                  <td className="py-3.5 px-3 font-mono text-[11px] text-[#7A8E7E] whitespace-nowrap">
                    {item.lastCheckedDate}
                  </td>
                  <td className="py-3.5 px-3 text-[#637568] max-w-xs text-[11px] leading-snug">
                    {item.notes || '-'}
                  </td>
                  {isAdmin && (
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setFormData({
                              name: item.name,
                              category: item.category,
                              locationRoom: item.locationRoom,
                              quantity: item.quantity,
                              unit: item.unit,
                              condition: item.condition,
                              notes: item.notes || '',
                              lastCheckedDate: item.lastCheckedDate,
                            });
                          }}
                          className="p-1 hover:bg-[#EFEAE0] text-[#163323] transition-colors cursor-pointer"
                          title="Modificar ítem"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(item)}
                          className="p-1 hover:bg-red-50 text-red-700 transition-colors cursor-pointer"
                          title="Eliminar ítem del inventario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add or Edit Inventory Item */}
      {(isModalOpen || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0] flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#1B3B2B]" />
              <span>{editingItem ? 'Modificar Elemento de Inventario' : 'Alta de Nuevo Elemento de Stock'}</span>
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Nombre del Elemento</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. Sommier King Size con Pillow Top"
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as InventoryCategory })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="living_galeria">Living & Galerías</option>
                    <option value="cocina_vajilla">Cocina & Vajilla</option>
                    <option value="suites_dormitorios">Suites & Dormitorios</option>
                    <option value="quincho_asador">Quincho & Asador</option>
                    <option value="piscina_parque">Piscina & Solárium</option>
                    <option value="blanqueria_ropa">Blanquería & Ropa Blanca</option>
                    <option value="equipamiento_tecnico">Equipos & Caldera/Grupo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Ubicación / Ambiente</label>
                  <input
                    type="text"
                    value={formData.locationRoom}
                    onChange={(e) => setFormData({ ...formData, locationRoom: e.target.value })}
                    placeholder="ej. Suite 1, Quincho, Alacena"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Unidad</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="unidades">unidades</option>
                    <option value="juegos">juegos</option>
                    <option value="piezas">piezas</option>
                    <option value="bolsas">bolsas</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Estado</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value as InventoryCondition })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="excelente">Excelente</option>
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="requiere_reparacion">Requiere Revisión</option>
                    <option value="faltante">Faltante</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Observaciones / Notas Técnicas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Detalles sobre mantenimiento, fecha de compra o cuidado especial..."
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Foto del Ítem (Cloudflare R2)</label>
                <div className="flex items-center gap-3">
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt="Vista previa"
                      className="w-12 h-12 object-cover border border-[#DCD4C0]"
                    />
                  )}
                  <label className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#EFEAE0] border border-[#DCD4C0] font-semibold uppercase text-[11px] text-[#163323] cursor-pointer flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>{isUploadingPhoto ? 'Subiendo a R2...' : 'Subir Foto a R2'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleInventoryPhotoUpload}
                      disabled={isUploadingPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between gap-2 border-t border-[#EFEAE0]">
                {editingItem && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      const item = editingItem;
                      setEditingItem(null);
                      setIsModalOpen(false);
                      handleOpenDeleteModal(item);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Ítem</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingItem(null);
                    }}
                    className="px-4 py-2 text-[#637568] hover:text-[#19231A] text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider text-xs hover:bg-[#132A1F] cursor-pointer"
                  >
                    Guardar Ítem
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Inventory Item */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#DED7C2] shadow-2xl p-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#EFEAE0]">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-full shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#163323]">
                  ¿Eliminar ítem del inventario?
                </h3>
                <p className="text-[11px] text-[#637568]">
                  Esta acción dará de baja este elemento del registro oficial de la finca.
                </p>
              </div>
            </div>

            <div className="my-4 p-3.5 bg-[#FAF8F5] border border-[#E8E2D2] text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#637568]">Elemento:</span>
                <span className="font-bold text-[#163323]">{itemToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#637568]">Ubicación:</span>
                <span className="font-medium text-[#2E4233] bg-[#F2EDE1] px-2 py-0.5 rounded-2xs text-[11px]">
                  {itemToDelete.locationRoom}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#637568]">Cantidad:</span>
                <span className="font-mono font-bold text-[#163323]">
                  {itemToDelete.quantity} {itemToDelete.unit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#637568]">Estado:</span>
                <span>{getConditionBadge(itemToDelete.condition)}</span>
              </div>
              {itemToDelete.notes && (
                <div className="pt-2 border-t border-[#E8E2D2] text-[11px] text-[#637568] italic">
                  Nota: “{itemToDelete.notes}”
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EFEAE0]">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs text-[#637568] hover:text-[#19231A] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
