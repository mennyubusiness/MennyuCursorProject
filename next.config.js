/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow next/image for known external hosts (menu import + common POS/CDN origins).
    // Add entries here when a new integration serves absolute image URLs.
    remotePatterns: [
      { protocol: "https", hostname: "deliverect.com", pathname: "/**" },
      { protocol: "https", hostname: "**.deliverect.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.squarecdn.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "images.ctfassets.net", pathname: "/**" },
    ],
  },
};

module.exports = nextConfig;
