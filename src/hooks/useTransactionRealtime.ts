import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

interface TransactionCreatedEvent {
  id: string;
  loja_id?: string;
  estado: string;
  created_at: string;
}

/**
 * Liga um ecrã à sala Socket.IO autorizada pelo servidor.
 * O JWT é usado apenas no handshake autenticado.
 */
export function useTransactionRealtime(
  onTransactionCreated: (event: TransactionCreatedEvent) => void,
  room: string | null
): void {
  const callbackRef = useRef(onTransactionCreated);

  useEffect(() => {
    callbackRef.current = onTransactionCreated;
  }, [onTransactionCreated]);

  useEffect(() => {
    const token = sessionStorage.getItem('diamante_jwt_token');
    if (!token || !room) return;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      socket.emit('join_room', room);
    });

    socket.on('transaction:created', (event: TransactionCreatedEvent) => {
      if (!event || typeof event.id !== 'string' || !event.id) return;
      callbackRef.current(event);
    });

    socket.on('connect_error', () => {
      console.warn('[Diamante Realtime] Ligação em tempo real indisponível.');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [room]);
}
