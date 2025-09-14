import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    serverExternalPackages: ['sharp'],
    images: {
        // Disable default image optimization to avoid conflicts
        loader: 'custom',
        loaderFile: './lib/imageLoader.js',
    },
    // Enable standalone output for Docker deployment
    output: 'standalone',
};

export default nextConfig;
