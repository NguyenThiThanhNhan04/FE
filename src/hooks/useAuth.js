
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import websocketService from '../services/websocketService';
import { setIsAuthenticated } from '../redux/slices/chatSlice';

const useAuth = (currentUser) => {
    const dispatch = useDispatch();

    useEffect(() => {
        if (!currentUser || !currentUser.password) return;

        const handleAuthResponse = (data) => {
            const isSuccess = data.status === 'success';
            const isAlreadyLoggedIn = data.mes === 'You are already logged in';
            const isReLogin = data.event === 'RE_LOGIN';

            if (data && (isSuccess || isReLogin || isAlreadyLoggedIn)) {
                console.log("✅ Đăng nhập/Xác thực thành công!");
                dispatch(setIsAuthenticated(true));
            } else {
                console.warn('⚠️ Đăng nhập thất bại:', data);
            }
        };

        const performLogin = () => {
            if (websocketService.ws?.readyState === WebSocket.OPEN) {
                console.log("🔄 Đang gửi gói tin LOGIN (Authentication)...");
                websocketService.send('LOGIN', {
                    user: currentUser.name || currentUser.user || currentUser.email,
                    pass: currentUser.password,
                });
            } else {
                websocketService.connect();
            }
        };


        websocketService.on('LOGIN', handleAuthResponse);
        websocketService.on('RE_LOGIN', handleAuthResponse);

        websocketService.on('OPEN', performLogin);

        if (websocketService.ws?.readyState === WebSocket.OPEN) {
            performLogin();
        }

        return () => {
            websocketService.off('LOGIN', handleAuthResponse);
            websocketService.off('RE_LOGIN', handleAuthResponse);
            websocketService.off('OPEN', performLogin);
        };

    }, [currentUser?.user, currentUser?.password, dispatch]);
};

export default useAuth;