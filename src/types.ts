export interface SiteSettings {
  id?: number;
  title: string;
  subtitle: string;
  target_date: string;
  venue_name: string;
  venue_address: string;
  bg_image_url: string;
  bg_video_url?: string;
  bg_video_enabled?: boolean;
  bg_video_speed?: number;
  bg_glitch_enabled?: boolean;
  bg_blur: number;
  bg_opacity: number;
  overlay_color: string;
  overlay_opacity: number;
  accent_color: string;
  instagram_url: string;
  tiktok_url: string;
  spotify_url: string;
  whatsapp_number: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  id: 1,
  title: 'LAFORET FEST',
  subtitle: 'Fin de Año Fest',
  target_date: '2026-12-19T18:00:00',
  venue_name: 'Estancia El Forestal',
  venue_address: 'Estancia El Forestal',
  bg_image_url: '/assets/aistudio/Glamour_nocturno_en_estelas_de_luz_376432af.png',
  bg_video_url: '/assets/videos/party_noir.mp4',
  bg_video_enabled: true,
  bg_video_speed: 0.75,
  bg_glitch_enabled: true,
  bg_blur: 0,
  bg_opacity: 1,
  overlay_color: 'black',
  overlay_opacity: 0,
  accent_color: 'amber',
  instagram_url: 'https://instagram.com/laforetfest',
  tiktok_url: 'https://tiktok.com/@laforetfest',
  spotify_url: 'https://spotify.com',
  whatsapp_number: '+34600000000',
};

export const BACKGROUND_PRESETS = [
  {
    name: 'Glamour Nocturno (Oficial)',
    url: '/assets/aistudio/Glamour_nocturno_en_estelas_de_luz_376432af.png',
  },
  {
    name: 'Champagne & Gold Night',
    url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=2000&auto=format&fit=crop',
  },
  {
    name: 'Luxury Ballroom',
    url: 'https://images.unsplash.com/photo-1545232979-fbf80bc9b5d4?q=80&w=2000&auto=format&fit=crop',
  },
  {
    name: 'New Year Fireworks',
    url: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?q=80&w=2000&auto=format&fit=crop',
  },
  {
    name: 'Neon Glamour',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=2000&auto=format&fit=crop',
  },
  {
    name: 'Dark Velvet & Lights',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2000&auto=format&fit=crop',
  },
];
