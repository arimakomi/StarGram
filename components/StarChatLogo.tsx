import React from 'react';

export const STARCHAT_LOGO_URL = '/assets/aistudio/Redesign_messaging_app_logo_2K_20261024155118-removebg-preview_b2ab75e4.png';
export const STARCHAT_MINIMAL_LOGO_URL = '/assets/aistudio/starchat-minimal.png';

interface StarChatLogoProps {
  variant?: 'full' | 'symbol';
  size?: number; // For symbol (width & height in px)
  height?: number; // For full logo (height in px)
  className?: string;
  imgClassName?: string;
  src?: string; // Optional custom logo URL
}

export const StarChatLogo: React.FC<StarChatLogoProps> = ({
  variant = 'symbol',
  size = 40,
  height = 50,
  className = '',
  imgClassName = '',
  src
}) => {
  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={src || STARCHAT_LOGO_URL}
          alt="StarChat Logo"
          className={`object-contain pointer-events-none select-none max-w-full ${imgClassName}`}
          style={{ height: `${height}px`, width: 'auto', maxHeight: `${height}px` }}
        />
      </div>
    );
  }

  // Symbol variant: Clean, perfectly centered signature minimal logo without square wrapper
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <img
        src={src || STARCHAT_MINIMAL_LOGO_URL}
        alt="StarChat"
        className={`object-contain pointer-events-none select-none max-w-full max-h-full transition-transform ${imgClassName}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </div>
  );
};

