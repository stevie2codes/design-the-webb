/**
 * Vignette + grain (SPEC §2.4): two fixed layers between the field canvas
 * and the content, so they never touch text contrast. The grain animates
 * only on the High tier (html[data-tier="high"], set by the engine).
 */
export default function Atmosphere() {
  return (
    <>
      <div aria-hidden="true" className="atmo atmo-vignette" />
      <div aria-hidden="true" className="atmo">
        <div className="atmo-grain" />
      </div>
    </>
  );
}
