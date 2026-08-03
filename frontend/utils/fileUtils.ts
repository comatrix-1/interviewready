import { MAX_FILE_SIZE } from "../config/constants";

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });

export const isInterviewCompleteResponse = (text: string): boolean =>
  text.toLowerCase().includes("interview complete");
