import React from 'react';
import TabSection from './TabSection';
import ConversationsList from './ConversationsList';
import RoomsList from './RoomsList';
import CreateRoomForm from './CreateRoomForm';
import SearchBox from './SearchBox';
// .
function ChatSidebar({
  tab,
  onTabChange,
  conversations,
  selectedUser,
  onSelectUser,
  rooms,
  selectedRoom,
  onSelectRoom,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  newRoomName,
  onNewRoomNameChange,
  onCreateRoom,
  roomCreateError,
  roomCreateSuccess,
  onClearRoomMessages,
}) {
  return (
    <div className="chat-sidebar">
      <TabSection
        tab={tab}
        onTabChange={onTabChange}
      />

      {tab === 'messages' && (
        <>
          <SearchBox
            placeholder="Search people..."
            value={searchTerm}
            onChange={onSearchTermChange}
            onSubmit={onSearchSubmit}
          />
          <ConversationsList
            conversations={conversations}
            selectedUser={selectedUser}
            onSelectUser={onSelectUser}
          />
        </>
      )}

      {tab === 'rooms' && (
        <>
          <SearchBox
            placeholder="Search rooms..."
            value={searchTerm}
            onChange={onSearchTermChange}
            onSubmit={onSearchSubmit}
          />
          <CreateRoomForm
            newRoomName={newRoomName}
            onNewRoomNameChange={onNewRoomNameChange}
            onCreateRoom={onCreateRoom}
            roomCreateError={roomCreateError}
            roomCreateSuccess={roomCreateSuccess}
            onClearMessages={onClearRoomMessages}
          />
          <RoomsList
            rooms={rooms}
            selectedRoom={selectedRoom}
            onSelectRoom={onSelectRoom}
          />
        </>
      )}
    </div>
  );
}

export default ChatSidebar;
