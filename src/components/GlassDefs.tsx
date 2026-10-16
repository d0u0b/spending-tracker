import { useEffect } from 'react';

/**
 * 液態玻璃的折射濾鏡。只有 Chromium 支援在 backdrop-filter 使用 SVG 濾鏡，
 * 因此只在 Chromium 加上 html.lg-refract，其他瀏覽器維持一般毛玻璃。
 */
export function GlassDefs() {
  useEffect(() => {
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
    if (brands?.some((b) => b.brand === 'Chromium')) document.documentElement.classList.add('lg-refract');
  }, []);

  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <filter id="lg-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="11" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="28" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
