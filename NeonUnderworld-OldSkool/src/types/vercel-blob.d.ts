declare module '@vercel/blob' {
  export interface PutBlobResult {
    url: string;
    pathname: string;
  }

  export function put(
    pathname: string,
    body: Buffer | ArrayBuffer | Blob | string,
    options?: {
      access?: 'public';
      contentType?: string;
      addRandomSuffix?: boolean;
    },
  ): Promise<PutBlobResult>;
}
