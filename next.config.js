/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["https://agentic-b77f8142.vercel.app", "http://localhost:3000"],
    },
  },
};

module.exports = nextConfig;
