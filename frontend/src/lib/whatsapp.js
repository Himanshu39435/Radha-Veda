// wa.me link builder. `number` is digits with country code (the admin panel normalises it on save).
export const waLink = (number, text) => `https://wa.me/${String(number).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
