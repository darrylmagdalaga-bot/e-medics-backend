import React from 'react';
import './GradientText.css';

export default function GradientText({
  children,
  className = "",
  colors = ["#4ade80", "#22d3ee", "#3b82f6", "#4ade80"], // default green-blue gradient
  animationSpeed = 3,
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
    animationDuration: `${animationSpeed}s`,
  };

  return (
    <div
      className={`inline-block text-transparent bg-cover animate-gradient bg-clip-text font-black tracking-wider ${className}`}
      style={{
        ...gradientStyle,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        backgroundSize: "300% 100%",
      }}
    >
      {children}
    </div>
  );
}
