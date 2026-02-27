import { nanoid } from 'nanoid'

export function genAgentId(): string {
  return `agt_${nanoid(8)}`
}

export function genApiKey(): string {
  return `ak_${nanoid(32)}`
}

export function genRoomId(): string {
  return `rm_${nanoid(8)}`
}

export function genBattleId(): string {
  return `bt_${nanoid(8)}`
}

export function genParticipantId(): string {
  return `bp_${nanoid(12)}`
}
