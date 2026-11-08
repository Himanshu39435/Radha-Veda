import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '../lib/utils';
// Image with a branded fallback so a missing/broken URL never shows alt text spilling over the layout
export default function Img({ src, alt = '', className, ...p }) {
  const [bad, setBad] = useState(!src); useEffect(() => setBad(!src), [src]);
  if (bad) return <div role="img" aria-label={alt} className={cn('grid place-items-center bg-gradient-to-br from-beige to-sage-light text-sage-dark', className)}><Leaf className="h-1/3 w-1/3 max-h-12 max-w-12 opacity-50" /></div>;
  return <img src={src} alt={alt} className={className} onError={() => setBad(true)} {...p} />;
}
