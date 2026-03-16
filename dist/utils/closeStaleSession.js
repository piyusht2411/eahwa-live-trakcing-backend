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
exports.closeStaleSession = void 0;
// src/utils/closeStaleSession.ts
const break_1 = __importDefault(require("../models/break"));
const closeStaleSession = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Silently close any open breaks from previous days
    yield break_1.default.updateMany({
        user: userId,
        endTime: { $exists: false },
        startTime: { $lt: today },
    }, {
        $set: {
            endTime: today,
            type: "end",
            duration: 0, // unknown actual duration
        },
    });
});
exports.closeStaleSession = closeStaleSession;
