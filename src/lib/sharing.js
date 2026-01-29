export const generateShareToken = (size = 24) => {
  const buffer = new Uint8Array(size);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const buildShareUrl = (token) => `${window.location.origin}/share/${token}`;
