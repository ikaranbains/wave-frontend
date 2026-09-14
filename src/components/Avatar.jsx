'use client';

import React, { memo, useState } from 'react';
import Image from 'next/image';
import { getInitials, isRealAvatar } from '../utils/avatarUtils';

export const Avatar = memo(function Avatar({
  src,
  name,
  size = 40,
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  priority = false,
  unoptimized = false,
}) {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(name);
  const isValidSrc = isRealAvatar(src) && !hasError;

  if (isValidSrc) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`relative flex-shrink-0 overflow-hidden rounded-full ${className}`}
      >
        <Image
          src={src}
          alt={name ? `${name}'s avatar` : 'Avatar'}
          width={size}
          height={size}
          priority={priority}
          unoptimized={unoptimized}
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      aria-label={name ? `${name}'s avatar` : 'Avatar placeholder'}
      className={`relative flex flex-shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container font-semibold text-on-primary ${fallbackClassName} ${className}`}
    >
      <span style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}>
        {initials}
      </span>
    </div>
  );
});
