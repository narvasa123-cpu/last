interface PointsBarProps {
  value: number;
}

export function PointsBar({ value }: PointsBarProps) {
  return (
    <div className="progress-shell" aria-label="Points progress">
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}
