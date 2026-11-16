import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite (Postgres embutido do modo local) carrega WASM do próprio pacote.
  serverExternalPackages: ["@electric-sql/pglite"],
  // O telão é aberto em TVs e projetores por horas seguidas: nada de
  // indexar páginas de evento.
  async headers() {
    return [
      {
        source: "/e/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/mesa/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/banca/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
