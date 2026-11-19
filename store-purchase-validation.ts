import { Buffer } from 'node:buffer';

export type DeclarationMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

const MAX_DECLARATION_BYTES = 6 * 1024 * 1024;
const ALLOWED_DECLARATION_TYPES: readonly DeclarationMimeType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Decode and validate a declaration upload using both its declared MIME type
 * and its file signature. Returns null for malformed or oversized input.
 */
export function decodeDeclarationFile(encoded: unknown, mimeType: unknown): Buffer | null {
  if (
    typeof encoded !== 'string' ||
    typeof mimeType !== 'string' ||
    !ALLOWED_DECLARATION_TYPES.includes(mimeType as DeclarationMimeType) ||
    !encoded ||
    encoded.length > 8_400_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
    encoded.length % 4 === 1
  ) {
    return null;
  }

  const fileBuffer = Buffer.from(encoded, 'base64');
  if (
    !fileBuffer.length ||
    fileBuffer.length > MAX_DECLARATION_BYTES ||
    fileBuffer.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')
  ) {
    return null;
  }

  const signatureValid = mimeType === 'application/pdf'
    ? fileBuffer.subarray(0, 5).toString('ascii') === '%PDF-'
    : mimeType === 'image/jpeg'
      ? fileBuffer.length >= 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff
      : mimeType === 'image/png'
        ? fileBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : fileBuffer.length >= 12 && fileBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
          fileBuffer.subarray(8, 12).toString('ascii') === 'WEBP';

  return signatureValid ? fileBuffer : null;
}

export interface PurchaseApprovalState {
  primeira_aprovacao_por?: string | null;
  valor_final: number | string;
}

/**
 * A recorded first signature makes the second signature mandatory permanently,
 * even if the configured threshold is later disabled or raised.
 */
export function requiresSecondPurchaseApproval(
  transaction: PurchaseApprovalState,
  dualApprovalEnabled: boolean,
  threshold: number,
): boolean {
  if (Boolean(transaction.primeira_aprovacao_por)) return true;
  return dualApprovalEnabled && Number.isFinite(threshold) && threshold > 0 &&
    Number(transaction.valor_final) >= threshold;
}
