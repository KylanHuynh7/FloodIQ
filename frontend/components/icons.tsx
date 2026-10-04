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

export const WarnIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 2.5l6 11H2l6-11zM8 7v3M8 11.5v.5" />
  </svg>
);

export const ArrowIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
  </svg>
);

export const CheckIcon = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

