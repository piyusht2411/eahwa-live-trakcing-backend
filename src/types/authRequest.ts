import { Request } from "express";

export interface AuthRequest extends Request {
    user?: {
        _id: any;
        name: string;
        role: string;
        managedBy?: any;
        fcmToken?: string;
        [key: string]: any;
    };
}
