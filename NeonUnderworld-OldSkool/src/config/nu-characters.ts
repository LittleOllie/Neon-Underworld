/**
 * Neon Underworld master character assets — public/images/nu/characters/
 *
 * Replace operator.png to update the character everywhere it is composited.
 * Not connected to player PFP / identity — atmospheric world character only.
 */

export const NU_CHARACTERS_DIR = '/images/nu/characters';

export const NU_OPERATOR_FILE = 'operator.png';
export const NU_OPERATOR_REVISION = 1;

export function nuOperatorSrc(): string {
  return `${NU_CHARACTERS_DIR}/${NU_OPERATOR_FILE}`;
}

export function nuOperatorUrl(): string {
  return `${nuOperatorSrc()}?v=${NU_OPERATOR_REVISION}`;
}
