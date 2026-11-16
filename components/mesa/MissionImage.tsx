"use client";

import { useRef } from "react";
import { Expand, X } from "lucide-react";

/** Miniatura da missão na súmula; toque para ver em tela cheia. */
export function MissionImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="group relative block w-full overflow-hidden rounded-tl-xl rounded-br-xl border border-base-300 bg-base-200"
        aria-label={`Ampliar imagem: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-44 w-full object-contain p-2 transition group-hover:scale-[1.02] sm:h-52" />
        <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-tl-md rounded-br-md bg-base-100/85 text-base-content shadow">
          <Expand size={15} />
        </span>
      </button>
      <dialog ref={ref} className="modal" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="modal-box max-w-4xl rounded-tl-3xl rounded-br-3xl rounded-tr-none rounded-bl-none border-2 border-base-content p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="mx-auto max-h-[75vh] w-auto rounded-tl-2xl rounded-br-2xl object-contain" />
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-medium">{alt}</p>
            <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => ref.current?.close()} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
