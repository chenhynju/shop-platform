// helloWorldA 电商模块类型契约（前后端共享）
export interface ShopProduct {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: number; // 分
  status: string;
  stock: number; // 当前 DB 库存
}

export interface CartItem {
  sku: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CartItem[];
  promoCode?: string;
}

export interface OrderItemView {
  sku: string;
  name: string;
  price: number; // 下单时快照（分）
  quantity: number;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'FULFILLED';

export interface OrderView {
  id: number;
  orderNo: string;
  status: OrderStatus;
  total: number; // 优惠后（分）
  items: OrderItemView[];
  createdAt: string;
}

export interface PaymentView {
  orderNo: string;
  amount: number;
  status: 'CREATED' | 'SUCCESS' | 'FAILED';
  paidAt: string | null;
}

export interface PromotionInfo {
  code: string;
  type: 'FIXED_DISCOUNT' | 'PERCENT_OFF' | 'FULL_REDUCTION';
  value: number;
  threshold: number | null;
  active: boolean;
}
