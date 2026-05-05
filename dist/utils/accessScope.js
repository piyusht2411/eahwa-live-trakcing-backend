"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUserInScope = exports.getManagedUserIdsForScope = exports.ADMIN_LEVEL_ROLES = void 0;
const user_1 = __importDefault(require("../models/user"));
exports.ADMIN_LEVEL_ROLES = ["admin", "super_manager", "hr"];
const getManagedUserIdsForScope = (authUser) => __awaiter(void 0, void 0, void 0, function* () {
    if (exports.ADMIN_LEVEL_ROLES.includes(authUser.role))
        return null;
    const teamMembers = yield user_1.default.find({ managedBy: authUser._id, isActive: true })
        .select("_id")
        .lean();
    return teamMembers.map((u) => u._id);
});
exports.getManagedUserIdsForScope = getManagedUserIdsForScope;
const isUserInScope = (allowedUserIds, userId) => {
    return allowedUserIds === null || allowedUserIds.some(id => id.equals(userId));
};
exports.isUserInScope = isUserInScope;
