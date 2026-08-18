const UNCOMPRESSED_IMAGE_TYPES = new Set(['image/gif', 'image/svg+xml']);

export function shouldCompressImage(file) {
  return Boolean(
    file?.type?.startsWith('image/') && !UNCOMPRESSED_IMAGE_TYPES.has(file.type)
  );
}

export function fitImageWithin(width, height, maxDimension = 1600) {
  const scale = Math.min(1, maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressImage(file) {
  if (
    !shouldCompressImage(file) ||
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  ) {
    return file;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const dimensions = fitImageWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
