import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

interface TransactionCreatedEvent {
  id: string;
  loja_id?: string;
  estado: string;
  created_at: string;
}

interface RoomAcknowledgement {
  room?: string;
  reason?: string;
}

/**
 * Liga um ecrã à sala Socket.IO autorizada pelo servidor.
 * O JWT é usado apenas no handshake autenticado.
 */
export function useTransactionRealtime(
  onTransactionCreated: (event?: TransactionCreatedEvent) => void,
  room: string | null
): void {
  const callbackRef = useRef(onTransactionCreated);

  useEffect(() => {
    callbackRef.current = onTransactionCreated;
  }, [onTransactionCreated]);

  useEffect(() => {
    const token = sessionStorage.getItem('diamante_jwt_token');
    if (!token || !room) {
      console.warn('[Diamante Realtime] Ligação não iniciada: sessão ou sala indisponível.');
      return;
    }

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    // Recuperar dados quando o browser regressa ao primeiro plano
    // ou quando a conectividade de rede é restabelecida.
    const syncOnResume = () => {
      if (document.visibilityState === 'visible') {
        void callbackRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncOnResume();
      }
    };

    window.addEventListener('online', syncOnResume);
    window.addEventListener('pageshow', syncOnResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    socket.on('connect', () => {
      console.info('[Diamante Realtime] Ligação estabelecida; a solicitar sala autorizada.');
      socket.emit('join_room', room);
    });

    socket.on('room_joined', (ack: RoomAcknowledgement) => {
      if (ack?.room === room) {
        console.info('[Diamante Realtime] Entrada na sala confirmada.');
        // Sincronização imediata após ligação inicial ou reconexão.
        void callbackRef.current();
      }
    });

    socket.on('room_denied', (ack: RoomAcknowledgement) => {
      console.error('[Diamante Realtime] Entrada na sala recusada:', ack?.reason || 'Sem motivo indicado.');
    });

    socket.on('transaction:created', (event: TransactionCreatedEvent) => {
      if (!event || typeof event.id !== 'string' || !event.id) return;
      console.info('[Diamante Realtime] Nova transação recebida.');
      callbackRef.current(event);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Diamante Realtime] Ligação terminada:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Diamante Realtime] Falha de ligação:', error.message);
    });

    return () => {
      window.removeEventListener('online', syncOnResume);
      window.removeEventListener('pageshow', syncOnResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [room]);
}
