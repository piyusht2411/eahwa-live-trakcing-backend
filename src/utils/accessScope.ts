import { Types } from "mongoose";
import User from "../models/user";

export const ADMIN_LEVEL_ROLES = ["admin", "super_manager", "hr"];

export const getManagedUserIdsForScope = async (authUser: { _id: any; role: string }) => {
  if (ADMIN_LEVEL_ROLES.includes(authUser.role)) return null;

  const teamMembers = await User.find({ managedBy: authUser._id, isActive: true })
    .select("_id")
    .lean();

  return teamMembers.map((u: any) => u._id as Types.ObjectId);
};

export const isUserInScope = (allowedUserIds: Types.ObjectId[] | null, userId: Types.ObjectId) => {
  return allowedUserIds === null || allowedUserIds.some(id => id.equals(userId));
};
