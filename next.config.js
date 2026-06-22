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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'query.ampre.ca' },
    ],
  },
}

module.exports = nextConfig
