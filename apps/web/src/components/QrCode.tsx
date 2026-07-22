import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
};

// Renders a QR code for `value` as a PNG data URI. The white padding keeps it
// scannable in both light and dark themes.
export function QrCode({ value, size = 176 }: Props) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (failed) return <p className="text-sm text-red-600">Could not render QR code.</p>;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Scan to add me as a friend"
      className="rounded-xl bg-white p-2"
      style={{ width: size, height: size }}
    />
  );
}
