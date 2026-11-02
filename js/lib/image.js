// Krymper ett foto innan uppladdning: snabbare på mobilnät och lagom stort
// för avläsningen (bokryggstext behöver upplösning, men över ~2400 px på
// långsidan vinner modellen inget).

export async function resizeToJpeg(file, maxEdge = 2400, quality = 0.86) {
  // createImageBitmap respekterar EXIF-rotationen i moderna webbläsare.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await loadViaImg(file);
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Kunde inte läsa bilden.");
  return blob;
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Okänt bildformat (prova JPEG).")); };
    img.src = url;
  });
}
