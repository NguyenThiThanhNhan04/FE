import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import websocketService from '../services/websocketService';
import { 
  setConversations, 
  setRooms, 
  setMessages,
  addConversation 
} from '../redux/slices/chatSlice';
import { parseConversationsFromResponse } from '../utils/chatUtils';

const useConversations = (isAuthenticated, currentUser) => {
  const dispatch = useDispatch();

  const searchTerm = useSelector(state => state.chat.searchTerm);


    useEffect(() => {
        if (isAuthenticated && currentUser) {
            try {
                const userName = currentUser.name || currentUser.user || currentUser.email;
                console.log('Đã xác thực, đang lấy dữ liệu cho:', userName);


                websocketService.send('GET_PEOPLE_CHAT_MES', {
                    name: userName,
                    page: 1,
                });


                setTimeout(() => {
                    websocketService.send('GET_USER_LIST', {});
                }, 500);

            } catch (err) {
                console.warn('Lỗi khi gửi request:', err);
            }
        }
    }, [isAuthenticated, currentUser]);


  useEffect(() => {

    const handlePeopleChatMes = (data) => {
      if (data.data && Array.isArray(data.data)) {
        if (data.data.length === 0) {
          const q = (searchTerm && searchTerm.trim()) || null;
          if (q) {
            console.log('Danh sách rỗng, đang kiểm tra user tồn tại:', q);
            websocketService.send('CHECK_USER_EXIST', { user: q });
          } else {
            console.log('Danh sách rỗng, fallback sang GET_USER_LIST');
            websocketService.send('GET_USER_LIST', {});
          }
          return;
        }

        const first = data.data[0];
        const looksLikeMessage = typeof first === 'object' && ('mes' in first || 'from' in first || 'time' in first);

        if (looksLikeMessage) {
          dispatch(setMessages(data.data));
          return;
        }

        const { people, rooms } = parseConversationsFromResponse(data.data);
        dispatch(setConversations(people));
        dispatch(setRooms(rooms));
      }
    };

      const handleUserList = (data) => {
          try {
              if (data.data && Array.isArray(data.data)) {
                  const allUsers = data.data.map(u => u.name || u.user || u);

                  dispatch(setConversations(allUsers));


              }
          } catch (e) {
              console.warn('Lỗi xử lý GET_USER_LIST', e);
          }
      };
    const handleCheckUser = (res) => {
      try {
        const status = res?.status || res?.data?.status;
        const exists = status === 'success' || res?.data?.exists === true;
        
        if (exists && res?.data?.user) {
          const uname = res.data.user;
          dispatch(addConversation(uname));
        }
      } catch (e) {
        console.warn('Lỗi xử lý CHECK_USER', e);
      }
    };

    websocketService.on('GET_PEOPLE_CHAT_MES', handlePeopleChatMes);
    websocketService.on('GET_USER_LIST', handleUserList);
    websocketService.on('CHECK_USER', handleCheckUser);

    return () => {
      websocketService.off('GET_PEOPLE_CHAT_MES', handlePeopleChatMes);
      websocketService.off('GET_USER_LIST', handleUserList);
      websocketService.off('CHECK_USER', handleCheckUser);
    };
  }, [dispatch, searchTerm]);
};

export default useConversations;