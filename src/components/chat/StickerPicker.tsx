"use client";

import React from "react";
import { X, Smile } from "lucide-react";

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (stickerUrl: string) => void;
}

const STICKER_PACKS = [
  {
    category: "Brown & Friends",
    stickers: [
      "https://api.dicebear.com/7.x/bottts/svg?seed=BrownWave&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=BrownLove&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=BrownHappy&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=BrownCool&scale=120",
    ],
  },
  {
    category: "Cony & Sally",
    stickers: [
      "https://api.dicebear.com/7.x/bottts/svg?seed=ConyCheer&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=ConyDance&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=SallyJoy&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=SallyFly&scale=120",
    ],
  },
  {
    category: "Anime & Expressions",
    stickers: [
      "https://api.dicebear.com/7.x/bottts/svg?seed=AnimeWow&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=AnimeGiggle&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=AnimeCry&scale=120",
      "https://api.dicebear.com/7.x/bottts/svg?seed=AnimeSleep&scale=120",
    ],
  },
];

export function StickerPicker({
  isOpen,
  onClose,
  onSelectSticker,
}: StickerPickerProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-20 left-4 sm:left-6 w-80 max-w-[90vw] bg-white dark:bg-[#1E202B] rounded-3xl p-4 shadow-2xl border border-black/[0.08] dark:border-white/[0.1] z-40 animate-in fade-in zoom-in-95 duration-150 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
          <Smile className="w-4 h-4 text-[#06C755]" />
          <span>Chaline Stickers</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stickers list */}
      <div className="max-h-64 overflow-y-auto pt-3 flex flex-col gap-3">
        {STICKER_PACKS.map((pack) => (
          <div key={pack.category} className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              {pack.category}
            </span>
            <div className="grid grid-cols-4 gap-2">
              {pack.stickers.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelectSticker(url);
                    onClose();
                  }}
                  className="aspect-square p-2 rounded-2xl hover:bg-[#06C755]/10 dark:hover:bg-white/[0.05] transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Sticker"
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
