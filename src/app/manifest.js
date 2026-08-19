export default function manifest() {
  return {
    id: '/',
    name: 'Wave',
    short_name: 'Wave',
    description:
      'A quiet little place for the people you actually want to hear from. Messages, photos, voice notes, and calls — nothing else.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#f8f9fa',
    theme_color: '#0058be',
    categories: ['social', 'productivity', 'communication'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/wave-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/wave-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/wave-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Open messages',
        short_name: 'Messages',
        url: '/?tab=messages',
        icons: [{ src: '/wave-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Find people',
        short_name: 'People',
        url: '/?tab=contacts',
        icons: [{ src: '/wave-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
