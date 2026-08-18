export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isRealAvatar(avatar) {
  return Boolean(avatar && !avatar.includes('images.unsplash.com'));
}

export function getCloudinaryThumbnail(url, width, height = width, crop = 'fill') {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }

  return url.replace(
    '/image/upload/',
    `/image/upload/c_${crop},w_${width},h_${height},q_auto,f_auto/`
  );
}

export function getCloudinaryMicroPreview(url) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return undefined;
  }

  return url.replace(
    '/image/upload/',
    '/image/upload/c_fill,w_24,h_24,e_blur:1000,q_1,f_auto/'
  );
}
