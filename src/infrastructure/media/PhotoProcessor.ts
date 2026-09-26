import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export type ProcessedPhoto = {
  uri: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  fileSize: number;
};

const MAX_DIMENSION = 1600;
const TARGET_COMPRESSION = 0.72;

function readImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error: unknown) => reject(error),
    );
  });
}

export async function processProfilePhoto(uri: string): Promise<ProcessedPhoto> {
  const { width, height } = await readImageSize(uri);
  const resize = width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION };

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize }],
    {
      compress: TARGET_COMPRESSION,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );

  const response = await fetch(result.uri);
  const blob = await response.blob();

  if (!blob.size || !result.width || !result.height) {
    throw new Error('Image could not be processed.');
  }

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
    fileSize: blob.size,
  };
}
