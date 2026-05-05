const petals = [
  { src: '/petals/petal-1.svg', left: '8%', top: '12%', scale: 0.9, duration: '9s', delay: '0s' },
  { src: '/petals/petal-2.svg', left: '82%', top: '14%', scale: 0.72, duration: '11s', delay: '1s' },
  { src: '/petals/petal-3.svg', left: '62%', top: '36%', scale: 0.86, duration: '10s', delay: '0.8s' },
  { src: '/petals/petal-2.svg', left: '18%', top: '58%', scale: 0.8, duration: '12s', delay: '1.8s' },
  { src: '/petals/petal-1.svg', left: '74%', top: '68%', scale: 1.02, duration: '13s', delay: '0.3s' },
  { src: '/petals/petal-3.svg', left: '38%', top: '82%', scale: 0.68, duration: '8.6s', delay: '1.2s' },
];

export function FloatingPetals() {
  return (
    <div className="petal-layer" aria-hidden="true">
      {petals.map((petal, index) => (
        <img
          key={`${petal.src}-${index}`}
          className="petal"
          src={petal.src}
          alt=""
          style={{
            left: petal.left,
            top: petal.top,
            transform: `scale(${petal.scale})`,
            animationDuration: petal.duration,
            animationDelay: petal.delay,
          }}
        />
      ))}
    </div>
  );
}
