/** @type {import('next').NextConfig} */
const nextConfig = {
    // 将原生模块排除在 webpack 打包之外
    experimental: {
        serverComponentsExternalPackages: ['better-sqlite3', '@lancedb/lancedb'],
    },
    // webpack 配置
    webpack: (config, { isServer }) => {
        if (isServer) {
            // 忽略原生模块的 webpack 处理
            config.externals.push({
                'better-sqlite3': 'commonjs better-sqlite3',
                '@lancedb/lancedb': 'commonjs @lancedb/lancedb',
            });
        }
        return config;
    },
};

export default nextConfig;
