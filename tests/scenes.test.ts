import { describe, expect, it } from "vitest";
import {
  activeScene,
  defaultScene,
  EMPTY_SCENES,
  MAX_SCENES,
  moveScene,
  removeScene,
  sanitizeScene,
  sanitizeScenes,
  sceneFlags,
  upsertScene,
} from "@/lib/live/scenes";

const settings = { showTimer: false, showTicker: true, showQrCode: false };

describe("cenas do telão", () => {
  it("limite de 4 cenas por evento", () => {
    let st = EMPTY_SCENES;
    for (let i = 0; i < MAX_SCENES; i++) st = upsertScene(st, defaultScene("ranking", `cena${i}`));
    expect(st.items).toHaveLength(4);
    expect(() => upsertScene(st, defaultScene("title", "cena9"))).toThrow(/4 cenas/);
    // editar uma existente continua valendo no limite
    const edited = upsertScene(st, { ...st.items[1], name: "Outra" });
    expect(edited.items[1].name).toBe("Outra");
    expect(edited.items).toHaveLength(4);
  });

  it("sanitiza o que vem do banco: corta excesso, ids repetidos e cena no ar inexistente", () => {
    const raw = {
      items: [
        { id: "aaaa1", layout: "leaders", topN: 5 },
        { id: "aaaa1", layout: "title" },
        { id: "bbbb2", layout: "xpto", name: "  Minha   cena  " },
        { id: "cccc3" },
        { id: "dddd4" },
        { id: "eeee5" },
      ],
      activeId: "zzzz9",
    };
    const st = sanitizeScenes(raw);
    expect(st.items.map((s) => s.id)).toEqual(["aaaa1", "bbbb2", "cccc3", "dddd4"]);
    expect(st.items[1].layout).toBe("ranking");
    expect(st.items[1].name).toBe("Minha cena");
    expect(st.activeId).toBeNull();
    expect(sanitizeScenes(null)).toEqual(EMPTY_SCENES);
  });

  it("valores inválidos voltam ao padrão da disposição", () => {
    const s = sanitizeScene({ id: "abcd1", layout: "camera", topN: 7, board: "neon", showTimer: "talvez", title: "x".repeat(200) });
    expect(s.topN).toBe(5);
    expect(s.board).toBe("theme");
    expect(s.showTimer).toBe("auto");
    expect(s.title.length).toBe(60);
    expect(s.showHeader).toBe(false);
  });

  it("apagar a cena no ar volta ao automático", () => {
    let st = upsertScene(upsertScene(EMPTY_SCENES, defaultScene("ranking", "aaaa1")), defaultScene("podium", "bbbb2"));
    st = { ...st, activeId: "bbbb2" };
    expect(activeScene(st)?.layout).toBe("podium");
    const after = removeScene(st, "bbbb2");
    expect(after.activeId).toBeNull();
    expect(activeScene(after)).toBeNull();
    expect(moveScene(st, "bbbb2", -1).items.map((s) => s.id)).toEqual(["bbbb2", "aaaa1"]);
    expect(moveScene(st, "aaaa1", -1)).toBe(st);
  });

  it("flags: automático segue o evento, a cena pode forçar", () => {
    expect(sceneFlags(null, settings)).toEqual({ header: true, timer: false, ticker: true, qr: false, cameraOverlay: true });
    const spot = defaultScene("spotlight", "aaaa1");
    expect(sceneFlags(spot, settings).timer).toBe(true);
    expect(sceneFlags({ ...spot, showTicker: "off" }, settings).ticker).toBe(false);
    expect(sceneFlags(spot, settings).cameraOverlay).toBe(false);
    expect(sceneFlags({ ...defaultScene("ranking", "bbbb2"), camera: "off" }, settings).cameraOverlay).toBe(false);
    expect(sceneFlags(defaultScene("title", "cccc3"), settings)).toMatchObject({ header: false, qr: true, ticker: false });
  });
});
