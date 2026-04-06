import Swal from 'sweetalert2';

const basePopupClass = {
  popup: 'rounded-2xl',
  title: 'text-slate-800',
  confirmButton: 'rounded-xl px-4 py-2',
  cancelButton: 'rounded-xl px-4 py-2',
};

export const notifySuccess = (message, title = 'Thành công') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: String(message || ''),
    timer: 2000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
    customClass: basePopupClass,
  });
};

export const notifyError = (message, title = 'Có lỗi xảy ra') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: String(message || ''),
    confirmButtonText: 'Đã hiểu',
    customClass: basePopupClass,
  });
};

export const notifyInfo = (message, title = 'Thông báo') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: String(message || ''),
    confirmButtonText: 'Đóng',
    customClass: basePopupClass,
  });
};

export const confirmDialog = async ({
  title = 'Xác nhận thao tác',
  text = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  icon = 'question',
} = {}) => {
  const result = await Swal.fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
    customClass: basePopupClass,
  });

  return Boolean(result.isConfirmed);
};

export const setupGlobalNotifications = () => {
  if (typeof window === 'undefined') return;

  const nativeAlert = window.alert.bind(window);

  window.alert = (message) => {
    const text = String(message || '');
    const lowered = text.toLowerCase();

    if (lowered.includes('không thể') || lowered.includes('lỗi') || lowered.includes('error')) {
      void notifyError(text);
      return;
    }

    if (lowered.includes('thành công') || lowered.includes('đã')) {
      void notifySuccess(text, 'Thông báo');
      return;
    }

    void notifyInfo(text);
  };

  window.__nativeAlert = nativeAlert;
};
