import { MeshGradient } from "@paper-design/shaders-react";

export default function GrainGradientBg() {
  return (
    <div className="absolute inset-0 z-0">
      <MeshGradient
        colors={[ "#e8a08a", "#f0ede5", "#faf9f5"]}
        distortion={0.5}
        swirl={0.3}
        grainMixer={0.2}
        grainOverlay={0.15}
        speed={0.5}
        scale={1}
        style={{ width: "100%", height: "100%" }}
      />
      {/* Bottom fade to cream for smooth section transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-cream z-[1]" />
    </div>
  );
}
