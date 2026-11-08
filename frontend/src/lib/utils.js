import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...a) => twMerge(clsx(a));
export const money = (n = 0) => '₹' + Number(n).toLocaleString('en-IN');
export const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const dateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const STATUSES = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Ready to Dispatch', 'Shipped', 'Delivered'];
export const NEXT = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Processing', 'Cancelled'], Processing: ['Packed', 'Cancelled'], Packed: ['Ready to Dispatch', 'Cancelled'], 'Ready to Dispatch': ['Shipped', 'Cancelled'], Shipped: ['Delivered', 'Returned'], Delivered: ['Returned'], Cancelled: ['Refund Pending'], Returned: ['Refund Pending'], 'Refund Pending': ['Refunded'], Refunded: [] };
export const STAFF_OK = ['Confirmed', 'Processing', 'Packed', 'Ready to Dispatch', 'Shipped', 'Delivered'];
