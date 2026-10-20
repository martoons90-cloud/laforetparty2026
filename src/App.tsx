/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Calendar, MapPin, Settings, X, 
  Instagram, MessageCircle, Share2, Image as ImageIcon, 
  RefreshCw, Sliders, CheckCircle2, ShieldCheck, AlertCircle, Lock, User as UserIcon,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { SiteSettings, DEFAULT_SETTINGS, BACKGROUND_PRESETS } from './types';

export default function App() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  // Admin & Customizer State with Authentication
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('laforet_admin_logged') === 'true';
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Load settings from Supabase on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('leforet_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data && !error) {
        const effectiveDate = data.target_date && data.target_date.includes('2026-12-31')
          ? '2026-12-19T22:00:00'
          : (data.target_date ?? '2026-12-19T22:00:00');

        const effectiveVenueName = (!data.venue_name || data.venue_name === 'A confirmar' || data.venue_name.includes('Imperial'))
          ? 'Estancia El Forestal'
          : data.venue_name;
        const effectiveVenueAddress = (!data.venue_address || data.venue_address === 'A confirmar' || data.venue_address.includes('Zona Rosa'))
          ? 'Estancia El Forestal'
          : data.venue_address;

        if (data.target_date && data.target_date.includes('2026-12-31')) {
          supabase.from('leforet_settings').update({ target_date: '2026-12-19T22:00:00' }).eq('id', 1).then();
        }

        if (data.venue_name !== effectiveVenueName || data.venue_address !== effectiveVenueAddress) {
          supabase.from('leforet_settings').update({ 
            venue_name: effectiveVenueName, 
            venue_address: effectiveVenueAddress 
          }).eq('id', 1).then();
        }

        setSettings({
          id: data.id,
          title: data.title ?? DEFAULT_SETTINGS.title,
          subtitle: data.subtitle ?? DEFAULT_SETTINGS.subtitle,
          target_date: effectiveDate,
          venue_name: effectiveVenueName,
          venue_address: effectiveVenueAddress,
          bg_image_url: data.bg_image_url ?? DEFAULT_SETTINGS.bg_image_url,
          bg_blur: data.bg_blur ?? DEFAULT_SETTINGS.bg_blur,
          bg_opacity: data.bg_opacity ?? DEFAULT_SETTINGS.bg_opacity,
          overlay_color: data.overlay_color ?? DEFAULT_SETTINGS.overlay_color,
          overlay_opacity: data.overlay_opacity ?? DEFAULT_SETTINGS.overlay_opacity,
          accent_color: data.accent_color ?? DEFAULT_SETTINGS.accent_color,
          instagram_url: data.instagram_url ?? DEFAULT_SETTINGS.instagram_url,
          tiktok_url: data.tiktok_url ?? DEFAULT_SETTINGS.tiktok_url,
          spotify_url: data.spotify_url ?? DEFAULT_SETTINGS.spotify_url,
          whatsapp_number: data.whatsapp_number ?? DEFAULT_SETTINGS.whatsapp_number,
        });
      }
    } catch (err) {
      console.log('Using default settings.');
    }
  };

  // Countdown timer logic
  useEffect(() => {
    const targetTime = new Date(settings.target_date).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [settings.target_date]);

  // Handle Admin Login
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const u = loginUser.trim().toLowerCase();
    const p = loginPass.trim();

    if ((u === 'efrain.rodriguez' || u === 'efrain') && p === 'ideas1271') {
      setIsAuthenticated(true);
      localStorage.setItem('laforet_admin_logged', 'true');
      setLoginUser('');
      setLoginPass('');
    } else {
      setLoginError('Usuario o contraseña incorrectos. Utilice efrain.rodriguez / ideas1271');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('laforet_admin_logged');
  };

  const handleCloseAdmin = () => {
    setIsAdminOpen(false);
    setIsMinimized(false);
  };

  // Save Settings to Supabase
  const handleSaveSettings = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert('Configuración guardada localmente (Supabase no conectado).');
      handleCloseAdmin();
      return;
    }

    try {
      const payload = { ...settings, id: 1, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from('leforet_settings')
        .upsert(payload);

      if (error) throw error;
      alert('¡Configuración guardada exitosamente en Supabase!');
      handleCloseAdmin();
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar en Supabase: ' + err.message);
    }
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, bg_image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative min-h-screen text-slate-100 overflow-x-hidden selection:bg-white selection:text-black">
      
      {/* Background with dynamic blur, opacity and overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
          style={{
            backgroundImage: `url(${settings.bg_image_url})`,
            filter: `blur(${settings.bg_blur}px)`,
            opacity: settings.bg_opacity
          }}
        />
        {/* Color Tint Overlay */}
        <div 
          className="absolute inset-0 transition-all duration-500 pointer-events-none"
          style={{
            backgroundColor: settings.overlay_color === 'black' ? '#000000' :
                             settings.overlay_color === 'navy' ? '#020617' :
                             settings.overlay_color === 'burgundy' ? '#3b070d' :
                             settings.overlay_color === 'emerald' ? '#022c22' : '#18181b',
            opacity: settings.overlay_opacity
          }}
        />
        {/* Vignette & Radial Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/60 to-black pointer-events-none" />
      </div>

      {/* Floating Header / Navbar */}
      <header className="relative z-20 w-full px-6 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full border border-white/25 flex items-center justify-center bg-black/60 backdrop-blur-xl shadow-[0_0_20px_rgba(255,255,255,0.15)] overflow-hidden p-1.5">
            <img 
              src="/assets/aistudio/logo_frt_white.png" 
              alt="Logo FRT" 
              className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            />
          </div>
          <div>
            <span className="font-logo tracking-[0.35em] text-xl md:text-2xl font-normal text-white drop-shadow-md">
              LAFORET FEST
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAdminOpen(true)}
            title="Panel de Configuración (Admin)"
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white transition-all hover:rotate-90 duration-300 shadow-lg cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pt-8 pb-24 max-w-5xl mx-auto text-center">
        
        {/* Badge */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-xl text-white text-xs uppercase tracking-[0.35em] font-medium mb-10 shadow-[0_0_25px_rgba(255,255,255,0.15)]"
        >
          <Sparkles className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '6s' }} />
          <span>Gran Celebración • 19 de Diciembre</span>
          <Sparkles className="w-4 h-4 text-white" />
        </motion.div>

        {/* Central Logo - Logotipo Principal LA FORÊT (Logo png-05) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="w-full max-w-xl sm:max-w-2xl mx-auto mb-8 flex flex-col items-center justify-center px-4"
        >
          <img 
            src="/assets/aistudio/logo_laforet_05_white.png" 
            alt="LA FORÊT" 
            className="w-auto h-72 sm:h-96 md:h-[420px] lg:h-[500px] max-w-full object-contain filter drop-shadow-[0_15px_50px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform duration-700"
          />
        </motion.div>

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="text-lg md:text-2xl text-slate-200 max-w-2xl font-logo tracking-[0.2em] mb-16 drop-shadow-md"
        >
          {settings.subtitle}
        </motion.p>

        {/* Countdown Timer */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 w-full max-w-3xl mb-16"
        >
          {[
            { label: 'Días', value: timeLeft.days },
            { label: 'Horas', value: timeLeft.hours },
            { label: 'Minutos', value: timeLeft.minutes },
            { label: 'Segundos', value: timeLeft.seconds },
          ].map((item, index) => (
            <div 
              key={index}
              className="relative p-6 md:p-8 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.6)] group hover:border-white/40 transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="font-logo text-4xl md:text-6xl font-light text-white mb-1 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                {String(item.value).padStart(2, '0')}
              </div>
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400 font-medium">
                {item.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Event Details Grid (Fecha, Hora y Ubicación) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-16"
        >
          <div className="p-8 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/10 text-center flex flex-col items-center justify-center hover:border-white/30 transition-all shadow-xl group">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
              <Calendar className="w-7 h-7" />
            </div>
            <h4 className="font-logo text-2xl font-normal text-white mb-1">Fecha y Hora</h4>
            <p className="text-base font-semibold text-white tracking-wider">19 de Diciembre de 2026</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-[0.2em]">A partir de las 22:00 hrs</p>
          </div>

          <div className="p-8 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/10 text-center flex flex-col items-center justify-center hover:border-white/30 transition-all shadow-xl group">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
              <MapPin className="w-7 h-7" />
            </div>
            <h4 className="font-logo text-2xl font-normal text-white mb-1">Lugar</h4>
            <p className="text-base font-semibold text-white tracking-wider">{settings.venue_name || 'Estancia El Forestal'}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-[0.2em]">Estancia El Forestal</p>
          </div>
        </motion.div>

        {/* Cartel Oficial: Próximamente Venta de Entradas */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.85 }}
          className="w-full max-w-xl mb-16 p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-white/[0.08] via-white/[0.18] to-white/[0.08] backdrop-blur-2xl border-2 border-white/35 shadow-[0_0_40px_rgba(255,255,255,0.25)] flex items-center justify-center gap-4 sm:gap-5 text-center relative overflow-hidden group hover:border-white/60 transition-all duration-500"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
          <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-lg">
            <Ticket className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.35em] text-slate-300 font-medium">
              Acceso Oficial
            </span>
            <span className="font-logo text-xl sm:text-2xl md:text-3xl font-light tracking-[0.22em] text-white uppercase drop-shadow-[0_2px_15px_rgba(255,255,255,0.7)]">
              Próximamente Venta de Entradas
            </span>
          </div>
        </motion.div>

        {/* Social Bar */}
        <div className="flex items-center justify-center gap-4 flex-wrap mb-12">
          {settings.instagram_url && (
            <a 
              href={settings.instagram_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white transition-all backdrop-blur-xl text-sm font-semibold shadow-lg"
            >
              <Instagram className="w-4 h-4 text-white" />
              <span>Instagram</span>
            </a>
          )}
          {settings.tiktok_url && (
            <a 
              href={settings.tiktok_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white transition-all backdrop-blur-xl text-sm font-semibold shadow-lg"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>TikTok</span>
            </a>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-8 text-center border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <p className="text-xs text-slate-400 tracking-wider">
          © {new Date().getFullYear()} LAFORET FEST. Todos los derechos reservados.
        </p>
      </footer>

      {/* ========================================================== */}
      {/* ADMIN LOGIN / CUSTOMIZER PANEL                             */}
      {/* ========================================================== */}
      <AnimatePresence>
        {isAdminOpen && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all ${isMinimized ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-zinc-950/95 border border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto text-left backdrop-blur-xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-white">Panel de Control - Laforet Fest</h3>
                    <p className="text-xs text-slate-400">Acceso exclusivo para Administrador</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAuthenticated && (
                    <button
                      onClick={() => setIsMinimized(true)}
                      title="Ocultar panel temporalmente para ver cambios en vivo"
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Ver Fondo en Vivo</span>
                    </button>
                  )}
                  <button 
                    onClick={handleCloseAdmin}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {!isAuthenticated ? (
                /* LOGIN FORM FOR ADMIN */
                <div className="py-8 px-4 max-w-md mx-auto space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mx-auto">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-serif text-2xl font-bold text-white mb-1">Acceso Restringido</h4>
                    <p className="text-xs text-slate-400">Ingrese las credenciales de administrador para modificar los ajustes.</p>
                  </div>

                  <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Usuario / Correo</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="efrain.rodriguez"
                          value={loginUser}
                          onChange={(e) => setLoginUser(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                    </div>

                    {loginError && (
                      <p className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {loginError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl font-semibold uppercase tracking-widest text-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 hover:from-amber-100 hover:to-amber-400 transition-all shadow-[0_0_20px_rgba(251,191,36,0.3)] cursor-pointer"
                    >
                      Ingresar como Administrador
                    </button>
                  </form>
                </div>
              ) : (
                /* AUTHENTICATED ADMIN PANEL */
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-300">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Sesión iniciada como <strong>efrain.rodriguez</strong> (Administrador)
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-xs underline hover:text-white cursor-pointer"
                    >
                      Cerrar Sesión
                    </button>
                  </div>

                  {/* General Texts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Título Principal</label>
                      <input
                        type="text"
                        value={settings.title}
                        onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Subtítulo</label>
                      <input
                        type="text"
                        value={settings.subtitle}
                        onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Target Date & Venue */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Fecha y Hora Objetivo</label>
                      <input
                        type="datetime-local"
                        value={settings.target_date.slice(0, 16)}
                        onChange={(e) => setSettings({ ...settings, target_date: e.target.value + ':00' })}
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Nombre del Salón / Lugar</label>
                      <input
                        type="text"
                        value={settings.venue_name}
                        onChange={(e) => setSettings({ ...settings, venue_name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Dirección</label>
                      <input
                        type="text"
                        value={settings.venue_address}
                        onChange={(e) => setSettings({ ...settings, venue_address: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Background Customization */}
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h4 className="font-serif text-sm font-bold text-amber-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Personalización del Fondo y Blur
                    </h4>

                    {/* Presets */}
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Presets de Lujo</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {BACKGROUND_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSettings({ ...settings, bg_image_url: preset.url })}
                            className="p-2 rounded-xl bg-black/40 border border-white/15 hover:border-amber-400 text-left transition-all text-xs truncate group cursor-pointer"
                          >
                            <div className="w-full h-12 rounded-lg bg-cover bg-center mb-1" style={{ backgroundImage: `url(${preset.url})` }} />
                            <span className="text-slate-300 group-hover:text-amber-300 truncate block">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">URL de Imagen Personalizada</label>
                      <input
                        type="text"
                        value={settings.bg_image_url}
                        onChange={(e) => setSettings({ ...settings, bg_image_url: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400 mb-2"
                      />
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer transition-all">
                        <UploadIcon className="w-4 h-4" /> Subir Imagen desde dispositivo
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/10">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Desenfoque (Blur): {settings.bg_blur}px</label>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          value={settings.bg_blur}
                          onChange={(e) => setSettings({ ...settings, bg_blur: Number(e.target.value) })}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Opacidad de Imagen: {Math.round(settings.bg_opacity * 100)}%</label>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={settings.bg_opacity}
                          onChange={(e) => setSettings({ ...settings, bg_opacity: Number(e.target.value) })}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-slate-400 mb-1">Opacidad de Oscurecimiento: {Math.round(settings.overlay_opacity * 100)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="0.95"
                          step="0.05"
                          value={settings.overlay_opacity}
                          onChange={(e) => setSettings({ ...settings, overlay_opacity: Number(e.target.value) })}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">Instagram URL</label>
                      <input
                        type="text"
                        value={settings.instagram_url}
                        onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">TikTok URL</label>
                      <input
                        type="text"
                        value={settings.tiktok_url}
                        onChange={(e) => setSettings({ ...settings, tiktok_url: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-300 mb-1">WhatsApp (Teléfono)</label>
                      <input
                        type="text"
                        value={settings.whatsapp_number}
                        onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={handleCloseAdmin}
                      className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs uppercase tracking-widest shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Minimized floating pill when user clicks "Ver Fondo en Vivo" */}
      {isAdminOpen && isMinimized && (
        <div 
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-full bg-zinc-900/95 border border-amber-500/60 backdrop-blur-2xl shadow-[0_0_40px_rgba(251,191,36,0.4)] text-amber-300 text-xs font-semibold cursor-pointer animate-pulse"
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Panel de Ajustes Abierto (Haz clic para restaurar y guardar)</span>
        </div>
      )}

    </div>
  );
}

function UploadIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
  );
}
