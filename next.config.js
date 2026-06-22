/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/ravihooda.html',
        permanent: false,
      },
      {
        source: '/112-nordic-road',
        destination: '/112-nordic-road/index.html',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    // The 112 Nordic Road listing app is a Vite SPA served from
    // /112-nordic-road/. Its JSX hardcodes image paths as absolute /images/...
    // which resolve to the domain root. These rewrites proxy them to where
    // the images actually live.
    return [
      {
        source: '/images/:path*',
        destination: '/112-nordic-road/images/:path*',
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'query.ampre.ca' },
    ],
  },
}

module.exports = nextConfig
