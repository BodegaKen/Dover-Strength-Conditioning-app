/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app does not use next/image anywhere, so the image-optimization endpoint is turned off
  // (it was the surface of Next.js advisory GHSA-2464-fhr4-w9xw).
  images: { unoptimized: true },
};

export default nextConfig;
