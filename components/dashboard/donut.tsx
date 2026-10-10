export function Donut({
  segments,
  size = 160,
  stroke = 22,
  centerTop,
  centerBottom,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  centerTop?: string;
  centerBottom?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segmentData = segments.reduce<
    {
      segment: (typeof segments)[number];
      length: number;
      offset: number;
    }[]
  >((acc, segment) => {
    const length = (segment.value / total) * circumference;
    const offset =
      acc.length > 0
        ? acc[acc.length - 1].offset + acc[acc.length - 1].length
        : 0;

    return [
      ...acc,
      {
        segment,
        length,
        offset,
      },
    ];
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={
        centerTop && centerBottom
          ? `${centerTop} ${centerBottom}`
          : "Donut chart"
      }
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={stroke}
      />

      {/* Segments */}
      {segmentData.map(({ segment, length, offset }, index) => (
        <circle
          key={`${segment.label}-${index}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={stroke}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="butt"
        />
      ))}

      {/* Center top text */}
      {centerTop && (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          fill="var(--foreground)"
          style={{
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {centerTop}
        </text>
      )}

      {/* Center bottom text */}
      {centerBottom && (
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          fill="var(--muted-foreground)"
          style={{
            fontSize: 11,
          }}
        >
          {centerBottom}
        </text>
      )}
    </svg>
  );
}
