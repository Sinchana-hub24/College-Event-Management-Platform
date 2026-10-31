import React, { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { resolveEventBanner } from "../types";

interface EventImageProps {
  imageUrl?: string;
  category: string;
  alt: string;
  className?: string;
}

export const EventImage: React.FC<EventImageProps> = ({
  imageUrl,
  category,
  alt,
  className = "w-full h-full object-cover",
}) => {
  const resolved = resolveEventBanner(imageUrl, category);
  const [src, setSrc] = useState<string>(resolved);
  const [failedAll, setFailedAll] = useState<boolean>(false);

  useEffect(() => {
    setSrc(resolveEventBanner(imageUrl, category));
    setFailedAll(false);
  }, [imageUrl, category]);

  if (failedAll) {
    return (
      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-300 select-none">
        <Calendar className="w-7 h-7 text-rose-400 mb-2" />
        <span className="font-display text-sm font-semibold tracking-tight text-white text-center line-clamp-1">
          {alt}
        </span>
        <span className="text-xs text-slate-400 mt-0.5">{category}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        const fallback = resolveEventBanner("", category);
        if (src !== fallback) {
          setSrc(fallback);
        } else {
          setFailedAll(true);
        }
      }}
    />
  );
};
