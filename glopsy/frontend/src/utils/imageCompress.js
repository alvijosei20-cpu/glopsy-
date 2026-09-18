export const MAX_IMAGES = 3;
export const MAX_IMAGE_DIMENSION = 1000;
export const WEBP_QUALITY = 0.72;
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

// Comprime una imagen a webp (máx 1000px) en el navegador y devuelve su data URL.
export const compressToWebp = (file) =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`${file.name}: no es una imagen válida.`));
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      reject(new Error(`${file.name}: supera el máximo de 10 MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name}: no se pudo leer el archivo.`));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`${file.name}: la imagen está dañada.`));
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('El navegador no soporta el procesamiento de imágenes.');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY);
          if (!dataUrl.startsWith('data:image/webp')) {
            reject(new Error(`${file.name}: tu navegador no puede exportar a webp.`));
            return;
          }
          resolve({ dataUrl, name: file.name });
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
