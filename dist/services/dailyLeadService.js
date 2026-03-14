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
exports.getById = exports.deleteDailyLead = exports.updateDailyLead = exports.getDailyLeadsByUser = exports.getAllDailyLeads = exports.createDailyLead = void 0;
// services/dailyLeadService.ts
const dailyLead_1 = __importDefault(require("../model/dailyLead")); // adjust import path
const mongoose_1 = require("mongoose");
const createDailyLead = (data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data.user) {
        throw new Error("user is required");
    }
    if (!data.date) {
        throw new Error("date is required");
    }
    // Normalize date to start of day for query
    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    let entry = yield dailyLead_1.default.findOne({
        user: data.user,
        date: { $gte: date, $lt: nextDay },
    });
    const dealerInc = {};
    if (data.dealerType && data.dealerCount !== undefined && ["new", "old"].includes(data.dealerType)) {
        const field = `${data.dealerType}Dealers`;
        dealerInc[field] = data.dealerCount;
    }
    if (entry) {
        // Update existing entry
        const update = {
            $set: {},
        };
        if (data.numberOfLeads !== undefined)
            update.$set.numberOfLeads = data.numberOfLeads;
        if (data.interestedLeads !== undefined)
            update.$set.interestedLeads = data.interestedLeads;
        if (data.notInterestedFake !== undefined)
            update.$set.notInterestedFake = data.notInterestedFake;
        if (data.nextMonthConnect !== undefined)
            update.$set.nextMonthConnect = data.nextMonthConnect;
        if (Object.keys(dealerInc).length > 0) {
            update.$inc = dealerInc;
        }
        entry = yield dailyLead_1.default.findByIdAndUpdate(entry._id, update, { new: true, runValidators: true });
    }
    else {
        // Create new entry
        const createData = {
            user: data.user,
            date: data.date,
            numberOfLeads: data.numberOfLeads || 0,
            interestedLeads: data.interestedLeads || 0,
            notInterestedFake: data.notInterestedFake || 0,
            nextMonthConnect: data.nextMonthConnect || 0,
            newDealers: dealerInc.newDealers || 0,
            oldDealers: dealerInc.oldDealers || 0,
        };
        entry = yield dailyLead_1.default.create(createData);
    }
    if (!entry) {
        throw new Error("Failed to create or update daily lead");
    }
    return entry;
});
exports.createDailyLead = createDailyLead;
const getAllDailyLeads = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (page = 1, limit = 10, month, year) {
    const query = {};
    if (month && year) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        query.date = { $gte: start, $lt: end };
    }
    else if (year) {
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        query.date = { $gte: start, $lt: end };
    }
    const dailyLeads = yield dailyLead_1.default.find(query)
        .populate("user", "name email employeeId")
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ date: -1 })
        .lean();
    const monthlyTotals = yield dailyLead_1.default.aggregate([
        { $match: query },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                totalLeads: { $sum: "$numberOfLeads" },
                totalInterested: { $sum: "$interestedLeads" },
                totalNotInterestedFake: { $sum: "$notInterestedFake" },
                totalNextMonthConnect: { $sum: "$nextMonthConnect" },
                totalNewDealers: { $sum: "$newDealers" },
                totalOldDealers: { $sum: "$oldDealers" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: -1 } },
    ]);
    return { dailyLeads, monthlyTotals };
});
exports.getAllDailyLeads = getAllDailyLeads;
const getDailyLeadsByUser = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, page = 1, limit = 10, month, year) {
    if (!mongoose_1.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid userId");
    }
    const query = { user: new mongoose_1.Types.ObjectId(userId) };
    if (month && year) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        query.date = { $gte: start, $lt: end };
    }
    else if (year) {
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        query.date = { $gte: start, $lt: end };
    }
    const dailyLeads = yield dailyLead_1.default.find(query)
        .populate("user", "name email employeeId")
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ date: -1 })
        .lean();
    const monthlyTotals = yield dailyLead_1.default.aggregate([
        { $match: query },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                totalLeads: { $sum: "$numberOfLeads" },
                totalInterested: { $sum: "$interestedLeads" },
                totalNotInterestedFake: { $sum: "$notInterestedFake" },
                totalNextMonthConnect: { $sum: "$nextMonthConnect" },
                totalNewDealers: { $sum: "$newDealers" },
                totalOldDealers: { $sum: "$oldDealers" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: -1 } },
    ]);
    return { dailyLeads, monthlyTotals };
});
exports.getDailyLeadsByUser = getDailyLeadsByUser;
const updateDailyLead = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        return null;
    const dealerInc = {};
    if (data.dealerType && data.dealerCount !== undefined && ["new", "old"].includes(data.dealerType)) {
        const field = `${data.dealerType}Dealers`;
        dealerInc[field] = data.dealerCount;
    }
    const update = {};
    if (Object.keys(dealerInc).length > 0) {
        update.$inc = dealerInc;
    }
    update.$set = {};
    if (data.numberOfLeads !== undefined)
        update.$set.numberOfLeads = data.numberOfLeads;
    if (data.interestedLeads !== undefined)
        update.$set.interestedLeads = data.interestedLeads;
    if (data.notInterestedFake !== undefined)
        update.$set.notInterestedFake = data.notInterestedFake;
    if (data.nextMonthConnect !== undefined)
        update.$set.nextMonthConnect = data.nextMonthConnect;
    if (data.date !== undefined)
        update.$set.date = data.date;
    // Note: Updating user is not recommended, but if needed, add here
    if (Object.keys(update.$set).length === 0)
        delete update.$set;
    if (Object.keys(update).length === 0) {
        return yield dailyLead_1.default.findById(id);
    }
    return yield dailyLead_1.default.findByIdAndUpdate(id, update, { new: true, runValidators: true });
});
exports.updateDailyLead = updateDailyLead;
const deleteDailyLead = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.Types.ObjectId.isValid(id))
        return null;
    return yield dailyLead_1.default.findByIdAndDelete(id);
});
exports.deleteDailyLead = deleteDailyLead;
const getById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield dailyLead_1.default.findById(id).populate("user", "name email");
});
exports.getById = getById;
