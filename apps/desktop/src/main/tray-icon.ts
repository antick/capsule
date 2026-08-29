import { type NativeImage, nativeImage } from "electron";
import { resourceFile } from "./paths.ts";

export function trayTemplateImage(): NativeImage {
  const image = nativeImage.createEmpty();
  image.addRepresentation({
    width: 16,
    height: 16,
    scaleFactor: 1,
    buffer: nativeImage
      .createFromPath(resourceFile("trayTemplate.png"))
      .toPNG(),
  });
  image.addRepresentation({
    width: 32,
    height: 32,
    scaleFactor: 2,
    buffer: nativeImage
      .createFromPath(resourceFile("trayTemplate@2x.png"))
      .toPNG(),
  });
  image.setTemplateImage(true);
  return image;
}
