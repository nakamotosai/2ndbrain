import { NextRequest, NextResponse } from 'next/server';

// CORS 配置
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export function middleware(request: NextRequest) {
    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: CORS_HEADERS,
        });
    }

    // 对于其他请求，添加 CORS 头
    const response = NextResponse.next();

    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}

// 只对 API 路由应用 middleware
export const config = {
    matcher: '/api/:path*',
};
