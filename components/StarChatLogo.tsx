import React from 'react';

export const STARCHAT_LOGO_URL = '/assets/aistudio/Redesign_messaging_app_logo_2K_20261024155118-removebg-preview_b2ab75e4.png';

interface StarChatLogoProps {
  variant?: 'full' | 'symbol';
  size?: number; // For symbol (width & height in px)
  height?: number; // For full logo (height in px)
  className?: string;
  imgClassName?: string;
}

export const StarChatLogo: React.FC<StarChatLogoProps> = ({
  variant = 'symbol',
  size = 40,
  height = 50,
  className = '',
  imgClassName = ''
}) => {
  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={STARCHAT_LOGO_URL}
          alt="StarChat Logo"
          className={`object-contain pointer-events-none select-none max-w-full ${imgClassName}`}
          style={{ height: `${height}px`, width: 'auto', maxHeight: `${height}px` }}
        />
      </div>
    );
  }

  // Symbol variant: Perfectly centered signature red & navy star speech bubbles
  return (
    <div
      className={`relative overflow-hidden shrink-0 select-none flex items-center justify-center ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <img
        src={STARCHAT_LOGO_URL}
        alt="StarChat"
        className={`absolute max-w-none pointer-events-none select-none transition-transform ${imgClassName}`}
        style={{
          width: `${size * 2.15}px`,
          height: `${size * 2.15}px`,
          left: `${size * -0.029}px`,
          top: '50%',
          transform: 'translateY(-50%)'
        }}
      />
    </div>
  );
};
