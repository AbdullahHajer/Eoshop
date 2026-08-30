import React from "react";

interface ProductArtProps {
  keyword: string;
  primaryColor: string;
  imageUrl?: string;
  alt?: string;
  sizes?: string;
  loading?: "eager" | "lazy";
}

export default function ProductArt({ keyword, primaryColor, imageUrl, alt = "", sizes = "(min-width: 1024px) 25vw, 50vw", loading = "lazy" }: ProductArtProps) {
  const color = primaryColor || "#D4AF37";

  if (imageUrl && imageUrl.trim() !== "") {
    return (
      <div className="w-full h-full relative overflow-hidden flex items-center justify-center rounded-xl bg-slate-50">
        <img 
          src={imageUrl} 
          alt={alt}
          loading={loading}
          decoding="async"
          sizes={sizes}
          className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  switch (keyword) {
    case "perfume":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="40" width="40" height="45" rx="8" fill={`${color}15`} stroke={color} strokeWidth="2.5" />
          <path d="M42 40V30H58V40" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="46" y="24" width="8" height="6" rx="1" fill={color} />
          <circle cx="50" cy="62" r="10" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M50 55V69M43 62H57" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M15 25C25 15 35 30 50 30" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.3" strokeDasharray="2 2" />
          <path d="M85 25C75 15 65 30 50 30" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.3" strokeDasharray="2 2" />
        </svg>
      );
    case "oud-wood":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 75C25 60 40 55 50 65C60 75 75 70 80 60C70 45 55 35 45 45C35 55 25 50 20 75Z" fill={`${color}15`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M30 65C33 58 42 55 48 60" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M55 60C62 50 70 52 73 58" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 20C48 25 52 30 50 35" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <path d="M58 15C56 20 60 25 58 30" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </svg>
      );
    case "incense":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M25 70L30 85H70L75 70" fill={`${color}10`} stroke={color} strokeWidth="2.5" />
          <path d="M20 70C20 50 35 40 50 40C65 40 80 50 80 70H20Z" fill={`${color}20`} stroke={color} strokeWidth="2.5" />
          <circle cx="50" cy="55" r="4" fill={color} />
          <path d="M35 70H65" stroke={color} strokeWidth="2" />
          <path d="M50 40V20" stroke={color} strokeWidth="2" strokeDasharray="4 4" />
          <path d="M45 35C43 30 47 25 45 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M55 35C53 30 57 25 55 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    case "home-decor":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M35 30H65L60 65C58 75 42 75 40 65L35 30Z" fill={`${color}15`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          <ellipse cx="50" cy="30" rx="15" ry="5" stroke={color} strokeWidth="2.5" />
          <path d="M28 35C24 45 30 55 35 55" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M72 35C76 45 70 55 65 55" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 15V25" stroke={color} strokeWidth="1.5" />
          <circle cx="50" cy="12" r="3" fill={color} />
        </svg>
      );
    case "headphones":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M25 55C25 35 35 20 50 20C65 20 75 35 75 55" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <rect x="20" y="50" width="10" height="20" rx="4" fill={color} />
          <rect x="70" y="50" width="10" height="20" rx="4" fill={color} />
          <path d="M30 60H26" stroke={color} strokeWidth="1.5" />
          <path d="M70 60H74" stroke={color} strokeWidth="1.5" />
          <path d="M50 10C50 15 45 15 45 10" stroke={color} strokeWidth="1" />
          <circle cx="50" cy="50" r="1.5" fill={color} opacity="0.5" />
          <path d="M12 60C15 55 18 65 21 60" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
          <path d="M88 60C85 55 82 65 79 60" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        </svg>
      );
    case "charger":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="45" width="50" height="12" rx="6" fill={`${color}15`} stroke={color} strokeWidth="2.5" />
          <path d="M50 35L44 48H52L46 62" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="51" r="22" stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        </svg>
      );
    case "smartwatch":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="42" y="15" width="16" height="70" rx="4" fill={`${color}25`} />
          <rect x="30" y="30" width="40" height="40" rx="10" fill="#ffffff" stroke={color} strokeWidth="3" />
          <circle cx="50" cy="50" r="12" fill={`${color}10`} />
          <path d="M50 42V50L55 53" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="70" y="46" width="3" height="8" rx="1" fill={color} />
          <path d="M35 38H45" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case "lamp":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 85H70" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M50 85V50" stroke={color} strokeWidth="2.5" />
          <path d="M50 50L35 30H65L50 50Z" fill={`${color}15`} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="50" cy="35" r="5" fill={color} />
          <path d="M20 15C25 15 30 25 50 25" stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
          <path d="M80 15C75 15 70 25 50 25" stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
        </svg>
      );
    case "coffee-cup":
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 35H70V60C70 70 60 78 50 78C40 78 30 70 30 60V35Z" fill={`${color}15`} stroke={color} strokeWidth="2.5" />
          <path d="M70 42H78C82 42 84 46 84 50C84 54 82 58 78 58H70" stroke={color} strokeWidth="2.5" />
          <path d="M25 83H75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M42 25C42 20 45 18 45 15" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M50 25C50 20 53 18 53 15" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M58 25C58 20 61 18 61 15" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full p-4" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="25" width="50" height="50" rx="8" fill={`${color}10`} stroke={color} strokeWidth="2" />
          <path d="M25 40L50 55L75 40" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M50 25V55" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx="50" cy="50" r="15" stroke={color} strokeWidth="1.5" opacity="0.3" />
        </svg>
      );
  }
}
