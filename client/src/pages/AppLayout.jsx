import React, { useEffect, useState } from 'react';
import { useServerStore } from '../store/useServerStore';
import ServerList from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import DMList from '../components/DMList';
import ChatHeader from '../components/ChatHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import VoiceChannel from '../components/VoiceChannel';
import ThreadPanel from '../components/ThreadPanel';
import PinnedPanel from '../components/PinnedPanel';
import FriendsView from '../components/FriendsView';
import EventsModal from '../components/EventsModal';
import EventToastNotification from '../components/EventToastNotification';
import CreateServerModal from '../components/CreateServerModal';
import CreateChannelModal from '../components/CreateChannelModal';
import ServerSettingsModal from '../components/ServerSettingsModal';
import InviteModal from '../components/InviteModal';
import PendingInvitesBanner from '../components/PendingInvitesBanner';

export default function AppLayout() {
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const {
    fetchMyServers,
    isDMMode,
    activeDM,
    activeChannel,
    activeThreadParent,
    isPinnedPanelOpen,
    isEventsModalOpen,
    closeEventsModal,
  } = useServerStore();

  useEffect(() => {
    fetchMyServers();
  }, [fetchMyServers]);

  const isFriendsView = isDMMode && !activeDM;
  const isVoiceChannel = !isDMMode && activeChannel?.type === 'voice';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0e17] text-gray-200">
      {/* Pending Invites Top Banner */}
      <PendingInvitesBanner />

      {/* Real-Time Event Reminder / Start Alerts */}
      <EventToastNotification />

      <div className="flex flex-1 overflow-hidden">
        {/* 1. Left Rail - Servers list */}
        <ServerList onOpenCreateServer={() => setIsServerModalOpen(true)} />

        {/* 2. Second Sidebar - DM List or Channels List */}
        {isDMMode ? (
          <DMList />
        ) : (
          <ChannelList
            onOpenCreateChannel={() => setIsChannelModalOpen(true)}
            onOpenServerSettings={() => setIsServerSettingsOpen(true)}
            onOpenInvite={() => setIsInviteModalOpen(true)}
          />
        )}

        {/* 3. Main Panel - Friends View, Voice channel UI, or Chat UI */}
        <div className="flex flex-1 flex-col bg-[#101222] overflow-hidden">
          {isFriendsView ? (
            <FriendsView />
          ) : isVoiceChannel ? (
            <VoiceChannel />
          ) : (
            <>
              <ChatHeader />
              <MessageList />
              <MessageInput />
            </>
          )}
        </div>

        {/* 4. Slide-in Thread Panel (when a thread is open) */}
        {activeThreadParent && <ThreadPanel />}

        {/* 5. Slide-in Pinned Messages Panel (when opened) */}
        {isPinnedPanelOpen && <PinnedPanel />}
      </div>

      {/* Modals */}
      <CreateServerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
      <CreateChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
      />
      <ServerSettingsModal
        isOpen={isServerSettingsOpen}
        onClose={() => setIsServerSettingsOpen(false)}
      />
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      <EventsModal
        isOpen={isEventsModalOpen}
        onClose={closeEventsModal}
      />
    </div>
  );
}
