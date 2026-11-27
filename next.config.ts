import type { NextConfig } from "next";
import { PDF_REQUEST_MAX_BYTES } from "./utils/pdf/limits";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    // Keep the proxy from buffering more than the PDF routes will accept.
    proxyClientMaxBodySize: PDF_REQUEST_MAX_BYTES,
  },
};

export default nextConfig;
