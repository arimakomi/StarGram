export interface WallpaperPreset {
  id: string;
  name: string;
  previewClass: string;
  style: React.CSSProperties;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'default',
    name: 'الگوی تلگرام (کلاسیک)',
    previewClass: 'bg-[#0f1721]',
    style: {
      backgroundColor: 'var(--tg-bg, #0f1721)',
      backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.04) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255, 255, 255, 0.04) 2%, transparent 0%)`,
      backgroundSize: '100px 100px'
    }
  },
  {
    id: 'cosmic',
    name: 'آسمان پرستاره و کهکشان',
    previewClass: 'bg-gradient-to-br from-[#0b0c1e] via-[#1a1738] to-[#070913]',
    style: {
      background: 'radial-gradient(ellipse at top, #1b2038 0%, #0c0e1a 60%, #05060b 100%)',
      backgroundImage: `radial-gradient(2px 2px at 20px 30px, #ffffff, rgba(0,0,0,0)),
        radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.7), rgba(0,0,0,0)),
        radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
        radial-gradient(2px 2px at 160px 120px, #3390ec, rgba(0,0,0,0)),
        radial-gradient(1.5px 1.5px at 230px 180px, #a855f7, rgba(0,0,0,0))`,
      backgroundSize: '250px 250px'
    }
  },
  {
    id: 'emerald',
    name: 'زمرد تاریک نئونی',
    previewClass: 'bg-gradient-to-br from-[#061e1b] via-[#0d2e29] to-[#041210]',
    style: {
      background: 'linear-gradient(145deg, #071f1b 0%, #0a2d26 50%, #041411 100%)',
      backgroundImage: `radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(6, 95, 70, 0.18) 0%, transparent 40%)`
    }
  },
  {
    id: 'sunset',
    name: 'غروب بنفش و ارغوانی',
    previewClass: 'bg-gradient-to-br from-[#200e2b] via-[#151128] to-[#0c0a1a]',
    style: {
      background: 'linear-gradient(160deg, #240f32 0%, #17112c 50%, #0d0a1c 100%)',
      backgroundImage: `radial-gradient(circle at 80% 20%, rgba(217, 70, 239, 0.1) 0%, transparent 40%),
        radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.12) 0%, transparent 40%)`
    }
  },
  {
    id: 'hexagons',
    name: 'شبکه کربنی مینیمال',
    previewClass: 'bg-[#11161d]',
    style: {
      backgroundColor: '#11161d',
      backgroundImage: `linear-gradient(30deg, #161d26 12%, transparent 12.5%, transparent 87%, #161d26 87.5%, #161d26),
        linear-gradient(150deg, #161d26 12%, transparent 12.5%, transparent 87%, #161d26 87.5%, #161d26),
        linear-gradient(30deg, #161d26 12%, transparent 12.5%, transparent 87%, #161d26 87.5%, #161d26),
        linear-gradient(150deg, #161d26 12%, transparent 12.5%, transparent 87%, #161d26 87.5%, #161d26),
        linear-gradient(60deg, #161d2677 25%, transparent 25.5%, transparent 75%, #161d2677 75%, #161d2677),
        linear-gradient(60deg, #161d2677 25%, transparent 25.5%, transparent 75%, #161d2677 75%, #161d2677)`,
      backgroundSize: '40px 70px',
      backgroundPosition: '0 0, 0 0, 20px 35px, 20px 35px, 0 0, 20px 35px'
    }
  },
  {
    id: 'midnight-blue',
    name: 'آبی اقیانوسی تلگرام',
    previewClass: 'bg-gradient-to-b from-[#0e1e2d] to-[#09141f]',
    style: {
      background: 'linear-gradient(180deg, #0e1f30 0%, #0a1522 100%)',
      backgroundImage: `radial-gradient(circle at 50% 30%, rgba(51, 144, 236, 0.08) 0%, transparent 60%)`
    }
  }
];

export function resolveWallpaperStyle(wallpaper?: string): React.CSSProperties {
  if (!wallpaper || wallpaper === 'default') {
    return WALLPAPER_PRESETS[0].style;
  }

  // Check if it's one of the presets
  const preset = WALLPAPER_PRESETS.find(p => p.id === wallpaper);
  if (preset) {
    return preset.style;
  }

  // If it's a custom image URL or base64 data URL
  if (wallpaper.startsWith('http') || wallpaper.startsWith('data:image')) {
    return {
      backgroundImage: `url("${wallpaper}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: 'var(--tg-bg, #0e1621)'
    };
  }

  return WALLPAPER_PRESETS[0].style;
}
