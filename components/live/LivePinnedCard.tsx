import React from "react";
import Link from "@/lib/next-shim";
import { LiveStream } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";
import { Image } from "@/lib/next-shim";
import { Radio } from "lucide-react";

type LivePinnedCardProps = {
  stream: LiveStream;
};

export const LivePinnedCard: React.FC<LivePinnedCardProps> = ({ stream }) => {
  return (
    <Link
      href={`/live/${stream.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg transition-shadow"
    >
      {stream.coverImage && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image src={stream.coverImage} alt={stream.title} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-destructive/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
            <Radio className="w-3 h-3" /> Онлайн
          </span>
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent mb-3">
          {stream.category?.title || 'Онлайн'}
        </div>
        <h3 className="text-xl font-bold text-foreground leading-snug mb-3 group-hover:text-accent transition-colors">
          {stream.title}
        </h3>
        {stream.lead && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {stream.lead}
          </p>
        )}
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Обновлено: {formatDateShort(stream.updatedAt)}
        </div>
      </div>
    </Link>
  );
};
