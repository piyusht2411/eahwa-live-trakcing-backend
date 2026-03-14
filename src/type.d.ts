interface ProductItems {
  item: string;
  currentStock: number;
  soldStock: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: any;
        name: string;
        role: string;
        managedBy?: any;
        fcmToken?: string;
        [key: string]: any;
      };
    }
  }
}

export { };
