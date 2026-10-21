import React, { useEffect, useRef, useState } from 'react';
import { SiteSettings } from '../types';

interface BackgroundPartyVideoProps {
  settings: SiteSettings;
}

export const BackgroundPartyVideo: React.FC<BackgroundPartyVideoProps> = ({ settings }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isGlitching, setIsGlitching] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoEnabled = settings.bg_video_enabled !== false;
  const glitchEnabled = settings.bg_glitch_enabled !== false;
  const playbackSpeed = settings.bg_video_speed ?? 0.75;
  const videoSrc = settings.bg_video_url || '/assets/videos/party_noir.mp4';
  const posterSrc = settings.bg_image_url || '/assets/aistudio/Glamour_nocturno_en_estelas_de_luz_376432af.png';

  // Apply playback rate (slow motion - subtle)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, videoLoaded]);

  // Handle autoplay resilience
  useEffect(() => {
    if (videoRef.current && videoEnabled) {
      videoRef.current.play().catch(() => {
        // Autoplay may be deferred until user interaction, poster image is visible
      });
    }
  }, [videoSrc, videoEnabled]);

  // Subtle glitch transition periodic cycle (every 6 to 9 seconds)
  useEffect(() => {
    if (!glitchEnabled || !videoEnabled) {
      setIsGlitching(false);
      return;
    }

    let glitchTimeout: NodeJS.Timeout;
    const interval = setInterval(() => {
      // Trigger subtle glitch transition
      setIsGlitching(true);
      glitchTimeout = setTimeout(() => {
        setIsGlitching(false);
      }, 420); // 420ms quick subtle transition
    }, 7000);

    return () => {
      clearInterval(interval);
      clearTimeout(glitchTimeout);
    };
  }, [glitchEnabled, videoEnabled]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none select-none">
      {/* Fallback Static Image only when video is disabled or fails to load */}
      {(!videoEnabled || videoError || !videoLoaded) && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `url(${posterSrc})`,
            filter: settings.bg_blur > 0 ? `blur(${settings.bg_blur}px)` : 'none',
            opacity: settings.bg_opacity ?? 1,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* Video Layer: Black & White Slow Motion Party Video with High Clarity & Brightness */}
      {videoEnabled && !videoError && (
        <div className={`absolute inset-0 w-full h-full ${isGlitching ? 'glitch-flash' : ''}`}>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{
              filter: `grayscale(100%) contrast(1.08) brightness(1.02) ${settings.bg_blur > 0 ? `blur(${settings.bg_blur}px)` : ''}`,
              opacity: videoLoaded ? (settings.bg_opacity ?? 1) : 0,
            }}
          />

          {/* Glitch Overlay Slice: Subtle video displacement & luminance flash */}
          {isGlitching && (
            <div
              className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none mix-blend-screen glitch-slice opacity-80"
              style={{
                transform: 'translate(4px, -2px) scale(1.01)',
              }}
            >
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{
                  filter: 'grayscale(100%) contrast(1.2) brightness(1.15)',
                }}
              />
            </div>
          )}

          {/* Subtle Luminous CRT Scanline Bar during glitch transition */}
          {isGlitching && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent h-16 w-full opacity-60 pointer-events-none" />
          )}
        </div>
      )}

      {/* Very Soft Corner Vignette (does not darken the center or party scene) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 72%, rgba(0, 0, 0, 0.25) 100%)',
        }}
      />

      {/* Optional User Overlay Tint if enabled */}
      {settings.overlay_opacity > 0 && (
        <div
          className="absolute inset-0 transition-all duration-500 pointer-events-none"
          style={{
            backgroundColor:
              settings.overlay_color === 'black' ? '#000000' :
              settings.overlay_color === 'navy' ? '#020617' :
              settings.overlay_color === 'burgundy' ? '#3b070d' :
              settings.overlay_color === 'emerald' ? '#022c22' : '#18181b',
            opacity: settings.overlay_opacity,
          }}
        />
      )}
    </div>
  );
};
