'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'

type WSMessage = {
  event: string
  data?: any
}

type WSContextValue = {
  connected: boolean
  subscribe: (battleId: string, handler: (msg: WSMessage) => void) => () => void
}

const WSContext = createContext<WSContextValue>({
  connected: false,
  subscribe: () => () => {},
})

export function useWS() {
  return useContext(WSContext)
}

export function WSProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Map<string, Set<(msg: WSMessage) => void>>>(new Map())
  const currentBattleRef = useRef<string | null>(null)

  const subscribe = useCallback((battleId: string, handler: (msg: WSMessage) => void) => {
    // If switching battles, reconnect
    if (currentBattleRef.current !== battleId) {
      if (wsRef.current) {
        wsRef.current.close()
      }

      currentBattleRef.current = battleId
      const ws = new WebSocket(`${WS_URL}/v1/ws/observe?battle_id=${battleId}`)

      ws.onopen = () => setConnected(true)
      ws.onclose = () => setConnected(false)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as WSMessage
          const handlers = handlersRef.current.get(battleId)
          if (handlers) {
            for (const h of handlers) h(msg)
          }
        } catch {
          // ignore malformed messages
        }
      }

      wsRef.current = ws
    }

    if (!handlersRef.current.has(battleId)) {
      handlersRef.current.set(battleId, new Set())
    }
    handlersRef.current.get(battleId)!.add(handler)

    return () => {
      handlersRef.current.get(battleId)?.delete(handler)
    }
  }, [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return (
    <WSContext.Provider value={{ connected, subscribe }}>
      {children}
    </WSContext.Provider>
  )
}
