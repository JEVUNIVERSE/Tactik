export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  title?: string;
  bio?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
  viewCount: number;
  updatedAt: string;
}

export interface Order {
  id: string;
  uid: string;
  username: string;
  status: string;
  amount: number;
  shippingAddress: string;
  createdAt: string;
  updatedAt: string;
}

