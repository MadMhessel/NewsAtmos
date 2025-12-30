import React from 'react';
import { Link as RLink, useNavigate, useLocation, useParams as useRParams } from 'react-router-dom';

// Shim for next/link
export default function Link({ href, children, className, ...props }: any) {
  return <RLink to={href} className={className} {...props}>{children}</RLink>;
}

// Shim for next/image
export function Image({ src, alt, fill, className, priority, sizes, ...props }: any) {
  const style: React.CSSProperties = fill 
    ? { position: 'absolute', height: '100%', width: '100%', inset: 0, objectFit: 'cover' } 
    : {};
    
  return <img src={src} alt={alt} className={className} style={style} {...props} />;
}

// Shim for next/navigation
export function useRouter() {
  const navigate = useNavigate();
  return { 
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1)
  };
}

export function useSearchParams() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  return { get: (key: string) => searchParams.get(key) };
}

export function useParams() {
  return useRParams();
}

export function notFound() {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate('/404', { replace: true });
  }, [navigate]);
  return null;
}
