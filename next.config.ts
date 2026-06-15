import type { NextConfig } from "next";
import { REDIRECT_RULES } from './src/lib/redirects';

const nextConfig: NextConfig = {
  async redirects() {
    return REDIRECT_RULES.map(r => ({ ...r, permanent: false }))
  },
};

export default nextConfig;
