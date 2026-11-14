import { describe, expect, it } from "vitest";
import { cameraEmbed, cleanMessage, DEFAULT_CAMERA, messageVisible, sanitizeCamera } from "@/lib/screen";

describe("aviso do telão", () => {
  it("limpa o texto e respeita a validade", () => {
    expect(cleanMessage("  Intervalo   de 15\\n min  ")).toBe("Intervalo de 15\\n min");
    expect(cleanMessage("x".repeat(300))).toHaveLength(140);
    const m = { text: "Oi", tone: "info" as const, at: 1000, until: 5000 };
    expect(messageVisible(m, 4000)).toBe(true);
    expect(messageVisible(m, 5000)).toBe(false);
    expect(messageVisible({ ...m, until: null }, 1e12)).toBe(true);
    expect(messageVisible(null, 0)).toBe(false);
  });
});

describe("câmera do telão", () => {
  it("reconhece YouTube, Twitch, Vimeo e vídeo direto", () => {
    for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/live/dQw4w9WgXcQ?si=x"])
      expect(cameraEmbed(url)?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1");
    expect(cameraEmbed("https://www.twitch.tv/robostage", "telao.local")?.src).toBe(
      "https://player.twitch.tv/?channel=robostage&parent=telao.local&muted=true&autoplay=true",
    );
    expect(cameraEmbed("https://vimeo.com/123456789")?.src).toContain("player.vimeo.com/video/123456789");
    expect(cameraEmbed("https://cdn.exemplo.com/arena.mp4")).toEqual({ kind: "video", provider: "Vídeo", src: "https://cdn.exemplo.com/arena.mp4" });
    expect(cameraEmbed("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(cameraEmbed("https://exemplo.com/pagina")).toBeNull();
    expect(cameraEmbed("javascript:alert(1)")).toBeNull();
  });

  it("valida a configuração e mantém o que não veio no patch", () => {
    const base = sanitizeCamera({ source: "url", url: "https://youtu.be/dQw4w9WgXcQ", layout: "split" });
    expect(sanitizeCamera({ enabled: true }, base)).toMatchObject({ enabled: true, source: "url", layout: "split" });
    expect(sanitizeCamera({ layout: "x", corner: "zz" })).toMatchObject({ layout: DEFAULT_CAMERA.layout, corner: DEFAULT_CAMERA.corner });
    expect(() => sanitizeCamera({ url: "http://inseguro" })).toThrow(/https/);
  });
});
