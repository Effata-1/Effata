import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source:      '/policies/coaching-templates',
        destination: '/genai-controls/coaching-messages',
        permanent:   false,
      },
    ]
  },
};

export default nextConfig;
