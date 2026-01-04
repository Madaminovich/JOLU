
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MediaItem } from '../types';
import { I18N } from '../constants';

interface MediaSliderProps {
  media: MediaItem[];
  lang?: 'ru' | 'en' | 'ky';
  fitType?: 'cover' | 'contain';
  onMediaClick?: () => void;
}

const extractYoutubeIdSafe = (urlOrId: string) => {
  if (!urlOrId) return '';
  if (urlOrId.length === 11 && !urlOrId.includes('/') && !urlOrId.includes('.')) return urlOrId;

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = urlOrId.match(regExp);
  return (match && match[2] && match[2].length === 11) ? match[2] : '';
};

const buildYoutubeWatchUrl = (urlOrId: string) => {
  const id = extractYoutubeIdSafe(urlOrId);
  if (!id) return '';
  return `https://www.youtube.com/watch?v=${id}`;
};

const buildYoutubeThumbUrl = (urlOrId: string) => {
  const id = extractYoutubeIdSafe(urlOrId);
  if (!id) return '';
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
};

export const MediaSlider: React.FC<MediaSliderProps> = ({ media = [], lang = 'ru', fitType = 'cover', onMediaClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const t = I18N[lang];

  useEffect(() => {
    if (currentIndex >= media.length) setCurrentIndex(0);
  }, [media.length]);

  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };
  
  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  if (!media || media.length === 0) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-[32px] flex items-center justify-center border-2 border-dashed border-gray-200">
        <span className="text-4xl">🖼️</span>
      </div>
    );
  }

  const openYoutubeExternally = (watchUrl: string) => {
    if (!watchUrl) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(watchUrl);
    else window.open(watchUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${fitType === 'contain' ? '' : 'rounded-[32px] shadow-inner'} bg-black`}>
      <div
        className="flex transition-transform duration-500 ease-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {media.map((item, idx) => (
          <div
            key={idx}
            className="w-full h-full flex-shrink-0 relative bg-black flex items-center justify-center"
            onClick={onMediaClick}
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                className={`w-full h-full ${fitType === 'cover' ? 'object-cover' : 'object-contain'}`}
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://picsum.photos/seed/error/400/400?grayscale';
                }}
                alt="Product media"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // Don't trigger full screen if clicking play
                    openYoutubeExternally(buildYoutubeWatchUrl(item.url));
                }}
                className="w-full h-full relative flex items-center justify-center"
              >
                <img
                  src={buildYoutubeThumbUrl(item.url) || 'https://picsum.photos/seed/yt/800/800?grayscale'}
                  className={`w-full h-full ${fitType === 'cover' ? 'object-cover' : 'object-contain'} opacity-90`}
                  loading="lazy"
                  alt="YouTube preview"
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                    <span className="text-white text-2xl ml-1">▶</span>
                  </div>
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {media.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 w-10 h-10 rounded-full text-white text-xl z-10 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors">‹</button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 w-10 h-10 rounded-full text-white text-xl z-10 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors">›</button>
        </>
      )}

      {/* Pagination dots for better UX */}
      {media.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
            {media.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-125' : 'bg-white/40'}`} />
            ))}
        </div>
      )}

      {fitType === 'cover' && (
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            {media.some((m) => m.type === 'youtube') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const videoIdx = media.findIndex((m) => m.type === 'youtube');
                  if (videoIdx !== -1) setCurrentIndex(videoIdx);
                }}
                className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-black uppercase shadow-sm border border-white/10"
              >
                Video
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // If clicked here, specifically go to first image
                const firstImgIdx = media.findIndex((m) => m.type === 'image');
                setCurrentIndex(firstImgIdx !== -1 ? firstImgIdx : 0);
              }}
              className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-black uppercase shadow-sm border border-white/10"
            >
              Photo
            </button>
          </div>
      )}
    </div>
  );
};
