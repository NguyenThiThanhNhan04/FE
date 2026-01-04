import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import websocketService from '../services/websocketService';
import { addRoom, addJoinedRoom, setRoomCreateSuccess, setRoomCreateError } from '../redux/slices/chatSlice';

const useRooms = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        const handleRoomCreation = (data) => {
            if (data?.status === 'error') {
                const err = data?.mes || data?.message || data?.data?.mes || 'Tạo phòng thất bại';
                dispatch(setRoomCreateError(err));
                return;
            }
            if (data?.status !== 'error') {

                const maybe = data?.data ?? data;
                const roomName = maybe?.name || maybe;
                // Nếu roomName là object (do server shape unexpected), try to extract string
                const finalName = typeof roomName === 'string' ? roomName : (roomName?.name || roomName?.toString?.() || undefined);
                if (finalName) {
                    dispatch(addRoom({ name: finalName }));
                    // Thông báo thành công cho UI
                    dispatch(setRoomCreateSuccess(`Tạo phòng "${finalName}" thành công`));
                    // Tự động join vào phòng vừa tạo
                    websocketService.send('JOIN_ROOM', { name: finalName });
                }
            }
        };

        websocketService.on('CREATE_ROOM', handleRoomCreation);

        websocketService.on('JOIN_ROOM', (data) => {
            const name = data?.data?.name || data?.room;
            if (name) {
                dispatch(addJoinedRoom(name));
            }
        });

        return () => {
            websocketService.off('CREATE_ROOM', handleRoomCreation);
        };
    }, [dispatch]);
};

export default useRooms;