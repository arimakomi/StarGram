/**
 * Image compression utility using HTML5 Canvas to prevent browser localStorage quota exceeded errors.
 */

export async function compressImage(
  file: File | Blob,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8,
  preserveTransparency = false
): Promise<string> {
  // Robust guard: if caller passed quality in second or third param (e.g. compressImage(file, 1600, 0.85))
  if (maxHeight < 1 && quality === 0.8) {
    quality = maxHeight;
    maxHeight = maxWidth;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (!preserveTransparency) {
          // Pre-fill canvas with solid pure white (#FFFFFF)
          // Ensures transparent PNG/WebP images composite onto a clean white background instead of black
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        } else {
          // Clear rect to guarantee transparent alpha channel
          ctx.clearRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as PNG if preserving transparency, otherwise as JPEG with chosen quality
        const compressedDataUrl = preserveTransparency 
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
