// Pagina /chat: chat soberano del OS (experiencia diaria tipo Telegram).
// Ver os-chat-telegram-soberano en el brain. El Cockpit (/hermes) queda como
// vista power user; esta es la conversacion diaria con Hermes.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSChat from '../os/components/OSChat.tsx';

export const Route = createFileRoute('/chat')({
  head: () => ({ meta: [{ title: tituloOs('Chat') }] }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <OSLayout title="Chat">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Agente"
          title="Chat"
          subtitle="Habla con Hermes. Cada hilo queda guardado en tu OS; la respuesta llega aunque tardes en volver."
        />
        <OSChat />
      </div>
    </OSLayout>
  );
}
