import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  redirects() {
    return [
      {
        source: "/profile",
        destination: "/settings",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
