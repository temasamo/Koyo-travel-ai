import React from "react";
import Image from "next/image";

export default function FaceMeshResultCard({ faceMesh }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6">
      <h3 className="text-lg font-semibold text-blue-700 mb-4">
        🧠 精密数値測定結果（FaceMesh単独）
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <MetricWithIllustration
          label="顔の幅"
          value={`${faceMesh.faceWidth.toFixed(0)}mm`}
          diff={faceMesh.faceWidthChange.toFixed(1)}
          image="/images/metrics/face-width.svg"
          desc="左右の端から端まで"
        />

        <MetricWithIllustration
          label="顔の長さ"
          value={`${faceMesh.faceHeight.toFixed(0)}mm`}
          diff={faceMesh.faceHeightChange.toFixed(1)}
          image="/images/metrics/face-height.svg"
          desc="額から顎まで"
        />

        <MetricWithIllustration
          label="目の間隔"
          value={`${faceMesh.eyeDistance.toFixed(1)}mm`}
          diff={faceMesh.eyeDistanceChange.toFixed(1)}
          image="/images/metrics/eye-distance.svg"
          desc="左右の目の中心間"
        />

        <MetricWithIllustration
          label="眉と目の距離"
          value={`${faceMesh.browEyeDistance.toFixed(1)}mm`}
          diff={faceMesh.browEyeChange.toFixed(1)}
          image="/images/metrics/brow-eye.svg"
          desc="眉毛から目まで"
        />

        <MetricWithIllustration
          label="フェイスリフト角度"
          value={`${faceMesh.liftAngle.toFixed(1)}°`}
          diff={faceMesh.liftAngleChange.toFixed(1)}
          image="/images/metrics/lift-angle.svg"
          desc="目尻→口角→顎先の角度"
        />

        <MetricWithIllustration
          label="下顔面比率"
          value={`${faceMesh.lowerFaceRatio.toFixed(3)}`}
          diff={faceMesh.lowerFaceChange.toFixed(3)}
          image="/images/metrics/lower-face.svg"
          desc="鼻下→口角→顎先の比率"
        />

        <MetricWithIllustration
          label="フェイスライン角度"
          value={`${faceMesh.faceLineAngle.toFixed(2)}°`}
          image="/images/metrics/face-line.svg"
          desc="顎先から耳下までの傾き"
        />

        <MetricWithIllustration
          label="顔の左右対称性スコア"
          value={faceMesh.symmetryIndex.toFixed(3)}
          image="/images/metrics/symmetry.svg"
          desc="左右バランスの整い度"
        />

        <MetricWithIllustration
          label="頬の膨らみ度"
          value={faceMesh.cheekVolume.toFixed(3)}
          image="/images/metrics/cheek-volume.svg"
          desc="頬骨と頬中央の距離"
        />

        <MetricWithIllustration
          label="目尻リフト角度"
          value={`${faceMesh.eyeLiftAngle.toFixed(2)}°`}
          image="/images/metrics/eye-lift.svg"
          desc="目尻の上がり具合"
        />
      </div>
    </div>
  );
}

function MetricWithIllustration({ label, value, diff, desc, image }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex flex-col items-center text-center">
      <div className="font-semibold text-gray-800 mb-1">{label}</div>
      <Image
        src={image}
        alt={label}
        width={60}
        height={60}
        className="mb-2 opacity-80"
      />
      <div className="text-blue-600 text-base font-medium">{value}</div>
      {diff && (
        <div
          className={`text-xs ${
            Number(diff) < 0 ? "text-green-600" : "text-red-500"
          }`}
        >
          変化量: {diff}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-1">{desc}</div>
    </div>
  );
}
