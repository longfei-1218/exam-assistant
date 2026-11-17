import type { ReactNode } from 'react';

type MessageApi = {
  info: (content: ReactNode) => unknown;
  success: (content: ReactNode) => unknown;
  error: (content: ReactNode) => unknown;
};

type ModalApi = {
  confirm: (config: {
    content: ReactNode;
    okText?: string;
    cancelText?: string;
    centered?: boolean;
    onOk?: () => Promise<void>;
  }) => unknown;
};

type FeedbackApi = {
  message: MessageApi;
  modal: ModalApi;
};

let feedbackApi: FeedbackApi | null = null;

export function setFeedbackApi(api: FeedbackApi | null) {
  feedbackApi = api;
}

type DialogConfirmOptions = {
  content: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
};

export const Dialog = {
  confirm({
    content,
    confirmText = '确定',
    cancelText = '取消',
    onConfirm,
  }: DialogConfirmOptions) {
    void feedbackApi?.modal.confirm({
      content,
      okText: confirmText,
      cancelText,
      centered: true,
      onOk: async () => {
        await onConfirm?.();
      },
    });
  },
};

type ToastOptions =
  | string
  | {
      icon?: 'success' | 'fail';
      content: ReactNode;
    };

export const Toast = {
  show(options: ToastOptions) {
    if (!feedbackApi) {
      return;
    }

    if (typeof options === 'string') {
      void feedbackApi.message.info(options);
      return;
    }

    if (options.icon === 'success') {
      void feedbackApi.message.success(options.content);
    } else if (options.icon === 'fail') {
      void feedbackApi.message.error(options.content);
    } else {
      void feedbackApi.message.info(options.content);
    }
  },
};
