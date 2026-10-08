import { NextResponse } from "next/server";

const publicPostCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function withPublicPostCors(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(publicPostCorsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export function publicPostCorsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: publicPostCorsHeaders });
}
