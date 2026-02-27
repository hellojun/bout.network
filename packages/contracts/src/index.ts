import { encodeAbiParameters, keccak256, toHex } from 'viem'

export { boutEscrowAbi } from './abi.js'

/**
 * Convert a battle ID string (e.g. "bt_CgxJE96x") to a bytes32 value
 * for use in the BoutEscrow contract.
 */
export function battleIdToBytes32(id: string): `0x${string}` {
  return keccak256(toHex(id))
}

/**
 * The zero address, used for draw settlements.
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
