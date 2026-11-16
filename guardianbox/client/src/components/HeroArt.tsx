import VaultCoin from './VaultCoin';

/** Three tilted, glowing coins, in the spirit of the reference. Purely decorative. */
export default function HeroArt() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[460px] sm:h-[380px] lg:h-[460px] lg:max-w-none" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(255_140_20/0.22),transparent)]" />
      <div className="coin absolute left-[20%] top-[8%] w-[56%] [transform:perspective(900px)_rotateY(-24deg)_rotateX(14deg)_rotateZ(-6deg)]">
        <VaultCoin glyph="shield" className="w-full drop-shadow-[0_0_40px_rgb(255_130_10/0.35)]" />
      </div>
      <div className="coin coin-b absolute bottom-[2%] left-[-2%] w-[36%] [transform:perspective(900px)_rotateY(20deg)_rotateX(-10deg)_rotateZ(10deg)]">
        <VaultCoin glyph="lock" className="w-full drop-shadow-[0_0_30px_rgb(255_130_10/0.3)]" />
      </div>
      <div className="coin coin-c absolute bottom-[10%] right-[-2%] w-[30%] [transform:perspective(900px)_rotateY(-30deg)_rotateX(18deg)_rotateZ(14deg)]">
        <VaultCoin glyph="hash" className="w-full drop-shadow-[0_0_26px_rgb(255_130_10/0.3)]" />
      </div>
    </div>
  );
}
