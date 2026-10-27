import QRCode from "qrcode";

export async function generateQRCodeDataURL(
  text: string,
  size = 256,
  color = "#6e56f8"
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    color: {
      dark: color,
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

export async function generateQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  size = 256,
  color = "#6e56f8"
): Promise<void> {
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 2,
    color: {
      dark: color,
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

export async function generateQRCodeBlob(
  text: string,
  size = 256,
  color = "#6e56f8"
): Promise<Blob> {
  const dataUrl = await generateQRCodeDataURL(text, size, color);
  const res = await fetch(dataUrl);
  return res.blob();
}