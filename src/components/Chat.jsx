import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import websocketService from '../services/websocketService';
import './Chat.css';

function Chat() {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Tab state
    const [tab, setTab] = useState('messages');
    const [conversations, setConversations] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    // removed unused room-creation states (server doesn't support creating rooms)
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    /* eslint-disable-next-line no-unused-vars */
    const [joinedRooms, setJoinedRooms] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [newRoomName, setNewRoomName] = useState('');
    const [roomCreateError, setRoomCreateError] = useState('');
    const [roomCreateSuccess, setRoomCreateSuccess] = useState('');
        const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    //xu ly realtime cho sendChat o nguoi dung va room
    const selectedUserRef = useRef(null);
    const selectedRoomRef = useRef(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const setupWebSocket = async () => {
            try {
                await websocketService.connect();
                setIsConnected(true);

                // Khi nhận login thành công, yêu cầu danh sách people/rooms
                const onAuthSuccess = (data) => {
                    console.log('Login/RE_LOGIN response:', data);

                    // 1. Định nghĩa thế nào là "Đã đăng nhập từ trước" (Server báo lỗi nhưng thực ra là OK)
                    const isAlreadyLoggedIn = data.status === 'error' && data.mes === 'You are already logged in';

                    // 2. Định nghĩa thành công thông thường
                    const isSuccess = data.status === 'success' || data.status === 'ok';

                    // 3. Logic mới: Chấp nhận cả Success, RE_LOGIN, và Already Logged In
                    if (data && (isSuccess || data.event === 'RE_LOGIN' || isAlreadyLoggedIn)) {
                        setIsAuthenticated(true);

                        if (isAlreadyLoggedIn) {
                            console.log('ℹ️ Server báo user đã login, bỏ qua lỗi và tiếp tục tải dữ liệu.');
                        }

                        try {
                            websocketService.send('GET_USER_LIST', {
                                name: currentUser.name || currentUser.user || currentUser.email,
                                page: 1
                            });
                        } catch (err) {
                            console.warn('Không thể gửi GET_USER_LIST:', err);
                        }
                    } else {
                        // Chỉ rơi vào đây nếu lỗi thật sự (sai pass, v.v...)
                        console.warn('Auth response indicates failure:', data);
                    }
                };

                const onAuthError = (data) => {
                    console.log('Auth error response:', data);
                    // if (data && data.status === 'error') {
                    //     console.warn('Auth failed:', data.mes);
                    //     if (data.event === 'RE_LOGIN') {
                    //         console.log('RE_LOGIN code expired or invalid, removing from localStorage');
                    //         const updatedUser = { ...currentUser, reLoginCode: null };
                    //         localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                    //     }
                    // }
                    if (data && data.mes === 'User not Login') {
                        console.log('🔄 Socket vừa kết nối lại, đang tự động đăng nhập...');
                        if (currentUser && currentUser.password) {
                            websocketService.send('LOGIN', {
                                user: currentUser.name || currentUser.user || currentUser.email,
                                pass: currentUser.password
                            });
                        }
                        return;
                    }
                };

                websocketService.on('RE_LOGIN', onAuthSuccess);
                websocketService.on('LOGIN', onAuthSuccess);
                websocketService.on('AUTH', onAuthError);

                // Always use LOGIN (not RE_LOGIN since code can expire); save code if server provides it
                if (currentUser && currentUser.password) {
                    websocketService.send('LOGIN', { user: currentUser.name || currentUser.user || currentUser.email, pass: currentUser.password });
                } else {
                    console.warn('No password found in currentUser; please login to server to fetch people/rooms');
                }

                websocketService.on('GET_PEOPLE_CHAT_MES', (data) => {
                    if (data.data && Array.isArray(data.data)) {
                        // Empty -> fallback to full user list
                        if (data.data.length === 0) {
                            console.log('GET_PEOPLE_CHAT_MES returned empty — requesting GET_USER_LIST fallback');
                            try { websocketService.send('GET_USER_LIST', {}); } catch (e) { console.warn(e); }
                            return;
                        }

                        // Detect if payload is chat history (messages) or list of people
                        const first = data.data[0];
                        const looksLikeMessage = typeof first === 'object' && (('mes' in first) || ('from' in first) || ('time' in first));

                        if (looksLikeMessage) {
                            // Treat as messages history for people chat
                            setMessages(data.data);
                            return;
                        }

                        // Treat as list of people (and possible rooms)
                        const people = [];
                        const roomsList = [];

                        data.data.forEach(item => {
                            if (typeof item === 'string') {
                                people.push(item);
                            } else if (typeof item === 'object') {
                                const nm = item.name || item.user || item.to || item.value || '';
                                if (item.type === 1 || item.type === '1') {
                                    roomsList.push({ name: nm });
                                } else {
                                    people.push(nm || item);
                                }
                            }
                        });

                        console.log('Parsed people:', people, 'Parsed rooms:', roomsList);
                        setConversations(people);
                        setRooms(roomsList);
                    }
                });

                // Fallback listener: GET_USER_LIST returns all users; populate conversations
                websocketService.on('GET_USER_LIST', (data) => {
                    try {
                        if (data.data && Array.isArray(data.data)) {
                            const people = data.data.map(u => (u.name || u.user || u));
                            console.log('GET_USER_LIST returned users:', people);
                            setConversations(people);
                        }
                    } catch (e) { console.warn('GET_USER_LIST handler error', e); }
                });

                // Listen CHECK_USER result and log/handle existence status
                websocketService.on('CHECK_USER', (res) => {
                    try {
                        const status = res?.status || res?.data?.status;
                        const exists = status === 'success' || res?.data?.exists === true;
                        console.log('CHECK_USER result:', res);
                        // If exists, optionally prioritize showing that user on top
                        if (exists && res?.data?.user) {
                            const uname = res.data.user;
                            setConversations(prev => [uname, ...prev.filter(x => (typeof x === 'string' ? x : (x.name||x.user||x)) !== uname)]);
                        }
                    } catch(e) { /* ignore */ }
                });

                // Server uses GET_ROOM_CHAT_MES for returning room/person chat history
                websocketService.on('GET_ROOM_CHAT_MES', (data) => {
                    if (data.data && Array.isArray(data.data)) {
                        setMessages(data.data);
                    }
                });

                websocketService.on('SEND_CHAT', (data) => {
                    // if (data.data) {
                    //     setMessages(prev => [...prev, data.data]);
                    // }
                    const msg = data.data;
                    if (!msg) return;

                    // Lấy user/room đang mở từ Ref
                    const activeUser = selectedUserRef.current;
                    const activeRoom = selectedRoomRef.current;

                    // Lấy tên mình
                    const myName = currentUser.name || currentUser.user || currentUser.email;

                    // --- CHUẨN HÓA DỮ LIỆU ---
                    // Server của bạn dùng 'name' để chỉ người gửi, nhưng code cũ dùng 'from'.
                    // Ta tạo biến sender để thống nhất.
                    const sender = msg.from || msg.name; // <--- SỬA QUAN TRỌNG TẠI ĐÂY
                    const receiver = msg.to;

                    console.log('📨 Nhận tin:', msg);
                    console.log(`🔍 So sánh: Sender[${sender}] vs Active[${activeUser}]`);

                    // Hàm làm sạch chuỗi để so sánh chính xác (bỏ khoảng trắng, chữ hoa thường)
                    const clean = (str) => String(str || '').trim().toLowerCase();

                    let shouldShow = false;

                    if (activeUser) {
                        // --- TRƯỜNG HỢP CHAT 1-1 ---

                        // 1. Tin nhắn từ người mình đang chat gửi tới mình
                        // (Ví dụ: Đang chat với Thungan, nhận tin từ name='thungan')
                        const isFromThem = clean(sender) === clean(activeUser);

                        // 2. Tin nhắn do chính mình gửi cho họ (Server Echo về)
                        // (Ví dụ: Mình là 22130180, gửi cho to='thungan')
                        const isFromMe = clean(sender) === clean(myName) && clean(receiver) === clean(activeUser);

                        if (isFromThem || isFromMe) {
                            shouldShow = true;
                        }
                    }
                    else if (activeRoom) {
                        // --- TRƯỜNG HỢP CHAT ROOM ---
                        const roomName = activeRoom.name || activeRoom;
                        // Kiểm tra tin nhắn có gửi vào đúng phòng này không
                        if (clean(receiver) === clean(roomName)) {
                            shouldShow = true;
                        }
                    }

                    if (shouldShow) {
                        console.log('✅ Khớp! Cập nhật UI.');
                        setMessages(prev => {
                            // Chống trùng lặp đơn giản (nếu msg có id)
                            if (msg.id && prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                        scrollToBottom();
                    } else {
                        console.log('❌ Không khớp cửa sổ chat.');
                    }
                });

                websocketService.on('CREATE_ROOM', (data) => {
                    console.log('✓ Room creation response:', data);
                    try {
                        if (data?.status === 'error') {
                            setRoomCreateError(data.mes || 'Create room failed');
                            return;
                        }
                        let roomName = null;
                        if (data?.data) {
                            roomName = typeof data.data === 'string' ? data.data : data.data.name || null;
                        } else if (typeof data === 'string') {
                            roomName = data;
                        }
                        if (roomName) {
                            // avoid duplicate
                            setRooms(prev => {
                                const exists = prev.some(r => (r.name || r) === roomName);
                                return exists ? prev : [...prev, { name: roomName }];
                            });
                            setRoomCreateSuccess('Room created');
                            setRoomCreateError('');
                            setNewRoomName('');
                            // Auto join and open the new room
                            websocketService.send('JOIN_ROOM', { name: roomName });
                            setSelectedRoom({ name: roomName });
                            setSelectedUser(null);
                            setMessages([]);
                            websocketService.send('GET_ROOM_CHAT_MES', { name: roomName, page: 1 });
                            console.log('✓ Room added and opened:', roomName);
                        } else {
                            console.log('CREATE_ROOM returned no room name');
                        }
                    } catch (e) { console.warn('CREATE_ROOM handler error', e); }
                });

                // Update joinedRooms when server confirms JOIN_ROOM
                websocketService.on('JOIN_ROOM', (d) => {
                    try {
                        const name = d?.data?.name || d?.data || d?.room || null;
                        if (name) {
                            setJoinedRooms(prev => (prev.includes(name) ? prev : [...prev, name]));
                        }
                    } catch (e) { /* ignore */ }
                });

            } catch (error) {
                console.error('WebSocket error:', error);
            }
        };

        setupWebSocket();

        return () => {
            // websocketService.disconnect();
        };
    }, []);

    const handleSelectUser = (person) => {
        const personName = typeof person === 'string' ? person : person.name || person.to || person;
        setSelectedUser(personName);
        selectedUserRef.current = personName; //cap nhat ref cho nguoi dung
        setSelectedRoom(null);
        selectedRoomRef.current = null;
        setMessages([]);
        
        // For direct messages, request people chat history
        websocketService.send('GET_PEOPLE_CHAT_MES', {
            name: personName,
            page: 1
        });
    };

    const handleSelectRoom = (room) => {
        setSelectedRoom(room);
        setSelectedUser(null);
        setMessages([]);

        const roomName = room.name || room;
        // Ensure joined before loading history (some servers require joining first)
        if (!joinedRooms.includes(roomName)) {
            websocketService.send('JOIN_ROOM', { name: roomName });
            setJoinedRooms(prev => (prev.includes(roomName) ? prev : [...prev, roomName]));
        }
        
        websocketService.send('GET_ROOM_CHAT_MES', {
            name: roomName,
            page: 1
        });
    };

    // Create room handler
    const handleCreateRoom = (e) => {
        e?.preventDefault?.();
        const name = (newRoomName || '').trim();
        setRoomCreateError('');
        setRoomCreateSuccess('');
        if (!name) {
            setRoomCreateError('Room name is required');
            return;
        }
        const exists = rooms.some(r => (typeof r === 'string' ? r : (r.name || r)) === name);
        if (exists) {
            setRoomCreateError('Room already exists');
            return;
        }
        websocketService.send('CREATE_ROOM', { name });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (newMessage.trim()) {
            // Lấy tên người gửi
            const senderName = currentUser.name || currentUser.user || currentUser.email;
            if (selectedUser) {
                websocketService.send('SEND_CHAT', {
                    type: 'people',
                    to: selectedUser,
                    mes: newMessage,
                    name: senderName
                });
            } else if (selectedRoom) {
                const roomName = selectedRoom.name || selectedRoom;
                // Ensure joined to room before sending (server may require join)
                if (!joinedRooms.includes(roomName)) {
                    websocketService.send('JOIN_ROOM', { name: roomName });
                    // optimistically mark joined; server will confirm via JOIN_ROOM response
                    setJoinedRooms(prev => (prev.includes(roomName) ? prev : [...prev, roomName]));
                }
                websocketService.send('SEND_CHAT', {
                    type: 'room',
                    to: roomName,
                    mes: newMessage,
                    name: senderName
                });
            }
            setNewMessage('');
        }
    };

    const handleLogout = () => {
        websocketService.send('LOGOUT');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('currentUser');
        navigate('/login');
    };

    const handleSearchSubmit = () => {
        const name = searchTerm && searchTerm.trim();
        if (!name) return;
        if (tab === 'messages') {
            // Call CHECK_USER to verify exact existence
            websocketService.send('CHECK_USER', { user: name });
            // Optional: still request list/messages by keyword for suggestions/history
            websocketService.send('GET_PEOPLE_CHAT_MES', { name, page: 1 });
        }
    };

    const filteredConversations = conversations.filter(conv => {
        const convName = typeof conv === 'string' ? conv : (conv.name || conv.to || '');
        const normalize = (s = '') => s.toString().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
        return normalize(convName).includes(normalize(searchTerm));
    });

    const filteredRooms = rooms.filter(room => {
        const roomName = typeof room === 'string' ? room : room.name || '';
        const normalize = (s = '') => s.toString().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
        return normalize(roomName).includes(normalize(searchTerm));
    });

    const currentChat = selectedUser || (selectedRoom?.name || selectedRoom);
    const isDirectMessage = selectedUser !== null;

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="header-content">
                    <h1>💬 Messaging</h1>
                    <div className="user-info">
                        <span className="user-name">{currentUser.name}</span>
                        <span className={`status ${isConnected ? 'online' : 'offline'}`}>
                            {isConnected ? '🟢 Online' : '🔴 Offline'}
                        </span>
                    </div>
                </div>
                <button onClick={handleLogout} className="btn-logout">Logout</button>
            </div>

            <div className="chat-main">
                <div className="chat-sidebar">
                    <div className="tabs">
                        <button
                            className={`tab ${tab === 'messages' ? 'active' : ''}`}
                            onClick={() => {
                                setTab('messages');
                                setSelectedRoom(null);
                                setSearchTerm('');
                            }}
                        >
                            💬 Messages
                        </button>
                        <button
                            className={`tab ${tab === 'rooms' ? 'active' : ''}`}
                            onClick={() => {
                                setTab('rooms');
                                setSelectedUser(null);
                                setSearchTerm('');

                                // If not authenticated, try LOGIN (not RE_LOGIN since code may be expired)
                                if (!isAuthenticated) {
                                    console.warn('Not authenticated yet — attempting LOGIN');
                                    if (currentUser && currentUser.password) {
                                        websocketService.send('LOGIN', { user: currentUser.name || currentUser.user || currentUser.email, pass: currentUser.password });
                                    } else {
                                        navigate('/login');
                                    }
                                } else {
                                    // already authenticated — refresh people/rooms if empty
                                    if (!conversations || conversations.length === 0) {
                                        websocketService.send('GET_PEOPLE_CHAT_MES', { name: currentUser.name || currentUser.user || currentUser.email, page: 1 });
                                    }
                                }
                            }}
                        >
                            🏠 Rooms
                        </button>
                    </div>

                    {tab === 'messages' && (
                        <>
                            <div className="search-box">
                                                        <input
                                                            type="text"
                                                            placeholder="Search people..."
                                                            value={searchTerm}
                                                            onChange={(e) => { setSearchTerm(e.target.value); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); } }}
                                                            className="search-input"
                                                        />
                            </div>

                            <div className="conversations-list">
                                {filteredConversations.length === 0 ? (
                                    <p className="no-conversations">No conversations</p>
                                ) : (
                                    filteredConversations.map((person, index) => {
                                        const personName = typeof person === 'string' ? person : (person.name || person.to || person);
                                        const isActive = selectedUser === personName;
                                        return (
                                            <div
                                                key={index}
                                                className={`conversation-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleSelectUser(person)}
                                            >
                                                <span className="user-avatar">👤</span>
                                                <p className="person-name">{personName}</p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {tab === 'rooms' && (
                        <>
                            <div className="search-box">
                                <input
                                    type="text"
                                    placeholder="Search rooms..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); } }}
                                    className="search-input"
                                />
                            </div>

                            <div className="create-room-box">
                                <form onSubmit={handleCreateRoom} className="create-room-form">
                                    <input
                                        type="text"
                                        placeholder="New room name..."
                                        value={newRoomName}
                                        onChange={(e) => setNewRoomName(e.target.value)}
                                        className="search-input"
                                    />
                                    <button type="submit" className="btn-send">Create</button>
                                </form>
                                {roomCreateError && <p className="error-message">{roomCreateError}</p>}
                                {roomCreateSuccess && <p className="success-message">{roomCreateSuccess}</p>}
                            </div>

                            <div className="rooms-list">
                                {filteredRooms.length === 0 ? (
                                    <p className="no-rooms">No rooms available</p>
                                ) : (
                                    filteredRooms.map((room, index) => (
                                        <div
                                            key={index}
                                            className={`room-item ${selectedRoom?.name === room.name ? 'active' : ''}`}
                                            onClick={() => handleSelectRoom(room)}
                                        >
                                            <span className="room-icon">🏠</span>
                                            <div className="room-info">
                                                <p className="room-name">{room.name || room}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="chat-content">
                    {currentChat ? (
                        <>
                            <div className="content-header">
                                <h2>{isDirectMessage ? `👤 ${currentChat}` : `🏠 ${currentChat}`}</h2>
                            </div>

                            <div className="messages-container">
                                {messages.length === 0 ? (
                                    <div className="no-messages">
                                        <p>Start conversation with {currentChat}</p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`message ${msg.from === currentUser.name ? 'own' : 'other'}`}
                                        >
                                            <div className="message-bubble">
                                                <p className="message-from">{msg.from}</p>
                                                <p className="message-text">{msg.mes || msg}</p>
                                                <p className="message-time">
                                                    {msg.time || new Date().toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="message-input-form" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    placeholder="Type message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="message-input"
                                />
                                <button type="submit" className="btn-send">
                                    📤 Send
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="no-room-selected">
                            <p>
                                {tab === 'messages'
                                    ? '👈 Select a person to start chat'
                                    : '👈 Select or create a room to start chat'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Chat;
