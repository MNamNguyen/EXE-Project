// Ghép class, bỏ giá trị rỗng: cx('a', cond && 'b', ['c', null]) → 'a b c'
export const cx = (...parts) => parts.flat().filter(Boolean).join(' ');
