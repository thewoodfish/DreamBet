/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Privy reaches for Farcaster's Solana connector behind a runtime check.
    // DreamBet is EVM-only on Somnia and never logs in through Farcaster, so
    // the package is left uninstalled and stubbed out rather than bundled —
    // webpack otherwise fails the build on an import that can never run.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
