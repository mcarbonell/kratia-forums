
// @ts-check
// const { i18n } = require('./next-i18next.config.js'); // No longer importing this for nextConfig.i18n

/** @type {import('next').NextConfig} */
const nextConfig = {
  // i18n, // REMOVED: This was causing Next.js to expect locale-prefixed routes
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

module.exports = nextConfig;
