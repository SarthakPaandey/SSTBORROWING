/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Compiler optimizations
  compiler: {
    // Remove console.log in production for smaller bundle and no debug noise
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Don't generate source maps in production (faster builds, smaller output)
  productionBrowserSourceMaps: false,
  // Tree-shake large icon/utility libraries
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Optimize chunk splitting for heavy animation/chart libraries
    optimizePackageImports: ['framer-motion', 'recharts'],
  },
  images: {
    // Use remotePatterns instead of deprecated 'domains'
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
    ],
    // Use modern image formats for faster loading
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
