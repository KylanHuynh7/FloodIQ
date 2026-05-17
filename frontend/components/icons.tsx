type IconProps = { size?: number; className?: string };

const base = (size = 14, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  className,
  "aria-hidden": true,
});

export const DownloadIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 2v9m0 0l3-3m-3 3L5 8M3 13h10" />
  </svg>
);

export const InfoIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7v4M8 5v.5" />
  </svg>
);

export const PinIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 14V8.5M8 8.5a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
);

export const WarnIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 2.5l6 11H2l6-11zM8 7v3M8 11.5v.5" />
  </svg>
);

export const MapIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2 4l4-1.5 4 1.5 4-1.5v9.5L10 13.5 6 12 2 13.5V4zM6 2.5v9.5M10 4v9.5" />
  </svg>
);

export const WaveIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2 6c1 0 1 1.5 2 1.5S5 6 6 6s1 1.5 2 1.5S9 6 10 6s1 1.5 2 1.5S13 6 14 6M2 10c1 0 1 1.5 2 1.5S5 10 6 10s1 1.5 2 1.5S9 10 10 10s1 1.5 2 1.5S13 10 14 10" />
  </svg>
);

export const ArrowIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
  </svg>
);
