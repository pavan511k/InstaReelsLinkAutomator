import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
    // Enabled when ANALYZE=true is passed to next build.
    // Opens three reports (client / nodejs / edge) in the browser after build.
    enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
};

export default withBundleAnalyzer(nextConfig);
