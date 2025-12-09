/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { isServer }) => {
    // Fix for heic2any WebAssembly modules
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })

    // Ignore optional WebSocket dependencies for @google/genai
    // These are only needed for streaming/real-time features we don't use
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('bufferutil', 'utf-8-validate')
    }

    return config
  },
}

module.exports = nextConfig

