import { App as AntdApp } from 'antd';
import { useEffect } from 'react';

import { setFeedbackApi } from './feedback';

export function FeedbackBridge() {
  const { message, modal } = AntdApp.useApp();

  useEffect(() => {
    setFeedbackApi({ message, modal });
    return () => setFeedbackApi(null);
  }, [message, modal]);

  return null;
}
